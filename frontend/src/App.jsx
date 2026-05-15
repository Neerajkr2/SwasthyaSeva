import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import ErrorBoundary  from './components/common/ErrorBoundary'
import LoadingSpinner from './components/common/LoadingSpinner'

// ── Critical (initial paint) ───────────────────────────────────────────────
// LandingPage is the most-hit route — keep it eager to avoid first-paint flash.
import LandingPage from './pages/LandingPage'

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
  const { user, loading } = useAuth()
  if (loading) return <LoadingSpinner fullScreen />
  if (!user)   return <Navigate to="/" replace />
  return children
}

// ── Admin Route Wrapper (server-side enforces; this is a UX guard) ─────────
function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <LoadingSpinner fullScreen />
  if (!user)   return <Navigate to="/" replace />
  if (profile && !['admin', 'superadmin'].includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner fullScreen />}>
        <Routes>
          <Route path="/"                element={<LandingPage />} />
          <Route path="/dashboard"       element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/chat"            element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/symptoms"        element={<ProtectedRoute><SymptomCheckerPage /></ProtectedRoute>} />
          <Route path="/drugs"           element={<ProtectedRoute><DrugInteractionPage /></ProtectedRoute>} />
          <Route path="/report-analyzer" element={<ProtectedRoute><ReportAnalyzerPage /></ProtectedRoute>} />
          <Route path="/profile"         element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/insights"        element={<ProtectedRoute><HealthInsightsPage /></ProtectedRoute>} />
          <Route path="/doctors"         element={<ProtectedRoute><DoctorPortalPage /></ProtectedRoute>} />
          <Route path="/admin"           element={<AdminRoute><AdminPage /></AdminRoute>} />
          <Route path="*"                element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
