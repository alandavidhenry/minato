// src/types/next-auth.ts
import { DefaultSession } from 'next-auth'

import { UserRole } from './rbac'

// Extend the built-in session types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      roles: UserRole[]
    } & DefaultSession['user']
  }

  interface User {
    roles: UserRole[]
  }
}

// Extend the JWT type
declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    roles: UserRole[]
  }
}
