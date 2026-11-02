import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Liveness probe for App Service and uptime checks. It never touches the database, so a database outage cannot restart healthy servers. */
export function GET() {
  return NextResponse.json({ status: 'ok', app: 'rgs-portal', env: process.env.APP_ENV ?? 'dev', time: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
}
