'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Clock, Plus, Trash2, Play, AlertCircle, RefreshCw } from "lucide-react";
import { getJobsForServer, createConfigBackupSchedule, createScanSchedule, toggleJob, deleteScheduledJob, ScheduledJob } from '@/app/actions/schedule';
import { toast } from 'sonner';

interface ServerJobsDialogProps {
    serverId: number;
    serverName: string;
}

export function ServerJobsDialog({ serverId, serverName }: ServerJobsDialogProps) {
    const [open, setOpen] = useState(false);
    const [jobs, setJobs] = useState<ScheduledJob[]>([]);
    const [loading, setLoading] = useState(false);

    // Create Form
    const [createMode, setCreateMode] = useState(false);
    const [newJobType, setNewJobType] = useState<'config' | 'scan'>('scan');
    const [scheduleStr, setScheduleStr] = useState('0 3 * * *');
    const [customName, setCustomName] = useState('');

    useEffect(() => {
        if (open) loadJobs();
    }, [open, serverId]);

    async function loadJobs() {
        setLoading(true);
        try {
            const res = await getJobsForServer(serverId);
            setJobs(res);
        } catch (e) {
            toast.error("Ошибка загрузки задач");
        } finally {
            setLoading(false);
        }
    }

    async function handleToggle(id: number) {
        const res = await toggleJob(id);
        if (res.success) {
            setJobs(jobs.map(j => j.id === id ? { ...j, enabled: res.enabled } : j));
            toast.success(res.enabled ? "Задача активирована" : "Задача деактивирована");
        }
    }

    async function handleDelete(id: number) {
        if (!confirm("Действительно удалить задачу?")) return;
        const res = await deleteScheduledJob(id);
        if (res.success) {
            setJobs(jobs.filter(j => j.id !== id));
            toast.success("Задача удалена");
        }
    }

    async function handleCreate() {
        try {
            let res;
            if (newJobType === 'config') {
                res = await createConfigBackupSchedule(serverId, scheduleStr, customName || undefined);
            } else {
                res = await createScanSchedule(serverId, scheduleStr, customName || undefined);
            }

            if (res.success) {
                toast.success("Задача создана!");
                setCreateMode(false);
                loadJobs();
            } else {
                toast.error(res.error || "Ошибка при создании");
            }
        } catch (e) {
            toast.error("Ошибка: " + e);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Clock className="mr-2 h-4 w-4" />
                    Задачи
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex justify-between items-center">
                        <span>Фоновые задачи: {serverName}</span>
                        {!createMode && (
                            <Button size="sm" onClick={() => setCreateMode(true)}>
                                <Plus className="mr-2 h-4 w-4" /> Запланировать задачу
                            </Button>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {createMode ? (
                    <div className="space-y-4 py-4 border rounded-lg p-4 bg-muted/20">
                        <h3 className="font-semibold">Создать новую задачу</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Тип задачи</Label>
                                <Select value={newJobType} onValueChange={(v: any) => setNewJobType(v)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="scan">🛡️ Сканирование безопасности и состояния (AI)</SelectItem>
                                        <SelectItem value="config">💾 Резервное копирование конфигурации (/etc, pve config)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Интервал</Label>
                                <Select onValueChange={(val) => {
                                    if (val === 'daily') setScheduleStr('0 3 * * *');
                                    if (val === 'weekly') setScheduleStr('0 3 * * 1'); // Monday 3AM
                                    if (val === 'hourly') setScheduleStr('0 * * * *');
                                }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Выберите интервал" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="daily">Ежедневно (03:00)</SelectItem>
                                        <SelectItem value="weekly">Еженедельно (Пн 03:00)</SelectItem>
                                        <SelectItem value="hourly">Ежечасно</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Cron выражение (вручную)</Label>
                            <Input value={scheduleStr} onChange={e => setScheduleStr(e.target.value)} placeholder="* * * * *" className="font-mono" />
                        </div>

                        <div className="space-y-2">
                            <Label>Название (необязательно)</Label>
                            <Input value={customName} onChange={e => setCustomName(e.target.value)} placeholder={`Авто-${newJobType === 'scan' ? 'Сканирование' : 'Бэкап'}`} />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="ghost" onClick={() => setCreateMode(false)}>Отмена</Button>
                            <Button onClick={handleCreate}>Создать</Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {loading ? (
                            <div className="text-center py-10"><RefreshCw className="animate-spin h-6 w-6 mx-auto" /></div>
                        ) : jobs.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">Нет запланированных задач.</div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Тип</TableHead>
                                        <TableHead>Название</TableHead>
                                        <TableHead>Расписание</TableHead>
                                        <TableHead>Активна</TableHead>
                                        <TableHead className="text-right">Действия</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {jobs.map(job => (
                                        <TableRow key={job.id}>
                                            <TableCell>
                                                {job.job_type === 'scan' ? (
                                                    <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-amber-500" /> Сканирование</span>
                                                ) : (
                                                    <span className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-blue-500" /> Бэкап</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium">{job.name}</TableCell>
                                            <TableCell className="font-mono bg-muted/50 px-2 py-1 rounded w-fit">{job.schedule}</TableCell>
                                            <TableCell>
                                                <Switch checked={job.enabled} onCheckedChange={() => handleToggle(job.id)} />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(job.id)}>
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
