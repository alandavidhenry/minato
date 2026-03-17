// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'

import { initActivityLogsTable } from '@/lib/activity-logger'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)

initActivityLogsTable().catch(console.error)

export { handler as GET, handler as POST }
