import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { getStoredToken } from './services/api'
import ErrorBoundary  from './components/common/ErrorBoundary'
import LoadingSpinner from './components/common/LoadingSpinner'

// ── Critical (initial paint) ───────────────────────────────────────────────
// LandingPage is the most-hit route — keep it eager to avoid first-paint flash.
import LandingPage from './pages/LandingPage'

// DashboardLayout is the persistent app shell (sidebar + bottom nav). It must
// be eager so the shell paints instantly and stays mounted across navigation.
import DashboardLayout from './components/dashboard/DashboardLayout'

// ── Lazy-loaded (code-split per route) ─────────────────────────────────────
// Reduces initial JS bundle by deferring app-only pages until navigation.
const DashboardPage       = lazy(() => import('./pages/DashboardPage'))
const ChatPage            = lazy(() => import('./pages/ChatPage'))
const SymptomCheckerPage  = lazy(() => import('./pages/SymptomCheckerPage'))
const DrugInteractionPage = lazy(() => import('./pages/DrugInteractionPage'))
const ReportAnalyzerPage  = lazy(() => import('./pages/ReportAnalyzerPage'))
const ProfilePage         = lazy(() => import('./pages/ProfilePage'))
const HealthInsightsPage  = lazy(() => import('./pages/HealthInsightsPage'))
const AdminPage           = lazy(() => import('./pages/AdminPage'))
const DoctorPortalPage    = lazy(() => import('./pages/DoctorPortalPage'))
const NotFoundPage        = lazy(() => import('./pages/NotFoundPage'))

// ── Protected Route Wrapper ────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { loading } = useAuth()
  if (loading) return <LoadingSpinner fullScreen />
  // Auth = presence of our backend JWT (the real session), not the Firebase
  // user object, which may not survive a cross-domain redirect sign-in.
  if (!getStoredToken()) return <Navigate to="/" replace />
  return children
}

// ── Admin Route Wrapper (server-side enforces; this is a UX guard) ─────────
function AdminRoute({ children }) {
  const { profile, loading } = useAuth()
  if (loading) return <LoadingSpinner fullScreen />
  if (!getStoredToken()) return <Navigate to="/" replace />
  if (profile && !['admin', 'superadmin'].includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const { finishingOAuth } = useAuth()

  // Returning from a Google *redirect* sign-in lands on "/". Show a branded
  // loader instead of the landing page so the user gets clear feedback (and no
  // flash) while the token exchange completes — then we navigate to /dashboard.
  if (finishingOAuth) return <LoadingSpinner fullScreen label="Completing sign-in…" />

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner fullScreen />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />

          {/* Persistent dashboard shell — the sidebar/bottom-nav stay mounted
              while only the page content swaps inside the layout's Outlet. */}
          <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route path="/dashboard"       element={<DashboardPage />} />
            <Route path="/chat"            element={<ChatPage />} />
            <Route path="/symptoms"        element={<SymptomCheckerPage />} />
            <Route path="/drugs"           element={<DrugInteractionPage />} />
            <Route path="/report-analyzer" element={<ReportAnalyzerPage />} />
            <Route path="/profile"         element={<ProfilePage />} />
            <Route path="/insights"        element={<HealthInsightsPage />} />
            <Route path="/doctors"         element={<DoctorPortalPage />} />
          </Route>

          {/* Admin shares the same persistent shell, behind the admin guard. */}
          <Route element={<AdminRoute><DashboardLayout /></AdminRoute>}>
            <Route path="/admin"           element={<AdminPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
