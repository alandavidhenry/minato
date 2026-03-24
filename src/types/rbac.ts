export enum UserRole {
  ADMIN = 'Administrator',
  EMPLOYEE = 'Employee',
  CUSTOMER = 'Customer'
}

export enum Permission {
  // Document permissions
  VIEW_DOCUMENTS = 'view:documents',
  UPLOAD_DOCUMENTS = 'upload:documents',
  DOWNLOAD_DOCUMENTS = 'download:documents',
  DELETE_DOCUMENTS = 'delete:documents',
  SHARE_DOCUMENTS = 'share:documents',

  // User management permissions
  VIEW_USERS = 'view:users',
  CREATE_USERS = 'create:users',
  UPDATE_USERS = 'update:users',
  DELETE_USERS = 'delete:users',
  ASSIGN_ROLES = 'assign:roles',

  // Settings permissions
  EDIT_SETTINGS = 'edit:settings',
  VIEW_SETTINGS = 'view:settings'
}

export const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  [UserRole.ADMIN]: [
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
    Permission.VIEW_DOCUMENTS,
    Permission.UPLOAD_DOCUMENTS,
    Permission.DOWNLOAD_DOCUMENTS,
    Permission.DELETE_DOCUMENTS,
    Permission.SHARE_DOCUMENTS,
    Permission.VIEW_USERS,
    Permission.VIEW_SETTINGS
  ],
  [UserRole.CUSTOMER]: [Permission.VIEW_DOCUMENTS]
}

export interface RBACUser {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  roles: UserRole[]
}

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
  return user.roles.some((role) => ROLE_PERMISSIONS[role].includes(permission))
}
