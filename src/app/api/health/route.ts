// src/app/api/health/route.ts
import { NextResponse } from 'next/server'

// Liveness check only — no DB/storage calls. This is the path Azure App
// Service's built-in health monitor pings continuously (~every 60s, for the
// lifetime of the app), so it must stay cheap: a real DB query here would
// keep the Neon compute endpoint awake around the clock and defeat
// autosuspend. Dependency checks live at GET /api/health/deep, used only by
// the CI/CD smoke test.
export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
