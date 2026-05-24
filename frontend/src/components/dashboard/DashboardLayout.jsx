// src/components/dashboard/DashboardLayout.jsx
/**
 * Persistent dashboard shell.
 *
 * Renders the sidebar and mobile bottom-nav ONCE and swaps only the page
 * content through <Outlet/>. Because this layout is the element of the parent
 * route, React Router keeps it mounted while navigating between child routes —
 * so the sidebar never unmounts, never scrolls back to the top, and never
 * flickers. Lazy page chunks are caught by the content-scoped <Suspense/>
 * below, which keeps the sidebar visible while the next page loads.
 */
import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import DashboardSidebar from './DashboardSidebar'
import MobileBottomNav from '../common/MobileBottomNav'

function ContentFallback() {
  return (
    <main className="flex-1 min-h-screen flex items-center justify-center">
      <div
        className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: '#E6EEF5', borderTopColor: '#0F4C81' }}
        role="status"
        aria-label="Loading"
      />
    </main>
  )
}

export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen" style={{ background: '#F8FBFD' }}>
      {/* Persistent — mounted once, never re-rendered on route change */}
      <DashboardSidebar />

      {/* Only this region swaps when navigating between feature pages */}
      <Suspense fallback={<ContentFallback />}>
        <Outlet />
      </Suspense>

      {/* Persistent mobile bottom navigation */}
      <MobileBottomNav />
    </div>
  )
}
