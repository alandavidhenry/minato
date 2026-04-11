export enum UserRole {
  PLATFORM_ADMIN = 'Platform Admin',
  TENANT_ADMIN = 'Tenant Admin',
  TENANT_STAFF = 'Tenant Staff',
  CUSTOMER_ADMIN = 'Customer Admin',
  CUSTOMER_USER = 'Customer User'
}

// Roles that have access to the admin portal
export const ADMIN_ROLES: readonly UserRole[] = [
  UserRole.PLATFORM_ADMIN,
  UserRole.TENANT_ADMIN
]

// Roles for client-company users
export const CUSTOMER_ROLES: readonly UserRole[] = [
  UserRole.CUSTOMER_ADMIN,
  UserRole.CUSTOMER_USER
]

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

export const ROLE_PERMISSIONS: Readonly<
  Record<UserRole, readonly Permission[]>
> = {
  [UserRole.PLATFORM_ADMIN]: [
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
  [UserRole.TENANT_ADMIN]: [
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
  [UserRole.TENANT_STAFF]: [
    Permission.VIEW_DOCUMENTS,
    Permission.UPLOAD_DOCUMENTS,
    Permission.DOWNLOAD_DOCUMENTS,
    Permission.DELETE_DOCUMENTS,
    Permission.SHARE_DOCUMENTS,
    Permission.VIEW_USERS,
    Permission.VIEW_SETTINGS
  ],
  [UserRole.CUSTOMER_ADMIN]: [
    Permission.VIEW_DOCUMENTS,
    Permission.DOWNLOAD_DOCUMENTS,
    Permission.VIEW_USERS
  ],
  [UserRole.CUSTOMER_USER]: [
    Permission.VIEW_DOCUMENTS,
    Permission.DOWNLOAD_DOCUMENTS
  ]
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
  return user.roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission))
}
