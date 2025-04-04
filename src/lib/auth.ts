// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth'
import { JWT } from 'next-auth/jwt'
import AzureADProvider from 'next-auth/providers/azure-ad'

import { UserRole } from '@/types/rbac'

// Function to extract roles from Azure AD token
function getRolesFromAzureADToken(token: JWT): UserRole[] {
  // Add debug logging to see what's in the token
  console.log('Token data for role extraction:', {
    roles: token.roles,
    email: token.email
  })

  // Check for roles claim from Azure AD
  const azureRoles = (token.roles as string[]) || []

  // Map Azure AD roles to our application roles
  const mappedRoles: UserRole[] = []

  // Safely check if appRoleAssignments exists and is an array
  const appRoleAssignments = Array.isArray(token.appRoleAssignments)
    ? token.appRoleAssignments
    : []

  // If user has the Administrator role in Azure AD, they're an admin
  if (
    azureRoles.includes('Administrator') ||
    token.email === process.env.DEFAULT_ADMIN_EMAIL ||
    // Check app role assignments if available
    appRoleAssignments.some(
      (role) => role.appRoleId === process.env.AZURE_AD_ADMIN_ROLE_ID
    )
  ) {
    mappedRoles.push(UserRole.ADMIN)
  } else if (
    azureRoles.length > 0 ||
    // Check for user role assignment
    appRoleAssignments.some(
      (role) => role.appRoleId === process.env.AZURE_AD_USER_ROLE_ID
    )
  ) {
    // If they have any role, they're at least a regular user
    mappedRoles.push(UserRole.USER)
  } else {
    // Default role if no specific roles are assigned
    mappedRoles.push(UserRole.GUEST)
  }

  return mappedRoles
}

// NextAuth configuration with callbacks to handle roles
export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      authorization: {
        params: { scope: 'openid profile email User.Read Directory.Read.All' }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Initial sign in
      if (account && profile) {
        token.roles = getRolesFromAzureADToken(token)
        token.id = profile.sub ?? (profile as any).oid ?? token.sub ?? ''
      }

      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id
        session.user.roles = token.roles
      } else {
        session.user.roles = [UserRole.GUEST]
      }

      return session
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`
      } else if (url.startsWith(baseUrl)) {
        return url
      }
      return baseUrl
    }
  },
  pages: { signIn: '/auth/signin', error: '/auth/error' }
}

// Get the default admin email from environment or use a fallback
export function getDefaultAdminEmail(): string {
  return process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@yourdomain.com'
}
