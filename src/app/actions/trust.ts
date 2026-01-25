'use server';

import { getServer } from './server';
import { createSSHClient } from '@/lib/ssh';
import { getTranslations } from 'next-intl/server';
import { headers, cookies } from 'next/headers';
import { routing } from '@/i18n/routing';

// Helper to get locale in server actions
async function getServerLocale(): Promise<string> {
    const headersList = await headers();
    const cookieStore = await cookies();

    // Try to get locale from cookie (next-intl stores it as 'NEXT_LOCALE')
    const localeCookie = cookieStore.get('NEXT_LOCALE');
    if (localeCookie?.value && routing.locales.includes(localeCookie.value as any)) {
        return localeCookie.value;
    }

    // Fallback: try referer header
    const referer = headersList.get('referer') || '';
    const localeMatch = referer.match(/\/([a-z]{2})\//);
    if (localeMatch) {
        const locale = localeMatch[1];
        if (routing.locales.includes(locale as any)) {
            return locale;
        }
    }

    // Final fallback to default locale
    return routing.defaultLocale;
}

async function t(namespace: string) {
    const locale = await getServerLocale();
    return getTranslations({ locale, namespace });
}

// --- Single Trust Setup ---
export async function setupSSHTrust(sourceId: number, targetId: number, rootPassword: string): Promise<string> {
    const source = await getServer(sourceId);
    const target = await getServer(targetId);

    if (!source || !target) {
        const trustT = await t('actionsTrust');
        throw new Error(trustT('serverNotFound'));
    }

    // 1. Source Key
    const sourceSsh = createSSHClient(source);
    await sourceSsh.connect(); // Explicit connect

    let pubKey = '';
    try {
        pubKey = await sourceSsh.exec('cat ~/.ssh/id_rsa.pub');
    } catch {
        try {
            await sourceSsh.exec('mkdir -p ~/.ssh && chmod 700 ~/.ssh');
            await sourceSsh.exec('ssh-keygen -t rsa -N "" -f ~/.ssh/id_rsa');
            pubKey = await sourceSsh.exec('cat ~/.ssh/id_rsa.pub');
        } catch (e: any) {
            throw new Error('Key generation failed on source: ' + e.message);
        }
    } finally {
        await sourceSsh.disconnect();
    }

    if (!pubKey) throw new Error('Public Key empty');

    // 2. Target Install
    let targetSsh;

    if (rootPassword) {
        // Override with provided root password
        targetSsh = createSSHClient({
            ...target,
            ssh_user: 'root',
            ssh_key: rootPassword
        });
    } else {
        // Use stored credentials
        // Note: This requires the stored user to have permissions to modify /root/.ssh or ~/.ssh depending on target user
        targetSsh = createSSHClient(target);
    }

    try {
        await targetSsh.connect();
        await targetSsh.exec('mkdir -p ~/.ssh && chmod 700 ~/.ssh');

        const authKeys = await targetSsh.exec('cat ~/.ssh/authorized_keys 2>/dev/null || true');
        if (!authKeys.includes(pubKey.trim())) {
            // Append securely
            await targetSsh.exec(`echo "${pubKey.trim()}" >> ~/.ssh/authorized_keys`);
            await targetSsh.exec('chmod 600 ~/.ssh/authorized_keys');
        }
        const trustT = await t('actionsTrust');
        return trustT('sshTrustSetupSuccess');
    } catch (e: any) {
        const trustT = await t('actionsTrust');
        throw new Error(`${trustT('targetConnectionFailed')}${e.message}`);
    } finally {
        await targetSsh.disconnect();
    }
}

// --- Bulk Trust Setup ---
export async function establishClusterTrust(sourceIds: number[], targetIds: number[], rootPassword: string) {
    const results = [];

    // Simple serial execution to avoid overwhelming concurrent connections
    // (User has 40 servers, O(N^2) connections could be 1600. Serial is safest.)
    for (const sId of sourceIds) {
        const sName = (await getServer(sId))?.name || String(sId);

        for (const tId of targetIds) {
            if (sId === tId) continue;

            const tName = (await getServer(tId))?.name || String(tId);
            try {
                await setupSSHTrust(sId, tId, rootPassword);
                results.push({ source: sName, target: tName, status: 'success' });
            } catch (e: any) {
                results.push({ source: sName, target: tName, status: 'error', message: e.message });
            }
        }
    }
    return results;
}
