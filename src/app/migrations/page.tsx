'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft, Plus, Clock, CheckCircle, XCircle, Loader2, AlertTriangle, Trash2 } from "lucide-react";
import { MigrationTask } from '@/app/actions/migration';

export default function MigrationsPage() {
    const [tasks, setTasks] = useState<MigrationTask[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTasks();
        const interval = setInterval(fetchTasks, 3000); // Poll every 3s
        return () => clearInterval(interval);
    }, []);

    async function fetchTasks() {
        try {
            const res = await fetch('/api/migrations');
            if (res.ok) {
                const data = await res.json();
                setTasks(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleClearHistory() {
        if (!confirm('Удалить всю историю (кроме выполняющихся задач)?')) return;
        try {
            await fetch('/api/migrations?all=true', { method: 'DELETE' });
            fetchTasks();
        } catch (e) { console.error(e); }
    }

    const statusConfig = {
        pending: { icon: Clock, color: 'bg-gray-500/10 text-gray-500', label: 'Ожидает', animate: false },
        running: { icon: Loader2, color: 'bg-blue-500/10 text-blue-500', label: 'Выполняется', animate: true },
        completed: { icon: CheckCircle, color: 'bg-green-500/10 text-green-500', label: 'Завершена', animate: false },
        failed: { icon: XCircle, color: 'bg-red-500/10 text-red-500', label: 'Сбой', animate: false },
        cancelled: { icon: AlertTriangle, color: 'bg-amber-500/10 text-amber-500', label: 'Отменена', animate: false },
    };

    const activeTasks = tasks.filter(t => t.status === 'pending' || t.status === 'running');
    const historyTasks = tasks.filter(t => t.status !== 'pending' && t.status !== 'running');

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Миграции серверов</h1>
                    <p className="text-muted-foreground">Полная миграция между серверами</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/migrations/new">
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Создать миграцию
                        </Button>
                    </Link>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <>
                    {/* Active Migrations */}
                    {activeTasks.length > 0 && (
                        <div className="grid gap-4 md:grid-cols-2">
                            {activeTasks.map(task => {
                                const config = statusConfig[task.status] || statusConfig.pending;
                                const Icon = config.icon;
                                const progressPercent = task.total_steps > 0 ? Math.round((task.progress / task.total_steps) * 100) : 0;
                                return (
                                    <Link key={task.id} href={`/migrations/${task.id}`}>
                                        <Card className="hover:border-primary/50 transition-colors cursor-pointer border-blue-500/30 bg-blue-500/5">
                                            <CardContent className="p-6">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${config.color}`}>
                                                            <Icon className={`h-5 w-5 ${config.animate ? 'animate-spin' : ''}`} />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold">{task.source_name}</span>
                                                                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                                                                <span className="font-semibold">{task.target_name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                                <span>{task.progress}/{task.total_steps} шагов</span>
                                                                {task.current_step && (
                                                                    <span className="truncate">• {task.steps.find(s => s.status === 'running')?.name?.replace('Migrate ', '') || task.current_step}</span>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-blue-500 font-medium animate-pulse">
                                                                {task.status === 'running' ? 'Миграция выполняется...' : 'Ожидание...'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Badge variant="secondary" className={config.color}>{config.label}</Badge>
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">{task.current_step || 'Инициализация...'}</span>
                                                        <span className="font-mono">{progressPercent}%</span>
                                                    </div>
                                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                );
                            })}
                        </div>
                    )}

                    {/* History */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold">История</h2>
                            {historyTasks.length > 0 && (
                                <Button variant="ghost" size="sm" onClick={handleClearHistory} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Очистить историю
                                </Button>
                            )}
                        </div>

                        {historyTasks.length === 0 && activeTasks.length === 0 ? (
                            <Card>
                                <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                                    <ArrowRightLeft className="h-12 w-12 opacity-20 mb-4" />
                                    <p>Миграций не найдено.</p>
                                    <p className="text-sm">Начните первую миграцию сверху справа.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="border rounded-lg overflow-hidden bg-card">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-muted/50 text-left border-b">
                                            <th className="p-3 font-medium">Статус</th>
                                            <th className="p-3 font-medium">Откуда</th>
                                            <th className="p-3 font-medium">Куда</th>
                                            <th className="p-3 font-medium text-right">Дата</th>
                                            <th className="p-3 font-medium text-right">Подробнее</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {historyTasks.map(task => {
                                            const config = statusConfig[task.status] || statusConfig.failed;
                                            const Icon = config.icon;
                                            return (
                                                <tr key={task.id} className="hover:bg-muted/5 transition-colors">
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2">
                                                            <Icon className={`h-4 w-4 ${statusConfig[task.status]?.color?.split(' ')[1] || 'text-gray-500'}`} />
                                                            <span className="capitalize">{config.label}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 font-medium">{task.source_name}</td>
                                                    <td className="p-3 font-medium">{task.target_name}</td>
                                                    <td className="p-3 text-right text-muted-foreground font-mono">
                                                        {new Date(task.created_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <Link href={`/migrations/${task.id}`}>
                                                            <Button variant="ghost" size="sm">Просмотр</Button>
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {historyTasks.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-muted-foreground">История пуста.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
