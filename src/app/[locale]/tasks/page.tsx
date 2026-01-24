'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAllTasks, TaskItem, cancelTask } from '@/app/actions/tasks';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, ListTodo, AlertTriangle, CheckCircle2, XCircle, StopCircle, Terminal, Search, Clock, Activity, Copy, ArrowRightLeft, ScanLine } from "lucide-react";
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function TasksPage() {
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [filteredTasks, setFilteredTasks] = useState<TaskItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

    // Use ref to track selected task ID without causing re-renders
    const selectedTaskIdRef = useRef<string | null>(null);

    // Filters
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Keep ref in sync with state
    useEffect(() => {
        selectedTaskIdRef.current = selectedTask?.id ?? null;
    }, [selectedTask]);

    const loadTasks = useCallback(async () => {
        const res = await getAllTasks(200);
        setTasks(res.items);
        setLoading(false);

        // Update selected task if it's in the new list (using ref to avoid dependency)
        if (selectedTaskIdRef.current) {
            const updated = res.items.find((t: TaskItem) => t.id === selectedTaskIdRef.current);
            if (updated) {
                setSelectedTask(updated);
            }
        }
    }, []); // No dependencies - uses ref instead

    useEffect(() => {
        loadTasks();
        const interval = setInterval(loadTasks, 2000); // Live update every 2s
        return () => clearInterval(interval);
    }, [loadTasks]);

    useEffect(() => {
        let res = tasks;
        if (filterStatus !== 'all') {
            res = res.filter(t => t.status === filterStatus);
        }
        if (filterType !== 'all') {
            res = res.filter(t => t.type === filterType);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            res = res.filter(t =>
                t.description?.toLowerCase().includes(q) ||
                t.node?.toLowerCase().includes(q) ||
                t.id.toLowerCase().includes(q)
            );
        }
        setFilteredTasks(res);
    }, [tasks, filterStatus, filterType, searchQuery]);

    async function handleStopTask(task: TaskItem) {
        if (!confirm(`Действительно остановить задачу "${task.description}"?`)) return;
        try {
            await cancelTask(task.id);
            toast.success('Сигнал остановки отправлен');
            loadTasks();
        } catch (e) {
            toast.error('Ошибка при остановке');
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'running': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
            case 'completed':
            case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
            case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
            case 'cancelled': return <StopCircle className="h-4 w-4 text-orange-500" />;
            case 'pending': return <Clock className="h-4 w-4 text-amber-500" />;
            default: return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const getStatusText = (status: string): string => {
        const statusMap: Record<string, string> = {
            'running': 'Выполняется',
            'completed': 'Завершено',
            'success': 'Успешно',
            'failed': 'Ошибка',
            'cancelled': 'Отменено',
            'pending': 'Ожидает'
        };
        return statusMap[status] || status;
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'scan': return <ScanLine className="h-3 w-3" />;
            case 'migration': return <ArrowRightLeft className="h-3 w-3" />;
            case 'background': return <Copy className="h-3 w-3" />;
            default: return <Activity className="h-3 w-3" />;
        }
    };

    const getTypeText = (type: string): string => {
        const typeMap: Record<string, string> = {
            'scan': 'Сканирование',
            'migration': 'Миграция',
            'background': 'Синхронизация',
            'config': 'Бэкап'
        };
        return typeMap[type] || type;
    };

    const runningCount = tasks.filter(t => t.status === 'running').length;

    return (
        <div className="h-[calc(100vh-2rem)] flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <ListTodo className="h-8 w-8" />
                        Центр задач
                        {runningCount > 0 && (
                            <Badge variant="default" className="ml-2 bg-blue-600 animate-pulse">
                                {runningCount} активно
                            </Badge>
                        )}
                    </h1>
                    <p className="text-muted-foreground mt-1">Обзор всех фоновых процессов</p>
                </div>
                <Button variant="outline" onClick={() => loadTasks()} disabled={loading}>
                    <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
                    Обновить
                </Button>
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-[400px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Поиск по описанию, ноде, ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Тип задачи" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Все типы</SelectItem>
                        <SelectItem value="scan">🔍 Сканирование</SelectItem>
                        <SelectItem value="migration">🚀 Миграция</SelectItem>
                        <SelectItem value="background">📦 Синхронизация</SelectItem>
                        <SelectItem value="config">💾 Бэкап</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Статус" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Все статусы</SelectItem>
                        <SelectItem value="running">⏳ Выполняется</SelectItem>
                        <SelectItem value="completed">✅ Завершено</SelectItem>
                        <SelectItem value="failed">❌ Ошибка</SelectItem>
                        <SelectItem value="cancelled">🛑 Отменено</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Main Content: Split View */}
            <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
                {/* Left: Task List */}
                <Card className={cn("flex flex-col transition-all duration-300", selectedTask ? "w-[55%]" : "w-full")}>
                    <CardHeader className="py-3 px-4 border-b">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                            <span>Задачи ({filteredTasks.length})</span>
                            <span className="text-xs text-muted-foreground font-normal">
                                Обновление каждые 2с
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 overflow-hidden">
                        <ScrollArea className="h-full">
                            <Table>
                                <TableHeader className="sticky top-0 bg-card z-10">
                                    <TableRow>
                                        <TableHead className="w-[40px]"></TableHead>
                                        <TableHead className="w-[140px]">Время</TableHead>
                                        <TableHead className="w-[100px]">Нода</TableHead>
                                        <TableHead>Описание</TableHead>
                                        <TableHead className="w-[90px]">Длительность</TableHead>
                                        <TableHead className="w-[100px]">Статус</TableHead>
                                        <TableHead className="w-[60px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTasks.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center h-32 text-muted-foreground">
                                                {loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : 'Задач не найдено'}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredTasks.map(task => (
                                            <TableRow
                                                key={task.id}
                                                className={cn(
                                                    "cursor-pointer transition-colors",
                                                    selectedTask?.id === task.id
                                                        ? "bg-primary/10 border-l-4 border-l-primary"
                                                        : "hover:bg-muted/50"
                                                )}
                                                onClick={() => setSelectedTask(task)}
                                            >
                                                <TableCell>{getStatusIcon(task.status)}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground font-mono">
                                                    {new Date(task.startTime).toLocaleString('ru-RU', {
                                                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </TableCell>
                                                <TableCell className="font-medium text-sm">{task.node || '-'}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0 gap-1">
                                                            {getTypeIcon(task.type)}
                                                            {getTypeText(task.type)}
                                                        </Badge>
                                                        <span className="truncate max-w-[250px] text-sm" title={task.description}>
                                                            {task.description}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{task.duration || '-'}</TableCell>
                                                <TableCell>
                                                    <Badge variant={
                                                        task.status === 'failed' ? 'destructive' :
                                                            task.status === 'running' ? 'default' :
                                                                task.status === 'cancelled' ? 'secondary' : 'outline'
                                                    }>
                                                        {getStatusText(task.status)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {task.status === 'running' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-red-500 hover:bg-red-500/10"
                                                            onClick={(e) => { e.stopPropagation(); handleStopTask(task); }}
                                                        >
                                                            <StopCircle className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Right: Log Panel (only if task selected) */}
                {selectedTask && (
                    <Card className="w-[45%] flex flex-col animate-in slide-in-from-right-5 duration-300">
                        <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-2 min-w-0">
                                <Terminal className="h-4 w-4 text-primary shrink-0" />
                                <span className="font-medium text-sm truncate">{selectedTask.description}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {selectedTask.status === 'running' && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="h-7 text-xs"
                                        onClick={() => handleStopTask(selectedTask)}
                                    >
                                        <StopCircle className="mr-1 h-3 w-3" />
                                        Остановить
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => setSelectedTask(null)}
                                >
                                    Закрыть
                                </Button>
                            </div>
                        </CardHeader>

                        {/* Task Info Grid */}
                        <div className="grid grid-cols-3 gap-4 p-4 border-b text-sm bg-muted/30">
                            <div>
                                <p className="text-xs text-muted-foreground">ID</p>
                                <p className="font-mono text-xs truncate" title={selectedTask.id}>{selectedTask.id}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Тип</p>
                                <p>{getTypeText(selectedTask.type)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Узел</p>
                                <p>{selectedTask.node || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Начало</p>
                                <p>{new Date(selectedTask.startTime).toLocaleString('ru-RU')}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Конец</p>
                                <p>{selectedTask.endTime ? new Date(selectedTask.endTime).toLocaleString('ru-RU') : '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Длительность</p>
                                <p>{selectedTask.duration || '-'}</p>
                            </div>
                        </div>

                        {/* Log Output */}
                        <div className="flex-1 bg-black/95 overflow-hidden flex flex-col">
                            <div className="px-3 py-2 border-b border-white/10 text-xs text-white/50 flex items-center justify-between">
                                <span>Вывод логов</span>
                                {selectedTask.status === 'running' && (
                                    <span className="flex items-center gap-1 text-green-400">
                                        <span className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                                        Прямой эфир
                                    </span>
                                )}
                            </div>
                            <ScrollArea className="flex-1 p-4">
                                <pre className="font-mono text-xs text-green-400 whitespace-pre-wrap leading-relaxed select-text">
                                    {selectedTask.log || '... Ожидание вывода логов ...'}
                                    {selectedTask.status === 'running' && (
                                        <span className="animate-pulse ml-1 text-primary">▌</span>
                                    )}
                                </pre>
                            </ScrollArea>
                            <div className="px-3 py-2 border-t border-white/10 text-[10px] text-white/30 flex justify-between">
                                <span>UID: {selectedTask.id}</span>
                                <span className={cn(
                                    selectedTask.status === 'running' && 'text-blue-400',
                                    selectedTask.status === 'completed' && 'text-green-400',
                                    selectedTask.status === 'failed' && 'text-red-400'
                                )}>
                                    {getStatusText(selectedTask.status).toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}
