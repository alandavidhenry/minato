'use client'

import { Building2, FileText, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { useNavGroups } from '@/components/app-sidebar'
import { useRBAC } from '@/components/providers/rbac-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'

interface Entity {
  id: string
  name: string
}

// Admin-only lookups, fetched once on first open rather than on every mount.
async function fetchEntities(url: string, key: string): Promise<Entity[]> {
  try {
    const response = await fetch(url)
    if (!response.ok) return []

    const data = await response.json()
    const rows: unknown = data[key]
    if (!Array.isArray(rows)) return []

    return rows
      .map((row) => row as { id?: string; name?: string; title?: string })
      .filter((row) => Boolean(row.id))
      .map((row) => ({
        id: row.id as string,
        name: row.name ?? row.title ?? ''
      }))
      .filter((row) => row.name !== '')
  } catch {
    return []
  }
}

export function CommandPalette() {
  const router = useRouter()
  const groups = useNavGroups()
  const { isAdmin } = useRBAC()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [isMac, setIsMac] = useState(false)
  const [companies, setCompanies] = useState<Entity[]>([])
  const [templates, setTemplates] = useState<Entity[]>([])

  // Resolved after mount so the server and client markup agree.
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes('MAC'))
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'k' || !(event.metaKey || event.ctrlKey)) return
      event.preventDefault()
      setOpen((value) => !value)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!open || loaded || !isAdmin) return
    setLoaded(true)

    void Promise.all([
      fetchEntities('/api/admin/companies', 'companies'),
      fetchEntities('/api/admin/templates', 'templates')
    ]).then(([nextCompanies, nextTemplates]) => {
      setCompanies(nextCompanies)
      setTemplates(nextTemplates)
    })
  }, [open, loaded, isAdmin])

  const go = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router]
  )

  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        aria-label='Search'
        className='flex h-8 items-center gap-2 rounded-md border border-input bg-field px-2 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground'
      >
        <Search className='h-4 w-4 shrink-0' />
        <span className='hidden sm:inline'>Search…</span>
        <kbd className='hidden rounded border border-border px-1 font-mono text-[10px] sm:inline'>
          {isMac ? '⌘' : 'Ctrl '}K
        </kbd>
      </button>

      <CommandDialog label='Search' open={open} onOpenChange={setOpen}>
        <CommandInput placeholder='Search pages, companies and templates…' />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {groups.map((group) => (
            <CommandGroup key={group.id} heading={group.label}>
              {group.items.map((item) => {
                const Icon = item.icon

                return (
                  <CommandItem
                    key={item.href}
                    value={`${group.label} ${item.name}`}
                    onSelect={() => go(item.href)}
                  >
                    <Icon />
                    {item.name}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ))}

          {companies.length > 0 && (
            <CommandGroup heading='Companies'>
              {companies.map((company) => (
                <CommandItem
                  key={company.id}
                  value={`company ${company.name}`}
                  onSelect={() => go(`/admin/companies/${company.id}`)}
                >
                  <Building2 />
                  {company.name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {templates.length > 0 && (
            <CommandGroup heading='Templates'>
              {templates.map((template) => (
                <CommandItem
                  key={template.id}
                  value={`template ${template.name}`}
                  onSelect={() => go('/admin/templates')}
                >
                  <FileText />
                  {template.name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
