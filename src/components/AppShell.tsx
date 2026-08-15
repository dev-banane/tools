import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { TopBar } from './TopBar'
import { Toaster } from './ui/Toaster'

export function AppShell() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <TopBar
        href={isHome ? 'https://devjakob.com' : '/'}
        label={isHome ? 'devjakob.com' : 'All tools'}
        width="48rem"
        external={isHome}
      />
      <Outlet />
      <Toaster />
    </>
  )
}
