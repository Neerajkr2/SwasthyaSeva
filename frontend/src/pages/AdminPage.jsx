// frontend/src/pages/AdminPage.jsx
// Module 5: Admin Panel — Platform management dashboard
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiUsers, FiBarChart2, FiActivity,
  FiSearch, FiShield, FiTrash2, FiChevronDown, FiChevronUp,
  FiMessageCircle, FiFileText, FiUserPlus,
  FiAlertTriangle, FiTrendingUp, FiDatabase, FiRefreshCw,
  FiMail, FiCalendar, FiToggleLeft, FiToggleRight,
} from 'react-icons/fi'
import { FaGoogle } from 'react-icons/fa'
import { userAPI } from '../services/api'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../hooks/useAuth'
import { timeAgo } from '../utils/helpers'
import LoadingSpinner from '../components/common/LoadingSpinner'
import DashboardSidebar from '../components/dashboard/DashboardSidebar'
import MobileBottomNav  from '../components/common/MobileBottomNav'
import AppTopBar        from '../components/dashboard/AppTopBar'

// ── Tab config ──────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',  label: 'Overview',   icon: <FiBarChart2 size={15}/> },
  { id: 'users',     label: 'Users',      icon: <FiUsers size={15}/> },
  { id: 'activity',  label: 'Activity',   icon: <FiActivity size={15}/> },
]


// ══════════════════════════════════════════════════════════════════════════════
//  STAT CARD
// ══════════════════════════════════════════════════════════════════════════════
function StatCard({ icon, label, value, color, trend }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
          style={{ background: color }}>
          {icon}
        </div>
        {trend !== undefined && trend > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
            +{trend} this week
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </motion.div>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
//  OVERVIEW TAB
// ══════════════════════════════════════════════════════════════════════════════
function OverviewTab({ stats, loading }) {
  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>
  if (!stats) return null

  const providerData = [
    { label: 'Google', count: stats.google_users || 0, color: '#4285F4', icon: <FaGoogle size={12}/> },
    { label: 'Email',  count: stats.email_users || 0,  color: '#10b981', icon: <FiMail size={12}/> },
  ]
  const totalProvider = providerData.reduce((s, p) => s + p.count, 0) || 1

  return (
    <div className="space-y-6">
      {/* Main stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FiUsers size={18}/>} label="Total Users" value={stats.total_users}
          color="linear-gradient(135deg,#0ea5e9,#0284c7)" trend={stats.new_users_7d}
        />
        <StatCard
          icon={<FiMessageCircle size={18}/>} label="Chat Sessions" value={stats.total_sessions}
          color="linear-gradient(135deg,#8b5cf6,#7c3aed)"
        />
        <StatCard
          icon={<FiFileText size={18}/>} label="Reports Analyzed" value={stats.total_reports}
          color="linear-gradient(135deg,#10b981,#059669)" trend={stats.reports_7d}
        />
        <StatCard
          icon={<FiDatabase size={18}/>} label="Total Messages" value={stats.total_messages}
          color="linear-gradient(135deg,#f59e0b,#d97706)" trend={stats.messages_7d}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* User status */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">User Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Active Users
              </span>
              <span className="font-bold text-slate-800">{stats.active_users}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Inactive
              </span>
              <span className="font-bold text-slate-800">{(stats.total_users || 0) - (stats.active_users || 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-violet-400" /> Admins
              </span>
              <span className="font-bold text-slate-800">{stats.admin_count}</span>
            </div>
          </div>
        </div>

        {/* Auth providers */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Auth Providers</h3>
          <div className="space-y-3">
            {providerData.map(p => (
              <div key={p.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-600 flex items-center gap-2">
                    {p.icon} {p.label}
                  </span>
                  <span className="font-bold text-slate-800">{p.count}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(p.count / totalProvider) * 100}%` }}
                    transition={{ duration: 0.8 }}
                    className="h-full rounded-full"
                    style={{ background: p.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Growth */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Growth</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">New users (7 days)</span>
              <span className="font-bold text-emerald-600 flex items-center gap-1">
                <FiTrendingUp size={13}/> {stats.new_users_7d}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">New users (30 days)</span>
              <span className="font-bold text-blue-600 flex items-center gap-1">
                <FiTrendingUp size={13}/> {stats.new_users_30d}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Messages (7 days)</span>
              <span className="font-bold text-violet-600">{stats.messages_7d}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Reports (7 days)</span>
              <span className="font-bold text-amber-600">{stats.reports_7d}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
//  USER ROW — expandable with actions
// ══════════════════════════════════════════════════════════════════════════════
function UserRow({ user, onRoleChange, onToggleActive, onDelete, isCurrentUser }) {
  const [expanded, setExpanded]  = useState(false)
  const [detail, setDetail]     = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const loadDetail = async () => {
    if (detail) { setExpanded(!expanded); return }
    setExpanded(true)
    setLoadingDetail(true)
    try {
      const { data } = await userAPI.adminUserDetail(user.id)
      setDetail(data)
    } catch { /* ignore */ }
    finally { setLoadingDetail(false) }
  }

  const isSuperadmin = user.role === 'superadmin'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-xl border border-slate-100 overflow-hidden hover:shadow-sm transition-all"
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={loadDetail}>
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
          style={{ background: user.role === 'admin' || user.role === 'superadmin'
            ? 'linear-gradient(135deg,#8b5cf6,#7c3aed)'
            : 'linear-gradient(135deg,#0ea5e9,#0284c7)' }}>
          {user.photo_url && user.photo_url.startsWith('http')
            ? <img src={user.photo_url} className="w-full h-full rounded-full object-cover" alt="" />
            : (user.name || 'U').charAt(0).toUpperCase()
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-slate-800 truncate">{user.name}</span>
            {isCurrentUser && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-500">YOU</span>
            )}
          </div>
          <div className="text-xs text-slate-400 truncate">{user.email}</div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            user.role === 'superadmin' ? 'bg-purple-100 text-purple-600' :
            user.role === 'admin'      ? 'bg-violet-100 text-violet-600' :
                                         'bg-slate-100 text-slate-500'
          }`}>{user.role}</span>

          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            user.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
          }`}>{user.is_active ? 'Active' : 'Inactive'}</span>

          <span className="text-slate-300">
            {user.provider === 'google' ? <FaGoogle size={12}/> : <FiMail size={12}/>}
          </span>

          <span className="text-slate-300">
            {expanded ? <FiChevronUp size={14}/> : <FiChevronDown size={14}/>}
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-slate-50"
          >
            <div className="px-4 py-3 bg-slate-50/50">
              {loadingDetail ? (
                <div className="flex justify-center py-4"><LoadingSpinner /></div>
              ) : detail ? (
                <div className="space-y-3">
                  {/* Stats row */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { v: detail.chat_count,    l: 'Chats' },
                      { v: detail.message_count, l: 'Messages' },
                      { v: detail.report_count,  l: 'Reports' },
                      { v: detail.last_activity ? timeAgo(detail.last_activity) : 'Never', l: 'Last Active' },
                    ].map((s, i) => (
                      <div key={i} className="bg-white rounded-lg p-2.5 text-center border border-slate-100">
                        <div className={`font-bold text-slate-800 ${typeof s.v === 'number' ? 'text-lg' : 'text-[11px]'}`}>{s.v}</div>
                        <div className="text-[10px] text-slate-400">{s.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Info */}
                  <div className="flex items-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><FiCalendar size={11}/> Joined {timeAgo(user.created_at)}</span>
                    <span className="flex items-center gap-1"><FiMail size={11}/> {user.provider}</span>
                  </div>

                  {/* Actions */}
                  {!isSuperadmin && !isCurrentUser && (
                    <div className="flex gap-2 pt-1 flex-wrap">
                      <button
                        onClick={(e) => { e.stopPropagation(); onRoleChange(user.id, user.role === 'admin' ? 'user' : 'admin') }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-50 text-violet-600 hover:bg-violet-100 transition-all"
                      >
                        <FiShield size={12}/> {user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleActive(user.id) }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          user.is_active
                            ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        }`}
                      >
                        {user.is_active ? <><FiToggleRight size={12}/> Deactivate</> : <><FiToggleLeft size={12}/> Activate</>}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(user.id, user.name) }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-all"
                      >
                        <FiTrash2 size={12}/> Delete
                      </button>
                    </div>
                  )}
                  {isSuperadmin && (
                    <p className="text-[10px] text-slate-300 italic">Superadmin accounts cannot be modified.</p>
                  )}
                  {isCurrentUser && !isSuperadmin && (
                    <p className="text-[10px] text-slate-300 italic">You cannot modify your own account from the admin panel.</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-2">Failed to load details.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
//  USERS TAB
// ══════════════════════════════════════════════════════════════════════════════
function UsersTab({ users, loading, onRoleChange, onToggleActive, onDelete, currentUserId }) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')

  const filtered = useMemo(() => {
    let list = users || []
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(u =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      )
    }
    if (roleFilter !== 'all') {
      list = list.filter(u => u.role === roleFilter)
    }
    return list
  }, [users, search, roleFilter])

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>

  return (
    <div className="space-y-4">
      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
          />
        </div>
        <div className="flex gap-1.5 bg-slate-100 rounded-xl p-1">
          {['all','user','admin','superadmin'].map(r => (
            <button key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                roleFilter === r ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >{r}</button>
          ))}
        </div>
      </div>

      <div className="text-xs text-slate-400">
        Showing {filtered.length} of {users?.length || 0} users
      </div>

      {/* User list */}
      <div className="space-y-2">
        {filtered.map(u => (
          <UserRow
            key={u.id}
            user={u}
            onRoleChange={onRoleChange}
            onToggleActive={onToggleActive}
            onDelete={onDelete}
            isCurrentUser={u.id === currentUserId}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-slate-300 text-sm">
            {search ? 'No users match your search.' : 'No users found.'}
          </div>
        )}
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
//  ACTIVITY TAB
// ══════════════════════════════════════════════════════════════════════════════
function ActivityTab({ activities, loading }) {
  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>

  const typeConfig = {
    signup:  { icon: <FiUserPlus size={14}/>, color: '#10b981', bg: '#d1fae5', label: 'New Signup' },
    chat:    { icon: <FiMessageCircle size={14}/>, color: '#0ea5e9', bg: '#e0f2fe', label: 'Chat Session' },
    report:  { icon: <FiFileText size={14}/>, color: '#8b5cf6', bg: '#ede9fe', label: 'Report Upload' },
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recent Activity Feed</h3>

      {(!activities || activities.length === 0) ? (
        <div className="text-center py-8 text-slate-300 text-sm">No recent activity.</div>
      ) : (
        <div className="space-y-1">
          {activities.map((a, i) => {
            const cfg = typeConfig[a.type] || typeConfig.chat
            return (
              <motion.div key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-slate-100 hover:shadow-sm transition-all"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: cfg.bg, color: cfg.color }}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-700 truncate">{a.user_name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 truncate">{a.detail}</div>
                </div>
                <div className="text-[10px] text-slate-300 flex-shrink-0 whitespace-nowrap">
                  {a.timestamp ? timeAgo(a.timestamp) : '--'}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
//  DELETE CONFIRMATION MODAL
// ══════════════════════════════════════════════════════════════════════════════
function DeleteModal({ userName, onConfirm, onCancel }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
      >
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <FiAlertTriangle size={24} className="text-red-500" />
        </div>
        <h3 className="font-display font-bold text-lg text-slate-800 text-center mb-2">Delete User</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to permanently delete <strong>{userName}</strong>?
          This will remove all their data including chats, reports, and vitals.
          This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-all">
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
//  MAIN ADMIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function AdminPage() {
  const navigate = useNavigate()
  const toast    = useToast()
  const { profile } = useAuth()

  const [activeTab,    setActiveTab]    = useState('overview')
  const [stats,        setStats]        = useState(null)
  const [users,        setUsers]        = useState([])
  const [activities,   setActivities]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // ── Load data on mount ────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, usersRes] = await Promise.all([
        userAPI.adminGetStats(),
        userAPI.adminListUsers(),
      ])
      setStats(statsRes.data)
      setUsers(usersRes.data)
    } catch (err) {
      if (err.message?.includes('403') || err.message?.includes('Admin')) {
        toast.error('Access denied. Admin privileges required.')
        navigate('/dashboard')
      } else {
        toast.error(err.message || 'Failed to load admin data')
      }
    } finally {
      setLoading(false)
    }
  }, [toast, navigate])

  const loadActivity = useCallback(async () => {
    try {
      const { data } = await userAPI.adminActivity()
      setActivities(data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    if (activeTab === 'activity' && activities.length === 0) loadActivity()
  }, [activeTab, activities.length, loadActivity])

  // ── Admin actions ─────────────────────────────────────────────────────────
  const handleRoleChange = async (userId, newRole) => {
    try {
      const { data } = await userAPI.adminSetRole(userId, newRole)
      setUsers(prev => prev.map(u => u.id === userId ? data : u))
      toast.success(`Role updated to ${newRole}`)
    } catch (err) {
      toast.error(err.message || 'Failed to update role')
    }
  }

  const handleToggleActive = async (userId) => {
    try {
      const { data } = await userAPI.adminToggleActive(userId)
      setUsers(prev => prev.map(u => u.id === userId ? data : u))
      toast.success(data.is_active ? 'User activated' : 'User deactivated')
    } catch (err) {
      toast.error(err.message || 'Failed to toggle user status')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await userAPI.adminDeleteUser(deleteTarget.id)
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id))
      toast.success('User deleted successfully')
    } catch (err) {
      toast.error(err.message || 'Failed to delete user')
    } finally {
      setDeleteTarget(null)
    }
  }

  const confirmDelete = (id, name) => setDeleteTarget({ id, name })

  return (
    <div className="flex min-h-screen" style={{ background: '#F8FBFD' }}>
      <DashboardSidebar />

      <main className="flex-1 min-h-screen flex flex-col overflow-x-hidden pb-20 lg:pb-0">
        <AppTopBar
          kicker="Admin · Platform management"
          title="Admin panel"
          action={
            <button
              onClick={() => { loadData(); loadActivity() }}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-colors hover:bg-slate-50"
              style={{ background: '#fff', border: '1px solid #E6EEF5', color: '#475569' }}
            >
              <FiRefreshCw size={13} /> Refresh
            </button>
          }
        />

        <div className="flex-1 p-6 lg:p-8 max-w-[1280px] w-full mx-auto">
        {/* Tab navigation */}
        <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
          {TABS.map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-violet-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.icon} {tab.label}
              {tab.id === 'users' && users.length > 0 && (
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-violet-100 text-violet-600">
                  {users.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'overview' && <OverviewTab stats={stats} loading={loading} />}
            {activeTab === 'users' && (
              <UsersTab
                users={users}
                loading={loading}
                onRoleChange={handleRoleChange}
                onToggleActive={handleToggleActive}
                onDelete={confirmDelete}
                currentUserId={profile?.id}
              />
            )}
            {activeTab === 'activity' && <ActivityTab activities={activities} loading={loading} />}
          </motion.div>
        </AnimatePresence>
        </div>
      </main>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteModal
            userName={deleteTarget.name}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>

      <MobileBottomNav />
    </div>
  )
}
