// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth'
import AzureADProvider from 'next-auth/providers/azure-ad'
import CredentialsProvider from 'next-auth/providers/credentials'

import { UserRole } from '@/types/rbac'

import { verifyUserCredentials } from './user-database'

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

        // Verify credentials against your Azure database
        const user = await verifyUserCredentials(
          credentials.email,
          credentials.password
        )

        if (user) {
          return {
            id: user.id,
            name: user.displayName,
            email: user.email,
            roles: [user.role as UserRole]
          }
        }

        return null
      }
    }),
    // Keep Azure AD for admin/employee users
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      authorization: {
        params: { scope: 'openid profile email User.Read' }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        // For Credentials provider
        if (account.provider === 'credentials') {
          token.roles = user.roles
          token.id = user.id
        }
        // For Azure AD provider (your existing code)
        else if (account.provider === 'azure-ad') {
          token.roles = getRolesFromAzureADToken(token)
          token.id = user.id
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id
        session.user.roles = token.roles
      } else {
        session.user.roles = [UserRole.CUSTOMER]
      }

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

// Your existing function to get roles from Azure AD token
function getRolesFromAzureADToken(token: any): UserRole[] {
  // Your existing code
  const azureRoles = (token.roles as string[]) || []
  const mappedRoles: UserRole[] = []

  // Check for admin role
  if (
    azureRoles.includes('Administrator') ||
    token.email === process.env.DEFAULT_ADMIN_EMAIL
  ) {
    mappedRoles.push(UserRole.ADMIN)
  }
  // Check for employee role
  else if (
    azureRoles.includes('Employee') ||
    token.email?.endsWith('@yourcompany.com')
  ) {
    mappedRoles.push(UserRole.EMPLOYEE)
  }
  // Default to customer role
  else {
    mappedRoles.push(UserRole.CUSTOMER)
  }

  return mappedRoles
}
