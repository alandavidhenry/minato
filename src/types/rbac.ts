// User roles in the application
export enum UserRole {
  ADMIN = 'Administrator',
  EMPLOYEE = 'Employee',
  CUSTOMER = 'Customer'
}

// Different permission actions possible in the system
export enum Permission {
  // Document permissions
  VIEW_DOCUMENTS = 'view:documents',
  UPLOAD_DOCUMENTS = 'upload:documents',
  DOWNLOAD_DOCUMENTS = 'download:documents',
  DELETE_DOCUMENTS = 'delete:documents',
  SHARE_DOCUMENTS = 'share:documents',

  // Admin permissions
  VIEW_USERS = 'view:users',
  CREATE_USERS = 'create:users',
  UPDATE_USERS = 'update:users',
  DELETE_USERS = 'delete:users',
  ASSIGN_ROLES = 'assign:roles',

  // Settings permissions
  EDIT_SETTINGS = 'edit:settings',
  VIEW_SETTINGS = 'view:settings'
}

// Mapping of roles to permissions
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    // Admin has all permissions
    Permission.VIEW_DOCUMENTS,
    Permission.UPLOAD_DOCUMENTS,
    Permission.DOWNLOAD_DOCUMENTS,
    Permission.DELETE_DOCUMENTS,
    Permission.SHARE_DOCUMENTS,
    Permission.VIEW_USERS,
    Permission.CREATE_USERS,
    Permission.UPDATE_USERS,
    Permission.DELETE_USERS,
    Permission.ASSIGN_ROLES,
    Permission.EDIT_SETTINGS,
    Permission.VIEW_SETTINGS
  ],
  [UserRole.EMPLOYEE]: [
    // Regular users can work with documents but not admin features
    Permission.VIEW_DOCUMENTS,
    Permission.UPLOAD_DOCUMENTS,
    Permission.DOWNLOAD_DOCUMENTS,
    Permission.DELETE_DOCUMENTS,
    Permission.SHARE_DOCUMENTS,
    Permission.VIEW_USERS,
    Permission.VIEW_SETTINGS
  ],
  [UserRole.CUSTOMER]: [
    // Guests can only view documents
    Permission.VIEW_DOCUMENTS
  ]
}

// Extended user type with roles
export interface RBACUser {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  roles: UserRole[]
}

// Functions to check permissions
export function hasRole(
  user: RBACUser | undefined | null,
  role: UserRole
): boolean {
  if (!user) return false
  return user.roles.includes(role)
}

export function hasPermission(
  user: RBACUser | undefined | null,
  permission: Permission
): boolean {
  if (!user) return false

  // Check if any of the user's roles grant this permission
  return user.roles.some((role) => ROLE_PERMISSIONS[role].includes(permission))
}
