'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { useRBAC } from '@/components/providers/rbac-provider'
import { Permission, UserRole } from '@/types/rbac'

// Props for requiring permission
interface RequirePermissionProps {
  permission: Permission
  children: React.ReactNode
  fallback?: React.ReactNode
}

// Component to render content only if user has specific permission
export function RequirePermission({
  permission,
  children,
  fallback = null
}: RequirePermissionProps) {
  const { hasPermission, isLoading } = useRBAC()

  // Don't render anything while loading
  if (isLoading) return null

  // Render children if user has permission, otherwise render fallback
  return hasPermission(permission) ? <>{children}</> : <>{fallback}</>
}

// Props for requiring a role
interface RequireRoleProps {
  role: UserRole
  children: React.ReactNode
  fallback?: React.ReactNode
}

// Component to render content only if user has specific role
export function RequireRole({
  role,
  children,
  fallback = null
}: RequireRoleProps) {
  const { hasRole, isLoading } = useRBAC()

  // Don't render anything while loading
  if (isLoading) return null

  // Render children if user has role, otherwise render fallback
  return hasRole(role) ? <>{children}</> : <>{fallback}</>
}

// Props for requiring authentication
interface RequireAuthProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

// Component to render content only if user is authenticated
export function RequireAuth({ children, fallback = null }: RequireAuthProps) {
  const { isAuthenticated, isLoading } = useRBAC()

  // Don't render anything while loading
  if (isLoading) return null

  // Render children if user is authenticated, otherwise render fallback
  return isAuthenticated ? <>{children}</> : <>{fallback}</>
}

// Props for a page that requires admin access
interface AdminPageGuardProps {
  readonly children: React.ReactNode
}

// Component to guard an entire page that requires admin access
export function AdminPageGuard({ children }: AdminPageGuardProps) {
  const { isAdmin, isLoading } = useRBAC()
  const router = useRouter()

  useEffect(() => {
    // Wait until loading is complete before redirecting
    if (!isLoading && !isAdmin) {
      router.push('/unauthorized')
    }
  }, [isAdmin, isLoading, router])

  // Don't render anything while loading or if not admin
  if (isLoading || !isAdmin) return null

  // Render children if user is admin
  return <>{children}</>
}
