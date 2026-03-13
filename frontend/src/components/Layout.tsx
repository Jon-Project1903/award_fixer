import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FileCheck2 } from 'lucide-react'

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const isHome = location.pathname === '/'

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-gray-900 font-semibold text-lg no-underline">
            <FileCheck2 className="w-6 h-6 text-blue-600" />
            Patent Awards
          </Link>
          {!isHome && (
            <Link to="/" className="ml-4 text-sm text-blue-600 hover:text-blue-800 no-underline">
              All Projects
            </Link>
          )}
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        {children}
      </main>
    </div>
  )
}
