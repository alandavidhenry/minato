// src/components/nav-bar.tsx
'use client'

import { Menu, Shield } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useState, ReactNode } from 'react'

import { useRBAC } from '@/components/providers/rbac-provider'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'

// Define a proper interface for navigation items
interface NavItem {
  name: string
  href: string
  icon?: ReactNode
}

// Define navigation items
const commonNavItems: NavItem[] = [
  { name: 'Home', href: '/' },
  { name: 'Documents', href: '/documents' }
]

export function NavBar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { isAdmin } = useRBAC()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Function to handle sign in with explicit callback URL
  const handleSignIn = () => {
    signIn('azure-ad', { callbackUrl: '/documents' })
  }

  // Get navigation items conditionally based on admin status
  const navItems: NavItem[] = [
    ...commonNavItems,
    // Add admin dashboard link for administrators
    ...(isAdmin
      ? [
          {
            name: 'Admin',
            href: '/admin',
            icon: <Shield className='h-4 w-4 mr-1' />
          }
        ]
      : [])
  ]

  return (
    <nav className='bg-background border-b'>
      <div className='container mx-auto px-4'>
        <div className='flex h-16 items-center justify-between'>
          {/* Logo/Brand */}
          <div className='shrink-0'>
            <Link href='/' className='text-xl font-bold'>
              Document Portal
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className='hidden md:flex md:items-center md:space-x-4'>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center
                  ${
                    pathname === item.href ||
                    pathname?.startsWith(item.href + '/')
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  }`}
              >
                {item.icon}
                {item.name}
              </Link>
            ))}
          </div>

          {/* Theme Toggle and Auth Button */}
          <div className='hidden md:flex md:items-center md:space-x-2'>
            <ThemeToggle />
            {session ? (
              <Button variant='outline' onClick={() => signOut()}>
                Sign Out
              </Button>
            ) : (
              <Button onClick={handleSignIn}>Sign In</Button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className='md:hidden flex items-center space-x-2'>
            <ThemeToggle />
            <Button
              variant='ghost'
              size='icon'
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className='h-10 w-10'
            >
              <Menu className='h-6 w-6' />
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className='md:hidden py-4 space-y-2 border-t animate-in slide-in-from-top'>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
                  ${
                    pathname === item.href ||
                    pathname?.startsWith(item.href + '/')
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.icon}
                {item.name}
              </Link>
            ))}
            <div className='pt-2 px-2'>
              {session ? (
                <Button
                  variant='outline'
                  className='w-full'
                  onClick={() => signOut()}
                >
                  Sign Out
                </Button>
              ) : (
                <Button
                  className='w-full py-3 text-base'
                  onClick={handleSignIn}
                >
                  Sign In
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
