import { DefaultSession } from 'next-auth'

import { UserRole } from './rbac'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      roles: UserRole[]
      customerCompanyId: string | null
      jobRole: string | null
    } & DefaultSession['user']
  }

  interface User {
    roles: UserRole[]
    customerCompanyId: string | null
    jobRole: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    roles: UserRole[]
    customerCompanyId: string | null
    jobRole: string | null
  }
}
