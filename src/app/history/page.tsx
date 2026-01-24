import db from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

export const dynamic = 'force-dynamic';

function getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
        'success': 'Успешно',
        'failed': 'Ошибка',
        'running': 'Выполняется'
    };
    return statusMap[status] || status;
}

export default function HistoryPage() {
    const history = db.prepare(`
    SELECT h.*, j.name as job_name 
    FROM history h 
    JOIN jobs j ON h.job_id = j.id 
    ORDER BY start_time DESC 
    LIMIT 100
  `).all() as any[];

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">История выполнения</h2>
                <p className="text-muted-foreground mt-1">Журнал всех операций бэкапа и синхронизации.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Журнал задач</CardTitle>
                    <CardDescription>Просмотр последних 100 выполнений.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {history.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">История пока недоступна.</div>
                        ) : (
                            history.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        {item.status === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                                        {item.status === 'failed' && <XCircle className="h-5 w-5 text-destructive" />}
                                        {item.status === 'running' && <Clock className="h-5 w-5 text-blue-500 animate-pulse" />}

                                        <div>
                                            <p className="font-medium">{item.job_name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Начало: {new Date(item.start_time).toLocaleString()}
                                                {item.end_time && ` • Длительность: ${Math.round((new Date(item.end_time).getTime() - new Date(item.start_time).getTime()) / 1000)}с`}
                                            </p>
                                            {item.log && (
                                                <p className="text-xs text-destructive mt-1 font-mono bg-destructive/10 p-1 rounded max-w-xl truncate">
                                                    Ошибка: {item.log}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${item.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                                                item.status === 'failed' ? 'bg-destructive/10 text-destructive' :
                                                    'bg-blue-500/10 text-blue-500'
                                            }`}>
                                            {getStatusText(item.status)}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
