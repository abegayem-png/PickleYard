import type { ReactNode } from 'react'
import Header from './Header'
import Footer from './Footer'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-court-950">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
