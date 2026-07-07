// src/app/page.tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { ADMIN_ROLES, UserRole } from '@/types/rbac'

// The landing route sends each role to its natural home. There is no standalone
// home page — the relevant dashboard/list is the home page.
export default async function Home() {
  const session = await getServerSession(authOptions)
  const roles = session?.user?.roles ?? []

  if (!session?.user) redirect('/auth/signin')

  if (roles.some((role) => ADMIN_ROLES.includes(role))) redirect('/admin')
  if (roles.includes(UserRole.CUSTOMER_ADMIN)) {
    redirect('/customer/admin/completions')
  }
  if (roles.includes(UserRole.CUSTOMER_USER)) redirect('/customer/documents')
  if (roles.includes(UserRole.TENANT_STAFF)) redirect('/documents')

  redirect('/auth/signin')
}
