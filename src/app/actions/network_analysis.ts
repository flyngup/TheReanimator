'use server';

import db from '@/lib/db';
import { getNetworkConfig } from './network';
import { explainNetworkConfig, getAISettings } from './ai';
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

export interface AnalysisResult {
    id: number;
    server_id: number;
    type: 'network';
    content: string;
    created_at: string;
}

export async function getLatestNetworkAnalysis(serverId: number): Promise<AnalysisResult | null> {
    const row = db.prepare(`
        SELECT * FROM server_ai_analysis 
        WHERE server_id = ? AND type = 'network' 
        ORDER BY created_at DESC LIMIT 1
    `).get(serverId) as any;

    if (!row) return null;
    return row as AnalysisResult;
}

export async function runNetworkAnalysis(serverId: number): Promise<string> {
    console.log(`[AI Analysis] Starting Network Analysis for Server ${serverId}...`);

    const settings = await getAISettings();
    if (!settings.enabled) throw new Error('KI-Funktionen sind deaktiviert.');

    try {
        // 1. Fetch Config
        const config = await getNetworkConfig(serverId);
        if (!config.success || !config.interfaces) {
            const errorMsg = config.error || 'Netzwerkkonfiguration konnte nicht abgerufen werden';
            console.error(`[AI Analysis] Config fetch failed: ${errorMsg}`);
            throw new Error(`Konfigurationsfehler: ${errorMsg}`);
        }

        // Ensure we have valid interfaces data
        if (!Array.isArray(config.interfaces) || config.interfaces.length === 0) {
            throw new Error('Keine Netzwerk-Interfaces gefunden');
        }

        // 2. AI Analysis
        let analysisResult;
        try {
            analysisResult = await explainNetworkConfig(config.interfaces);
        } catch (aiError: any) {
            console.error(`[AI Analysis] AI processing failed:`, aiError);
            const aiT = await t('actionsAI');
            throw new Error(`${aiT('networkAnalysisFailed')}: ${aiError.message}`);
        }

        // Serialize for DB/Frontend
        const analysisContent = JSON.stringify(analysisResult);

        // 3. Save to DB
        try {
            const stmt = db.prepare(`
                INSERT INTO server_ai_analysis (server_id, type, content)
                VALUES (?, 'network', ?)
            `);
            stmt.run(serverId, analysisContent);
        } catch (dbError: any) {
            console.error(`[AI Analysis] DB save failed:`, dbError);
            // Still return the explanation even if save fails
            console.warn('[AI Analysis] Returning result despite DB save failure');
            return analysisContent;
        }

        console.log(`[AI Analysis] Completed & Saved for Server ${serverId}.`);
        return analysisContent;

    } catch (error: any) {
        console.error(`[AI Analysis] Failed for Server ${serverId}:`, error);
        throw error; // Re-throw with improved error message
    }
}
