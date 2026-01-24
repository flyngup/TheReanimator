'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Activity, Loader2, Sparkles } from "lucide-react";
import { scanEntireInfrastructure } from '@/app/actions/scan';
import { getAISettings } from '@/app/actions/ai';
import { toast } from 'sonner';

export function GlobalScanButton() {
    const [scanning, setScanning] = useState(false);
    const [aiEnabled, setAiEnabled] = useState(true);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        getAISettings().then(s => {
            setAiEnabled(s.enabled);
            setChecking(false);
        });
    }, []);

    if (!checking && !aiEnabled) return null;

    async function handleScan() {
        if (!confirm('Сканировать всю инфраструктуру? Это может занять время.')) return;

        setScanning(true);
        const toastId = toast.loading('Запуск глобального сканирования...');

        try {
            const res = await scanEntireInfrastructure();
            if (res.success) {
                toast.success(`Сканирование запущено!`, {
                    id: toastId,
                    description: `Сканирование выполняется в фоне. Проверьте задачи для деталей.`
                });
            } else {
                toast.error('Ошибка сканирования: ' + res.error, { id: toastId });
            }
        } catch (e: any) {
            toast.error('Ошибка: ' + e.message, { id: toastId });
        } finally {
            setScanning(false);
        }
    }

    return (
        <Button onClick={handleScan} disabled={scanning} variant="default" className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
            Глобальное сканирование
        </Button>
    );
}
