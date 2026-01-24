import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import * as tar from 'tar';
import db, { getBackupDir } from '@/lib/db';
import { createSSHClient } from '@/lib/ssh';

// Paths to backup
const BACKUP_PATHS = [
    '/etc',           // Configs
    '/root/.ssh',     // Keys
    '/var/spool/cron' // Cron jobs
];

interface Server {
    id: number;
    name: string;
    type: 'pve' | 'pbs';
    url: string;
    ssh_host?: string;
    ssh_port?: number;
    ssh_user?: string;
    ssh_key?: string;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function createRecoveryGuide(server: Server, date: Date): string {
    const dateStr = date.toLocaleString('ru-RU', { dateStyle: 'full', timeStyle: 'short' });
    return `# 🔧 Инструкция по аварийному восстановлению

## Информация о сервере
| Свойство | Значение |
|----------|----------|
| **Имя** | ${server.name} |
| **Тип** | ${server.type.toUpperCase()} |
| **Дата бэкапа** | ${dateStr} |

---

## ⚠️ Важное примечание
Эта инструкция проведёт вас через восстановление сервера после полного сбоя.
Все команды выполнять с \`sudo\` или войдя как Root.

---

## Шаг 1: Установка операционной системы
1. Скачать Proxmox VE ISO (такая же или более новая версия)
2. Загрузиться с USB/CD и установить
3. **Важно:** Использовать то же имя хоста: \`${server.name}\`
4. Использовать тот же IP-адрес и сетевую конфигурацию (см. SYSTEM_INFO.txt)

---

## Шаг 2: Подготовка SSH-доступа
\`\`\`bash
# Скопировать SSH-ключ из бэкапа
mkdir -p /root/.ssh
cp <backup>/root/.ssh/authorized_keys /root/.ssh/
chmod 600 /root/.ssh/authorized_keys
\`\`\`

---

## Шаг 3: Восстановление сетевой конфигурации
\`\`\`bash
# Резервная копия текущей сетевой конфигурации
cp /etc/network/interfaces /etc/network/interfaces.bak

# Копировать конфигурацию из бэкапа
cp <backup>/etc/network/interfaces /etc/network/interfaces

# Перезапустить сеть
systemctl restart networking
\`\`\`

---

## Шаг 4: Восстановление конфигурации Proxmox
\`\`\`bash
# Конфигурации VM/CT
cp -r <backup>/etc/pve/* /etc/pve/

# Конфигурация хранилища
cp <backup>/etc/pve/storage.cfg /etc/pve/storage.cfg
\`\`\`

---

## Шаг 5: Восстановление хранилища
1. Проверьте \`SYSTEM_INFO.txt\` для UUID дисков
2. Новые диски имеют другие UUID → настроить \`/etc/fstab\`!

\`\`\`bash
# Показать UUID новых дисков
blkid

# Настроить fstab
nano /etc/fstab
\`\`\`

---

## Шаг 6: Проверка служб
\`\`\`bash
# Перезапустить службы Proxmox
systemctl restart pvedaemon pveproxy pvestatd

# Проверить статус
pvecm status  # Статус кластера
pvesh get /nodes  # Проверить ноды
\`\`\`

---

## 📋 Контрольный список после восстановления
- [ ] Сеть доступна (Ping-тест)
- [ ] Веб-интерфейс доступен по https://<IP>:8006
- [ ] Все VM/CT видны
- [ ] Хранилище корректно смонтировано
- [ ] Бэкапы снова настроены

---

## 📞 Поддержка
При проблемах: проверить логи с помощью \`journalctl -xe\` или \`dmesg\`
`;
}

// Calculate directory size recursively
function calculateSize(dir: string): number {
    let size = 0;
    if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            try {
                const filePath = path.join(dir, file);
                // Use lstatSync to avoid following broken symlinks (ENOENT)
                const stat = fs.lstatSync(filePath);
                if (stat.isDirectory()) {
                    size += calculateSize(filePath);
                } else {
                    size += stat.size;
                }
            } catch (e) {
                // Ignore errors for individual files during stats
                console.warn(`[BackupLogic] Warning counting size for ${file}:`, e);
            }
        }
    }
    return size;
}

// Count files recursively
function countFiles(dir: string): number {
    let count = 0;
    if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            try {
                const filePath = path.join(dir, file);
                // Use lstatSync to avoid following broken symlinks (ENOENT)
                const stat = fs.lstatSync(filePath);
                if (stat.isDirectory()) {
                    count += countFiles(filePath);
                } else {
                    count++;
                }
            } catch (e) {
                console.warn(`[BackupLogic] Warning counting file ${file}:`, e);
            }
        }
    }
    return count;
}

/**
 * Core backup logic separated from Server Action to avoid Turbopack analysis issues
 * and to implement faster TAR-based backup
 */
export async function performFullBackup(serverId: number, server: Server) {
    // 1. Setup paths avoiding overly broad patterns
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const serverDirName = 'server-' + serverId;

    // Construct path segments separately to confuse static analyzer
    const backupRoot = getBackupDir();
    const destPath = path.resolve(backupRoot, serverDirName, timestamp);

    console.log(`[BackupLogic] Starting TAR backup for ${server.name} to ${destPath}`);

    // Create dir
    fs.mkdirSync(destPath, { recursive: true });

    // 2. SSH Connection
    const ssh = createSSHClient(server);
    await ssh.connect();

    try {
        // 3. System Info (Fast)
        try {
            const sysInfoCmd = 'cat /etc/os-release; echo "---"; hostname -f; echo "---"; ip a; echo "---"; lsblk -f; echo "---"; cat /etc/fstab';
            const sysInfo = await ssh.exec(sysInfoCmd);
            fs.writeFileSync(path.join(destPath, 'SYSTEM_INFO.txt'), sysInfo);

            const uuidInfo = await ssh.exec('blkid');
            fs.writeFileSync(path.join(destPath, 'DISK_UUIDS.txt'), uuidInfo);
        } catch (e) {
            console.error('[BackupLogic] SysInfo error:', e);
        }

        // 4. TAR Streaming (The speed fix)
        // Check which paths exist
        const validPaths: string[] = [];
        for (const p of BACKUP_PATHS) {
            const check = await ssh.exec(`test -e "${p}" && echo "yes" || echo "no"`);
            if (check.trim() === 'yes') validPaths.push(p);
        }

        if (validPaths.length > 0) {
            console.log(`[BackupLogic] Streaming paths via TAR: ${validPaths.join(', ')}`);
            const tarFile = path.join(destPath, 'backup.tar.gz');

            // Create a writable stream
            const writeStream = fs.createWriteStream(tarFile);

            // Command to tar to stdout
            // --ignore-failed-read to continue if some files are locked
            const cmd = `tar -czf - ${validPaths.join(' ')} 2>/dev/null`;

            await ssh.streamCommand(cmd, writeStream);
            writeStream.end();

            // 5. Extract locally for file browser access
            // We do this locally so we can browse files in the UI
            // CRITICAL: Filter out Symlinks/Links to prevent Turbopack build crashes
            // when it encounters links pointing outside project root (e.g. /etc/ssl/certs)
            console.log('[BackupLogic] Extracting archive locally for File Browser (excluding symlinks)...');
            await tar.x({
                file: tarFile,
                cwd: destPath,
                preservePaths: true,
                filter: (path, entry) => {
                    // Skip symbolic links and hard links to prevent build tools from crashing
                    // on invalid paths or paths outside project root
                    // Cast entry to any to avoid type issues with @types/tar
                    const type = (entry as any).type;
                    return type !== 'SymbolicLink' && type !== 'Link';
                }
            });

            // Optional: Remove tar file to save space? Or keep it?
            // User might want to download the tar. For now, keep it? 
            // Actually the current "Download" button zips selected files.
            // Let's keep the extracted files as the primary storage so the UI works as is.
            fs.unlinkSync(tarFile);
        }

        // 6. Metadata
        const recoveryGuide = createRecoveryGuide(server, new Date());
        fs.writeFileSync(path.join(destPath, 'WIEDERHERSTELLUNG.md'), recoveryGuide);

        ssh.disconnect();

        // 7. Stats
        const totalFiles = countFiles(destPath);
        const totalSize = calculateSize(destPath);

        // 8. DB Update
        const result = db.prepare(`
            INSERT INTO config_backups (server_id, backup_path, file_count, total_size, status)
            VALUES (?, ?, ?, ?, ?)
        `).run(serverId, destPath, totalFiles, totalSize, 'complete');

        return {
            success: true,
            message: `Бэкап успешно создан: ${totalFiles} файлов (${formatBytes(totalSize)})`,
            backupId: result.lastInsertRowid as number
        };

    } catch (err) {
        ssh.disconnect();
        throw err;
    }
}

export async function restoreFileToRemote(serverId: number, backupId: number, relativePath: string) {
    const backup = db.prepare('SELECT * FROM config_backups WHERE id = ?').get(backupId) as { backup_path: string } | undefined;
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as Server | undefined;

    if (!backup || !server) throw new Error('Бэкап или сервер не найден');

    // Security: Validate path
    const normalized = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
    const localPath = path.join(backup.backup_path, normalized);

    if (!localPath.startsWith(backup.backup_path)) throw new Error('Недопустимый путь');
    if (!fs.existsSync(localPath)) throw new Error('Файл не найден в бэкапе');

    const ssh = createSSHClient(server);
    await ssh.connect();

    try {
        // CRITICAL: Use absolute path on remote (must start with /)
        const remotePath = '/' + normalized;
        await ssh.uploadFile(localPath, remotePath);
        ssh.disconnect();
        return { success: true, message: `Datei wiederhergestellt: ${remotePath}` };
    } catch (e) {
        ssh.disconnect();
        throw e;
    }
}
