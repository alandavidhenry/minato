'use client'

import { AdminPageGuard } from '@/components/auth/permission-guard'

export default function AdminLayout({
  children
}: {
  readonly children: React.ReactNode
}) {
  return <AdminPageGuard>{children}</AdminPageGuard>
}
