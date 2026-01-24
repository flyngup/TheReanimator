'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, RefreshCw, Download, CheckCircle2, AlertCircle, Loader2, Terminal, GitBranch, Copy, Database, Server, Info, Power, HardDrive, Sparkles, BrainCircuit } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getAISettings, saveAISettings, checkOllamaConnection, type OllamaModel } from "@/app/actions/ai";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface VersionInfo {
    currentVersion: string;
    currentCommit: string;
    updateAvailable: boolean;
    remoteCommit: string;
    commitsBehind: number;
}

export default function SettingsClient() {
    const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
    const [checking, setChecking] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [updateLog, setUpdateLog] = useState<string[]>([]);
    const [updateComplete, setUpdateComplete] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);

    useEffect(() => {
        checkForUpdates();
    }, []);

    async function checkForUpdates() {
        setChecking(true);
        try {
            const res = await fetch('/api/update');
            const data = await res.json();
            setVersionInfo(data);
        } catch (err) {
            console.error('Failed to check for updates:', err);
        }
        setChecking(false);
    }

    async function performUpdate() {
        if (!confirm('Выполнить обновление сейчас? Приложение будет перезапущено.')) return;

        setUpdating(true);
        setUpdateLog([]);
        setUpdateComplete(false);
        setUpdateError(null);

        try {
            const res = await fetch('/api/update', { method: 'POST' });
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('No response stream');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split('\n').filter(l => l.startsWith('data: '));

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line.replace('data: ', ''));
                        if (data.message) {
                            setUpdateLog(prev => [...prev, data.message]);
                        }
                        if (data.done) {
                            setUpdateComplete(true);
                        }
                        if (data.error) {
                            setUpdateError(data.error);
                        }
                    } catch {
                        // Ignore parse errors
                    }
                }
            }
        } catch (err) {
            setUpdateError(err instanceof Error ? err.message : String(err));
        }

        setUpdating(false);
    }

    async function handleRestart() {
        if (!confirm('Перезапустить приложение?')) return;
        try {
            await fetch('/api/update', {
                method: 'POST',
                headers: { 'X-Restart-Only': 'true' }
            });
            toast.success("Перезапуск инициирован");
        } catch {
            // Expected to fail as server restarts
        }
    }

    const manualCommand = "cd ~/Reanimator && git pull && npm install --include=dev && npm run build && systemctl restart proxhost-backup";

    const copyCommand = () => {
        navigator.clipboard.writeText(manualCommand);
        toast.success("Команда скопирована!");
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <div className="bg-primary/10 p-3 rounded-xl">
                    <Settings className="h-8 w-8 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        Системные настройки
                        <span className="text-xs bg-amber-500/10 text-amber-500 px-2.5 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-wide font-bold">Beta</span>
                    </h1>
                    <p className="text-muted-foreground">Управление и обслуживание экземпляра Reanimator</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT COLUMN: UPDATES (Spans 2 columns on large screens) */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="overflow-hidden border-muted/60 shadow-sm">
                        <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <Download className="h-5 w-5 text-primary" />
                                    Программное обеспечение и обновления
                                </CardTitle>
                                {versionInfo && (
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium border ${versionInfo.updateAvailable ? 'bg-green-500/10 text-green-600 border-green-200' : 'bg-muted text-muted-foreground border-border'}`}>
                                        {versionInfo.updateAvailable ? 'Доступно обновление' : 'Актуально'}
                                    </span>
                                )}
                            </div>
                            <CardDescription>
                                Управление версиями и автоматическое обновление
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            {/* Version Info Block */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl bg-muted/30 border gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-background border flex items-center justify-center shadow-sm">
                                        <GitBranch className="h-6 w-6 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm text-muted-foreground">Установленная версия</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl font-bold tracking-tight">
                                                v{versionInfo?.currentVersion || '...'}
                                            </span>
                                            {versionInfo?.currentCommit && (
                                                <span className="font-mono text-xs px-1.5 py-0.5 bg-muted rounded border text-muted-foreground">
                                                    #{versionInfo.currentCommit}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 sm:flex-none"
                                        onClick={() => window.open('https://github.com/jahartmann/TheReanimator', '_blank')}
                                    >
                                        GitHub
                                    </Button>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        className="flex-1 sm:flex-none"
                                        onClick={checkForUpdates}
                                        disabled={checking || updating}
                                    >
                                        {checking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                                        Проверить
                                    </Button>
                                </div>
                            </div>

                            {/* Update Available Box */}
                            {versionInfo?.updateAvailable && !updating && !updateComplete && (
                                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-full bg-green-500/10 text-green-600 mt-1">
                                            <CheckCircle2 className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-green-700 dark:text-green-400">Доступна новая версия</p>
                                            <p className="text-sm text-green-600/80 dark:text-green-500/80">
                                                {versionInfo.commitsBehind} новых коммитов готово к установке.
                                                <span className="font-mono text-xs ml-2 opacity-75">
                                                    ({versionInfo.currentCommit} → {versionInfo.remoteCommit})
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                    <Button onClick={performUpdate} className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto">
                                        <Download className="h-4 w-4 mr-2" />
                                        Обновить сейчас
                                    </Button>
                                </div>
                            )}

                            {/* Logs Terminal */}
                            {(updating || updateLog.length > 0) && (
                                <div className="space-y-3 pt-2">
                                    <div className="flex items-center gap-2 px-1">
                                        <Terminal className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">Журнал обновления</span>
                                        {updating && <span className="text-xs text-muted-foreground animate-pulse ml-auto">Установка...</span>}
                                    </div>
                                    <div className="rounded-xl border bg-[#0f0f0f] shadow-inner overflow-hidden">
                                        <div className="flex items-center gap-1.5 px-4 py-2 bg-[#1a1a1a] border-b border-[#333]">
                                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20"></div>
                                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20"></div>
                                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/20"></div>
                                            <span className="ml-2 text-[10px] text-zinc-500 font-mono">reanimator-update-task</span>
                                        </div>
                                        <ScrollArea className="h-[250px] w-full p-4">
                                            <pre className="text-xs font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed">
                                                {updateLog.length === 0 && <span className="opacity-50">Ожидание запуска...</span>}
                                                {updateLog.map((line, i) => (
                                                    <div key={i} className="py-0.5 border-l-2 border-transparent hover:border-zinc-700 pl-2 -ml-2 transition-colors">
                                                        {line.startsWith('✅') ? <span className="text-green-400">{line}</span> :
                                                            line.startsWith('❌') ? <span className="text-red-400 font-bold">{line}</span> :
                                                                line.startsWith('🔄') ? <span className="text-blue-400">{line}</span> :
                                                                    <span className="text-zinc-300">{line}</span>}
                                                    </div>
                                                ))}
                                                {updateComplete && <div className="mt-4 pt-2 border-t border-zinc-800 text-green-500 font-bold">✨ Операция завершена.</div>}
                                            </pre>
                                        </ScrollArea>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* AI INTEGRATION CARD */}
                    <AICard />
                </div>

                {/* RIGHT COLUMN: MAINTENANCE & INFO */}
                <div className="space-y-6">
                    {/* Maintenance */}
                    <Card className="border-muted/60 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Power className="h-5 w-5 text-orange-500" />
                                Управление системой
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                                <div>
                                    <h4 className="font-medium text-sm">Перезапуск сервиса</h4>
                                    <p className="text-xs text-muted-foreground">Перезапускает Node.js приложение</p>
                                </div>
                                <Button variant="secondary" size="sm" onClick={handleRestart} className="hover:bg-orange-500/10 hover:text-orange-600 border shadow-sm">
                                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                                    Перезапустить
                                </Button>
                            </div>

                            <div className="pt-2">
                                <p className="text-xs font-medium mb-2 flex items-center gap-2">
                                    <Terminal className="h-3 w-3" /> Ручное обновление через CLI
                                </p>
                                <div className="relative group">
                                    <code className="block p-3 bg-muted rounded-lg text-[10px] font-mono text-muted-foreground break-all border group-hover:border-foreground/20 transition-colors">
                                        {manualCommand}
                                    </code>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background shadow-sm"
                                        onClick={copyCommand}
                                    >
                                        <Copy className="h-3 w-3" />
                                    </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                                    <Info className="h-3 w-3" /> Выполнить как <strong>root</strong>.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Info */}
                    <Card className="border-muted/60 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Info className="h-5 w-5 text-blue-500" />
                                Информация
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center gap-3 text-sm p-2 hover:bg-muted/50 rounded transition-colors">
                                <Database className="h-4 w-4 text-muted-foreground" />
                                <div className="flex-1">
                                    <p className="font-medium">База данных</p>
                                    <p className="text-xs text-muted-foreground">SQLite (WAL Mode)</p>
                                </div>
                                <span className="text-xs bg-muted px-1.5 py-0.5 rounded">data/proxhost.db</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm p-2 hover:bg-muted/50 rounded transition-colors">
                                <HardDrive className="h-4 w-4 text-muted-foreground" />
                                <div className="flex-1">
                                    <p className="font-medium">Путь бэкапов</p>
                                    <p className="text-xs text-muted-foreground">Автоматическое сохранение конфигураций</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-sm p-2 hover:bg-muted/50 rounded transition-colors">
                                <Server className="h-4 w-4 text-muted-foreground" />
                                <div className="flex-1">
                                    <p className="font-medium">Окружение</p>
                                    <p className="text-xs text-muted-foreground transition-all hover:text-foreground">
                                        Сервер: {process.env.NODE_ENV}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function AICard() {
    const [url, setUrl] = useState('http://localhost:11434');
    const [model, setModel] = useState('');
    const [enabled, setEnabled] = useState(false);
    const [models, setModels] = useState<OllamaModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        getAISettings().then(s => {
            if (s.url) setUrl(s.url);
            if (s.model) setModel(s.model);
            setEnabled(s.enabled);
            // Only check connection if enabled or if we have a URL and want to show status (optional: maybe only check if enabled)
            if (s.url && s.enabled) checkConnection(s.url, false);
        });
    }, []);

    async function checkConnection(checkUrl: string, showToast = true) {
        setLoading(true);
        const res = await checkOllamaConnection(checkUrl);
        setLoading(false);

        if (res.success && res.models) {
            setConnected(true);
            setModels(res.models);
            if (showToast) toast.success(`Подключено! Найдено моделей: ${res.models.length}.`);
        } else {
            setConnected(false);
            setModels([]);
            if (showToast) toast.error(`Ошибка подключения: ${res.message}`);
        }
    }

    async function handleSave(newUrl: string, newModel: string, newEnabled: boolean) {
        // Validation only if we are enabling
        if (newEnabled && !newModel && connected) {
            // allow saving enabled=true if model is missing? NO, force model selection if connected. 
            // If not connected, we probably shouldn't allow enabling unless we trust user.
            // Let's stick to: if enabling, we need a model IF we assume connection is ok.
        }

        setSaving(true);
        // Optimistic update
        setEnabled(newEnabled);

        await saveAISettings(newUrl, newModel, newEnabled);
        setSaving(false);
        toast.success(newEnabled ? 'AI функции активированы' : 'AI функции деактивированы');

        // Improve local state consistency
        if (!newEnabled) {
            setConnected(false);
        } else if (newUrl) {
            checkConnection(newUrl, false);
        }

        // Force reload to update global state (Sidebar, etc.)
        setTimeout(() => {
            window.location.reload();
        }, 500);
    }

    return (
        <Card className="overflow-hidden border-muted/60 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-purple-500/5 to-transparent pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-500" />
                        AI Ассистент (Ollama)
                    </CardTitle>
                    <div className="flex items-center gap-3">
                        {connected && enabled && (
                            <span className="text-xs px-2 py-1 rounded-full font-medium border bg-green-500/10 text-green-600 border-green-200">
                                Подключено
                            </span>
                        )}
                        <Switch
                            checked={enabled}
                            onCheckedChange={(checked) => handleSave(url, model, checked)}
                            disabled={saving}
                        />
                    </div>
                </div>
                <CardDescription>
                    Подключите локальную AI модель (Ollama) для расширенных функций: анализ сети, объяснение логов, умные теги.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
                {!enabled ? (
                    <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                        <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">AI функции деактивированы</p>
                        <p className="text-xs opacity-70 mt-1">Включите переключатель справа вверху для использования AI функций.</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            <Label>Ollama URL</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="http://localhost:11434"
                                    className="font-mono"
                                />
                                <Button
                                    variant="secondary"
                                    onClick={() => checkConnection(url)}
                                    disabled={loading}
                                >
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground">Стандартный порт 11434. Убедитесь, что Ollama запущен.</p>
                        </div>

                        <div className="space-y-2">
                            <Label>Выбрать модель</Label>
                            <Select value={model} onValueChange={setModel} disabled={!connected || models.length === 0}>
                                <SelectTrigger>
                                    <SelectValue placeholder={connected ? "Выберите модель..." : "Сначала подключитесь..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {models.map(m => (
                                        <SelectItem key={m.digest} value={m.name}>
                                            <div className="flex items-center justify-between w-full min-w-[200px]">
                                                <span className="font-medium">{m.name}</span>
                                                <span className="text-xs text-muted-foreground ml-2">
                                                    {Math.round(m.size / 1024 / 1024 / 1024 * 10) / 10} GB
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="pt-2 flex justify-end">
                            <Button onClick={() => handleSave(url, model, true)} disabled={saving || !connected || !model} className="bg-purple-600 hover:bg-purple-700 text-white">
                                <BrainCircuit className="h-4 w-4 mr-2" />
                                Сохранить настройки
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
