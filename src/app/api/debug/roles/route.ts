// src/app/api/debug/roles/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    adminRoleId: process.env.AZURE_AD_ADMIN_ROLE_ID,
    userRoleId: process.env.AZURE_AD_USER_ROLE_ID,
    clientId: process.env.AZURE_AD_CLIENT_ID
  })
}
