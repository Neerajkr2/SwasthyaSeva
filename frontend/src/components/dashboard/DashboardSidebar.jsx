// src/components/dashboard/DashboardSidebar.jsx
/**
 * Dashboard sidebar — fully brand-cohesive
 *
 * Every nav item routes via a URL (no internal-tab callback dependency).
 * Sub-tabs inside the Dashboard page are addressed via `?tab=<id>` query
 * params. This makes the sidebar work IDENTICALLY across every feature
 * page (Chat, Insights, Profile, Doctor portal, etc.) — no broken links.
 *
 * The logo always navigates to the landing page ("/").
 */
import { memo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  FiHome, FiMessageSquare, FiActivity, FiFileText, FiBarChart2,
  FiShield, FiStar, FiLogOut, FiUserPlus, FiHeart, FiClock,
  FiChevronRight, FiArrowRight, FiUser,
} from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import { LogoFull } from '../common/Logo'

/* ── Nav configuration — every item is path-based ────────────────────────── */
const WORKSPACE_ITEMS = [
  { icon: FiHome,          label: 'Overview',         path: '/dashboard'      },
  { icon: FiMessageSquare, label: 'AI Assistant',      path: '/chat'           },
  { icon: FiActivity,      label: 'Symptom check',     path: '/symptoms'       },
]

const AI_TOOLS_ITEMS = [
  { icon: FiBarChart2, label: 'Risk assessment',  path: '/dashboard?tab=risk'    },
  { icon: FiShield,    label: 'Drug safety',       path: '/drugs'                },
  { icon: FiFileText,  label: 'Report analyzer',   path: '/report-analyzer'       },
  { icon: FiUserPlus,  label: 'Doctor portal',     path: '/doctors'              },
]

const RECORDS_ITEMS = [
  { icon: FiStar,     label: 'Health insights',  path: '/insights'              },
  { icon: FiHeart,    label: 'Vitals',            path: '/dashboard?tab=vitals'   },
  { icon: FiFileText, label: 'My reports',         path: '/dashboard?tab=reports'  },
  { icon: FiClock,    label: 'Chat history',       path: '/dashboard?tab=history'  },
]

const RECENT_ITEMS = [
  { label: 'Lipid Panel · Nov 9',   dot: '#FF9F43' },
  { label: 'Fatigue + dizziness',    dot: '#0F4C81' },
  { label: 'Warfarin interactions',  dot: '#ef4444' },
]

/* ── Compute active state for a path-with-optional-query item ───────────── */
function makeIsActive(location) {
  return function isItemActive(item) {
    if (!item.path) return false
    const [path, search] = item.path.split('?')
    const pathMatches = location.pathname === path
    if (!search) {
      // Dashboard with no tab query → only active if URL has no tab param
      if (path === '/dashboard') {
        return pathMatches && !location.search.includes('tab=')
      }
      return pathMatches || location.pathname.startsWith(path + '/')
    }
    // Path with query — must match both pathname and the specific query
    return pathMatches && location.search.includes(search)
  }
}

/* ── Nav item ────────────────────────────────────────────────────────────── */
const NavItem = memo(function NavItem({ item, isActive, onClick }) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] transition-all duration-150"
      style={{
        background: isActive ? '#ffffff' : 'transparent',
        color:      isActive ? '#0F4C81' : '#475569',
        border:     isActive ? '1px solid #E6EEF5' : '1px solid transparent',
        boxShadow:  isActive ? '0 1px 2px rgba(15,76,129,0.06)' : 'none',
        fontWeight: isActive ? 600 : 500,
      }}
    >
      <Icon size={17} className="flex-shrink-0" />
      <span className="flex-1 text-left">{item.label}</span>
      {isActive && <FiChevronRight size={13} className="opacity-50" />}
    </button>
  )
})

/* ── Sidebar group label ─────────────────────────────────────────────────── */
const GroupLabel = ({ children }) => (
  <p
    className="text-[10px] font-bold uppercase tracking-[0.14em] px-3 mb-2"
    style={{ color: '#94a3b8' }}
  >
    {children}
  </p>
)

/* ── Recent activity item ────────────────────────────────────────────────── */
const RecentRow = memo(function RecentRow({ label, dot, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] text-left transition-colors hover:bg-white"
      style={{ color: '#5F6A66' }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />
      <span className="truncate">{label}</span>
    </button>
  )
})

/* ── Main sidebar ────────────────────────────────────────────────────────── */
export default function DashboardSidebar() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin  = ['admin', 'superadmin'].includes(profile?.role)
  const isItemActive = makeIsActive(location)

  const goTo = (path) => navigate(path)

  return (
    <aside
      className="hidden lg:flex w-[252px] flex-shrink-0 h-screen sticky top-0 flex-col"
      style={{
        background:  '#F8FBFD',
        borderRight: '1px solid #E6EEF5',
      }}
    >
      {/* ── Brand · always returns to landing page ─────────────────────── */}
      <div className="px-5 pt-6 pb-7">
        <button
          onClick={() => navigate('/')}
          className="block"
          aria-label="Back to SwasthyaSeva home"
        >
          <LogoFull height={26} />
        </button>
      </div>

      {/* ── Scrollable nav region ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 space-y-6 pb-4">
        {/* Workspace */}
        <div>
          <GroupLabel>Workspace</GroupLabel>
          <div className="space-y-0.5">
            {WORKSPACE_ITEMS.map(item => (
              <NavItem
                key={item.label}
                item={item}
                isActive={isItemActive(item)}
                onClick={() => goTo(item.path)}
              />
            ))}
          </div>
        </div>

        {/* AI tools */}
        <div>
          <GroupLabel>AI Tools</GroupLabel>
          <div className="space-y-0.5">
            {AI_TOOLS_ITEMS.map(item => (
              <NavItem
                key={item.label}
                item={item}
                isActive={isItemActive(item)}
                onClick={() => goTo(item.path)}
              />
            ))}
          </div>
        </div>

        {/* Health records */}
        <div>
          <GroupLabel>Health Records</GroupLabel>
          <div className="space-y-0.5">
            {RECORDS_ITEMS.map(item => (
              <NavItem
                key={item.label}
                item={item}
                isActive={isItemActive(item)}
                onClick={() => goTo(item.path)}
              />
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <GroupLabel>Recent</GroupLabel>
          <div className="space-y-0.5">
            {RECENT_ITEMS.map(item => (
              <RecentRow
                key={item.label}
                label={item.label}
                dot={item.dot}
                onClick={() => navigate('/chat')}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Upgrade card ────────────────────────────────────────────────── */}
      <div className="px-4 pb-4">
        <div
          className="rounded-2xl p-4 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg,#0F4C81 0%,#1a6db5 100%)',
            color: '#ffffff',
          }}
        >
          <div
            aria-hidden="true"
            className="absolute -right-10 -top-10 w-24 h-24 rounded-full"
            style={{ background: 'radial-gradient(circle,rgba(0,194,255,0.25),transparent 70%)' }}
          />
          <div className="relative flex items-center gap-2 mb-2">
            <span className="text-base">✨</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.12em]">
              Upgrade to Care+
            </span>
          </div>
          <p
            className="relative text-[11.5px] leading-snug mb-3"
            style={{ color: 'rgba(255,255,255,0.78)' }}
          >
            Unlimited reports, family profiles, doctor video review.
          </p>
          <button
            onClick={() => navigate('/profile')}
            className="relative w-full text-[12px] font-semibold py-2 rounded-lg transition-all hover:-translate-y-0.5 flex items-center justify-center gap-1.5"
            style={{ background: '#ffffff', color: '#0F4C81' }}
          >
            View plans <FiArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* ── Footer · Profile · Admin · Log out ─────────────────────────── */}
      <div className="px-3 pt-3 pb-4 border-t" style={{ borderColor: '#E6EEF5' }}>
        <button
          onClick={() => navigate('/profile')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors hover:bg-white mb-1"
          style={{
            color: location.pathname === '/profile' ? '#0F4C81' : '#475569',
            fontWeight: location.pathname === '/profile' ? 600 : 500,
          }}
        >
          <FiUser size={16} />
          <span>Profile &amp; settings</span>
        </button>
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors hover:bg-violet-50 mb-1"
            style={{ color: '#7c3aed' }}
          >
            <FiShield size={16} />
            <span>Admin panel</span>
          </button>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors hover:bg-red-50"
          style={{ color: '#ef4444' }}
        >
          <FiLogOut size={16} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  )
}
