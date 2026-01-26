import { NextResponse } from 'next/server';
import { getServerStorages } from '@/lib/actions/storage';

export async function GET() {
    const stats = await getServerStorages();
    return NextResponse.json(stats);
}
