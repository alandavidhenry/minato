'use client'

import { useSession } from 'next-auth/react'
import { createContext, useContext, useMemo } from 'react'

import {
  Permission,
  UserRole,
  hasPermission,
  hasRole,
  RBACUser
} from '@/types/rbac'

// Define the context shape
interface RBACContextType {
  user: RBACUser | null
  isAdmin: boolean
  isAuthenticated: boolean
  isLoading: boolean
  hasPermission: (permission: Permission) => boolean
  hasRole: (role: UserRole) => boolean
}

// Create the context with a default value
const RBACContext = createContext<RBACContextType>({
  user: null,
  isAdmin: false,
  isAuthenticated: false,
  isLoading: true,
  hasPermission: () => false,
  hasRole: () => false
})

// Hook to use the RBAC context
export const useRBAC = () => useContext(RBACContext)

// RBAC Provider component
export function RBACProvider({
  children
}: {
  readonly children: React.ReactNode
}) {
  const { data: session, status } = useSession()

  // Memoize the user object to prevent it from changing on every render
  const user = useMemo<RBACUser | null>(() => {
    if (!session?.user) return null

    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
      roles: session.user.roles || [UserRole.CUSTOMER]
    }
  }, [session?.user])

  // Determine if the user is an admin (memoized)
  const isAdmin = useMemo(() => {
    return user ? hasRole(user, UserRole.ADMIN) : false
  }, [user])

  // Check if the user is authenticated
  const isAuthenticated = status === 'authenticated'

  // Check if still loading authentication data
  const isLoading = status === 'loading'

  // Create the memoized context value with the check functions defined inside
  const contextValue = useMemo(() => {
    // Define functions inside the useMemo to avoid recreating them on each render
    const checkPermission = (permission: Permission) => {
      return hasPermission(user, permission)
    }

    const checkRole = (role: UserRole) => {
      return hasRole(user, role)
    }

    return {
      user,
      isAdmin,
      isAuthenticated,
      isLoading,
      hasPermission: checkPermission,
      hasRole: checkRole
    }
  }, [user, isAdmin, isAuthenticated, isLoading])

  return (
    <RBACContext.Provider value={contextValue}>{children}</RBACContext.Provider>
  )
}
