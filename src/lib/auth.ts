import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

import { UserRole } from '@/types/rbac'

import { getUserById, verifyUserCredentials } from './user-database'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email and Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await verifyUserCredentials(
          credentials.email,
          credentials.password
        )

        if (user) {
          return {
            id: user.id,
            name: user.displayName,
            email: user.email,
            roles: [user.role as UserRole],
            customerCompanyId: user.customerCompanyId
          }
        }

        return null
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign in — write fields from the authorize() return value
        token.id = user.id
        token.roles = user.roles
        token.customerCompanyId = user.customerCompanyId
      } else if (token.id) {
        // Subsequent requests — refresh mutable fields from the database so
        // changes made by admins (role, company assignment) are reflected
        // without requiring the user to sign out and back in.
        const dbUser = await getUserById(token.id)
        if (dbUser) {
          token.roles = [dbUser.role as UserRole]
          token.customerCompanyId = dbUser.customerCompanyId
        }
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.roles = token.roles
      session.user.customerCompanyId = token.customerCompanyId
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error'
  },
  session: {
    strategy: 'jwt'
  }
}
