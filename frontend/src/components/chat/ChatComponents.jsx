// src/components/chat/ChatComponents.jsx
// Module 3: Enhanced AI Healthcare Assistant — Rich chat experience
import { useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiPlus, FiMessageCircle, FiTrash2, FiGrid,
  FiHome, FiLogOut, FiPaperclip, FiMic, FiSend, FiX,
  FiSearch, FiActivity, FiShield, FiFileText,
  FiHeart, FiBook, FiStar, FiChevronRight, FiInfo,
} from 'react-icons/fi'
import { FaRobot } from 'react-icons/fa'
import TextareaAutosize from 'react-textarea-autosize'
import { useAuth } from '../../hooks/useAuth'
import { getInitials, timeAgo, formatBytes } from '../../utils/helpers'

// ── Topic categories with icons ─────────────────────────────────────────────
const QUICK_TOPICS = [
  { icon: '🏥', label: 'General Health',   color: '#0ea5e9' },
  { icon: '🥗', label: 'Nutrition',        color: '#10b981' },
  { icon: '🏋️', label: 'Fitness',          color: '#f59e0b' },
  { icon: '🧘', label: 'Mental Health',    color: '#8b5cf6' },
  { icon: '🩹', label: 'First Aid',        color: '#ef4444' },
  { icon: '🔬', label: 'Medical Education',color: '#6366f1' },
]

// ── Quick action prompts ────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { label: '🤒 Fever & Headache',    text: 'I have fever and headache for 2 days. What could it be?' },
  { label: '🩸 Analyze Blood Report', text: "Can you analyze my blood report? I'll upload it now." },
  { label: '💊 Drug Interaction',     text: 'Check drug interactions for Metformin and Amlodipine.' },
  { label: '📊 Risk Assessment',      text: 'Based on my age and weight, what is my disease risk?' },
  { label: '❤️ Heart Health',         text: 'What are signs of poor heart health I should watch for?' },
  { label: '🍎 Diet Advice',          text: 'Suggest a diet plan for managing high cholesterol.' },
  { label: '🧠 Mental Wellness',      text: 'What are effective ways to manage stress and anxiety?' },
  { label: '💪 Exercise Plan',         text: 'What exercises are good for beginners to improve cardiovascular health?' },
]

// ── Cross-module CTA detection ──────────────────────────────────────────────
const CROSS_MODULE_PATTERNS = [
  {
    keywords: ['symptom', 'feeling', 'experiencing', 'pain', 'headache', 'fever', 'cough', 'nausea'],
    module: 'symptoms',
    label: 'Check Your Symptoms',
    icon: <FiActivity size={15} />,
    path: '/symptoms',
    color: '#0ea5e9',
  },
  {
    keywords: ['drug', 'medicine', 'medication', 'interaction', 'tablet', 'pill', 'prescription'],
    module: 'drugs',
    label: 'Check Drug Interactions',
    icon: <FiShield size={15} />,
    path: '/drugs',
    color: '#8b5cf6',
  },
  {
    keywords: ['report', 'blood test', 'lab result', 'lab report', 'ecg', 'x-ray'],
    module: 'report',
    label: 'Analyze Your Report',
    icon: <FiFileText size={15} />,
    path: '/report-analyzer',
    color: '#10b981',
  },
]

function detectCrossModuleCTA(text) {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const pattern of CROSS_MODULE_PATTERNS) {
    if (pattern.keywords.some(kw => lower.includes(kw))) {
      return pattern
    }
  }
  return null
}

// ── Simple markdown-like rendering ──────────────────────────────────────────
function RichText({ content }) {
  if (!content) return null

  // Split by lines and render with basic formatting
  const lines = content.split('\n')
  const elements = []
  let inList = false

  lines.forEach((line, i) => {
    const trimmed = line.trim()

    // Headers
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={i} className="font-bold text-slate-800 text-sm mt-3 mb-1">
          {trimmed.slice(4).replace(/\*\*/g, '')}
        </h4>
      )
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={i} className="font-bold text-slate-800 text-base mt-3 mb-1">
          {trimmed.slice(3).replace(/\*\*/g, '')}
        </h3>
      )
    }
    // Horizontal rule
    else if (trimmed === '---' || trimmed === '***') {
      elements.push(<hr key={i} className="my-2 border-slate-100" />)
    }
    // Bullet points
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      const text = trimmed.slice(2)
      elements.push(
        <div key={i} className="flex items-start gap-2 ml-1 my-0.5">
          <span className="text-primary-400 mt-0.5 flex-shrink-0 text-xs">&#8226;</span>
          <span className="text-sm">{renderInline(text)}</span>
        </div>
      )
    }
    // Numbered items
    else if (/^\d+\.\s/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)\.\s/)[1]
      const text = trimmed.replace(/^\d+\.\s/, '')
      elements.push(
        <div key={i} className="flex items-start gap-2 ml-1 my-0.5">
          <span className="text-primary-500 font-bold text-xs mt-0.5 flex-shrink-0 w-4">{num}.</span>
          <span className="text-sm">{renderInline(text)}</span>
        </div>
      )
    }
    // Empty line
    else if (trimmed === '') {
      elements.push(<div key={i} className="h-2" />)
    }
    // Normal paragraph
    else {
      elements.push(
        <p key={i} className="text-sm leading-relaxed my-0.5">{renderInline(trimmed)}</p>
      )
    }
  })

  return <div>{elements}</div>
}

function renderInline(text) {
  // Bold: **text** or __text__
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('__') && part.endsWith('__')) {
      return <strong key={i} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>
    }
    // Italic: *text*
    const italicParts = part.split(/(\*[^*]+\*)/g)
    return italicParts.map((ip, j) => {
      if (ip.startsWith('*') && ip.endsWith('*') && ip.length > 2) {
        return <em key={`${i}-${j}`} className="italic text-slate-600">{ip.slice(1, -1)}</em>
      }
      return ip
    })
  })
}


// ══════════════════════════════════════════════════════════════════════════════
//  CHAT SIDEBAR — Enhanced with search and topic filters
// ══════════════════════════════════════════════════════════════════════════════
export function ChatSidebar({ sessions, activeSession, onNew, onSelect, onDelete }) {
  const { user, profile, logout } = useAuth()
  const navigate    = useNavigate()
  const displayName = profile?.name || user?.displayName || 'User'
  const [searchQuery, setSearchQuery] = useState('')

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions
    const q = searchQuery.toLowerCase()
    return sessions.filter(s => (s.title || '').toLowerCase().includes(q))
  }, [sessions, searchQuery])

  // Group sessions by date
  const groupedSessions = useMemo(() => {
    const groups = { today: [], yesterday: [], thisWeek: [], earlier: [] }
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterdayStart = new Date(todayStart.getTime() - 86400000)
    const weekStart = new Date(todayStart.getTime() - 6 * 86400000)

    filteredSessions.forEach(s => {
      const d = new Date(s.created_at)
      if (d >= todayStart) groups.today.push(s)
      else if (d >= yesterdayStart) groups.yesterday.push(s)
      else if (d >= weekStart) groups.thisWeek.push(s)
      else groups.earlier.push(s)
    })
    return groups
  }, [filteredSessions])

  const renderGroup = (label, items) => {
    if (!items.length) return null
    return (
      <div key={label}>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-1.5 mt-3">
          {label}
        </div>
        {items.map(s => (
          <div key={s.id}
            className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all mb-0.5 group ${
              activeSession?.id === s.id ? 'border-l-2 border-primary-400' : 'hover:translate-x-0.5'
            }`}
            style={{ background: activeSession?.id === s.id ? 'linear-gradient(135deg,rgba(14,165,233,0.12),rgba(139,92,246,0.08))' : '' }}
            onClick={() => onSelect(s.id)}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(15,76,129,0.1)' }}>
              <FiMessageCircle size={14} style={{ color: '#0ea5e9' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-700 text-xs truncate">{s.title || 'Health Consultation'}</div>
              <div className="text-[10px] text-slate-400">{timeAgo(s.created_at)}</div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onDelete(s.id) }}
              className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all flex-shrink-0">
              <FiTrash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <aside className="w-80 flex-shrink-0 h-screen sticky top-0 flex flex-col hidden md:flex"
      style={{ background: 'linear-gradient(180deg,#fff,#fef9ff)', borderRight: '1px solid rgba(15,76,129,0.1)' }}>

      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="font-display text-xl font-bold gradient-text mb-3">SwasthyaSeva</div>
        <div className="flex items-center gap-3 p-2.5 rounded-xl"
          style={{ background: 'linear-gradient(135deg,rgba(15,76,129,0.08),rgba(0,194,255,0.05))' }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 text-xs"
            style={{ background: 'linear-gradient(135deg,#0F4C81,#00C2FF)' }}>
            {user?.photoURL
              ? <img src={user.photoURL} className="w-full h-full rounded-full object-cover" alt="avatar" />
              : getInitials(displayName)
            }
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-800 text-sm truncate">{displayName}</div>
            <div className="text-[10px] text-slate-400">AI Health Assistant</div>
          </div>
        </div>
      </div>

      {/* New chat button */}
      <div className="px-3 pt-3">
        <button onClick={onNew}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-semibold text-sm transition-all hover:-translate-y-0.5 active:scale-95"
          style={{ background: 'linear-gradient(135deg,#0F4C81,#00C2FF)', boxShadow: '0 4px 12px rgba(15,76,129,0.3)' }}>
          <FiPlus size={16} /> New Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <div className="relative">
          <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-700 outline-none focus:border-primary-300 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Quick Topics */}
      <div className="px-3 pt-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Quick Topics</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TOPICS.map(t => (
            <button key={t.label} onClick={() => onNew && onNew(t.label)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border border-slate-100 bg-white hover:border-primary-200 hover:bg-primary-50 transition-all"
            >
              <span>{t.icon}</span>
              <span className="text-slate-600">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto px-3 py-1">
        {filteredSessions.length > 0 ? (
          <>
            {renderGroup('Today', groupedSessions.today)}
            {renderGroup('Yesterday', groupedSessions.yesterday)}
            {renderGroup('This Week', groupedSessions.thisWeek)}
            {renderGroup('Earlier', groupedSessions.earlier)}
          </>
        ) : (
          <div className="text-center text-slate-300 text-xs py-8">
            {searchQuery ? 'No matching conversations' : 'No conversations yet'}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="p-3 border-t border-slate-100 space-y-0.5">
        <button onClick={() => navigate('/dashboard')} className="nav-item w-full text-left text-xs"><FiGrid size={14} /> Dashboard</button>
        <button onClick={() => navigate('/')}          className="nav-item w-full text-left text-xs"><FiHome size={14} /> Home</button>
        <button onClick={logout} className="nav-item w-full text-left text-xs text-red-400 hover:!text-red-500 hover:!bg-red-50"><FiLogOut size={14} /> Logout</button>
      </div>
    </aside>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
//  MESSAGE AREA — Enhanced with rich rendering + cross-module CTAs
// ══════════════════════════════════════════════════════════════════════════════
export function MessageArea({ messages, isTyping, bottomRef }) {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const displayName = profile?.name || user?.displayName || 'User'

  if (!messages.length && !isTyping) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="max-w-md">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'linear-gradient(135deg,#0F4C81,#00C2FF)' }}>
            <FaRobot size={36} className="text-white" />
          </div>
          <h2 className="font-display text-2xl font-bold text-slate-800 mb-2">SwasthyaSeva AI</h2>
          <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed mb-6">
            Your personal healthcare knowledge assistant. Ask about diseases, medications,
            nutrition, fitness, mental health, or any health topic.
          </p>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { icon: '🩺', title: 'Health Knowledge', desc: 'Diseases, conditions, treatments' },
              { icon: '🥗', title: 'Nutrition Guide', desc: 'Diets, vitamins, meal plans' },
              { icon: '💊', title: 'Medicine Info', desc: 'How drugs work, side effects' },
              { icon: '🧠', title: 'Mental Wellness', desc: 'Stress, anxiety, sleep tips' },
            ].map(f => (
              <div key={f.title} className="bg-slate-50 rounded-xl p-3 text-left border border-slate-100">
                <span className="text-xl">{f.icon}</span>
                <div className="font-semibold text-xs text-slate-700 mt-1">{f.title}</div>
                <div className="text-[10px] text-slate-400">{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Cross-module links */}
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { icon: <FiActivity size={12} />, label: 'Symptom Checker', path: '/symptoms' },
              { icon: <FiFileText size={12} />,  label: 'Report Analyzer', path: '/report-analyzer' },
              { icon: <FiShield size={12} />,    label: 'Drug Checker',    path: '/drugs' },
            ].map(link => (
              <button key={link.label} onClick={() => navigate(link.path)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-primary-600 bg-primary-50 border border-primary-100 hover:bg-primary-100 transition-all">
                {link.icon} {link.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      <AnimatePresence initial={false}>
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user'
          const crossModuleCTA = !isUser ? detectCrossModuleCTA(msg.content) : null

          return (
            <motion.div key={msg.id || msg.created_at || idx}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: .25 }}
              className={`flex gap-3 items-start ${isUser ? 'flex-row-reverse' : ''}`}>

              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm text-white shadow-sm"
                style={{ background: isUser ? 'linear-gradient(135deg,#334155,#1e293b)' : 'linear-gradient(135deg,#0F4C81,#00C2FF)' }}>
                {isUser ? getInitials(displayName) : <FaRobot size={15} />}
              </div>

              <div className={`max-w-[75%] ${isUser ? '' : ''}`}>
                <div className={`rounded-2xl px-5 py-3.5 ${
                  isUser
                    ? 'text-white rounded-tr-sm'
                    : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'
                }`}
                  style={isUser ? { background: 'linear-gradient(135deg,#0ea5e9,#0284c7)' } : {}}>

                  {/* Rich text rendering for AI messages */}
                  {isUser ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <RichText content={msg.content} />
                  )}

                  {msg.file_name && (
                    <div className={`mt-2 text-xs flex items-center gap-1 ${isUser ? 'opacity-70' : 'text-slate-400'}`}>
                      <FiPaperclip size={11} /> {msg.file_name}
                    </div>
                  )}

                  <div className={`text-[10px] mt-1.5 ${isUser ? 'opacity-60 text-right' : 'text-slate-300'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {/* Cross-module CTA below AI messages */}
                {crossModuleCTA && (
                  <motion.button
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    onClick={() => navigate(crossModuleCTA.path)}
                    className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl text-xs font-medium border border-slate-100 bg-white hover:bg-slate-50 text-slate-600 hover:text-primary-600 transition-all shadow-sm group"
                  >
                    <span className="w-6 h-6 rounded-md flex items-center justify-center text-white"
                      style={{ background: crossModuleCTA.color }}>
                      {crossModuleCTA.icon}
                    </span>
                    {crossModuleCTA.label}
                    <FiChevronRight size={12} className="ml-auto text-slate-300 group-hover:text-primary-400" />
                  </motion.button>
                )}
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* Typing indicator */}
      {isTyping && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 items-start">
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white shadow-sm"
            style={{ background: 'linear-gradient(135deg,#0F4C81,#00C2FF)' }}>
            <FaRobot size={15} />
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
            <div className="flex gap-1.5 items-center">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-primary-400 typing-dot"
                  style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        </motion.div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
//  QUICK ACTIONS — Enhanced with more prompts
// ══════════════════════════════════════════════════════════════════════════════
export function QuickActions({ onSelect }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? QUICK_PROMPTS : QUICK_PROMPTS.slice(0, 6)

  return (
    <div className="mb-3">
      <div className="flex flex-wrap gap-1.5">
        {visible.map(q => (
          <button key={q.label} onClick={() => onSelect(q.text)}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium text-slate-600 bg-white border border-slate-200 hover:bg-primary-50 hover:border-primary-200 hover:text-primary-600 transition-all">
            {q.label}
          </button>
        ))}
        {!showAll && QUICK_PROMPTS.length > 6 && (
          <button onClick={() => setShowAll(true)}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium text-primary-500 bg-primary-50 border border-primary-100 hover:bg-primary-100 transition-all">
            +{QUICK_PROMPTS.length - 6} more
          </button>
        )}
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════════════════
//  CHAT INPUT — Enhanced with file upload and voice
// ══════════════════════════════════════════════════════════════════════════════
export function ChatInput({ onSend, disabled }) {
  const [text,      setText]      = useState('')
  const [file,      setFile]      = useState(null)
  const [recording, setRecording] = useState(false)
  const fileRef   = useRef(null)
  const mediaRef  = useRef(null)
  const chunksRef = useRef([])

  const handleSend = () => {
    if (!text.trim() && !file) return
    onSend({ text: text.trim(), file })
    setText('')
    setFile(null)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 10 * 1024 * 1024) { alert('Max file size is 10 MB.'); return }
    setFile(f)
    e.target.value = ''
  }

  const toggleRecording = async () => {
    if (recording) { mediaRef.current?.stop(); setRecording(false); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setFile(new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' }))
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start()
      mediaRef.current = mr
      setRecording(true)
    } catch { alert('Microphone permission denied.') }
  }

  return (
    <div className="px-6 py-4 border-t border-slate-100 bg-white/95 backdrop-blur-sm">
      <QuickActions onSelect={t => setText(t)} />

      {/* File preview */}
      <AnimatePresence>
        {file && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-xl px-4 py-2.5 mb-3"
          >
            <FiPaperclip size={14} className="text-primary-500" />
            <span className="flex-1 text-sm font-medium text-primary-700 truncate">{file.name}</span>
            <span className="text-xs text-primary-400">{formatBytes(file.size)}</span>
            <button onClick={() => setFile(null)} className="text-primary-400 hover:text-primary-600 transition-colors">
              <FiX size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording indicator */}
      <AnimatePresence>
        {recording && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-3"
          >
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium text-red-600">Recording - click mic to stop</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input row */}
      <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 focus-within:border-primary-400 focus-within:shadow-glow-primary transition-all">
        <div className="flex gap-1 pb-1">
          <button onClick={() => fileRef.current?.click()} title="Attach file"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-primary-500 hover:bg-primary-50 transition-all">
            <FiPaperclip size={16} />
          </button>
          <button onClick={toggleRecording} title="Voice input"
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              recording ? 'text-red-500 bg-red-50' : 'text-slate-400 hover:text-primary-500 hover:bg-primary-50'
            }`}>
            <FiMic size={16} />
          </button>
        </div>

        <TextareaAutosize
          value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKey}
          placeholder="Ask about health, nutrition, medications, wellness..."
          minRows={1} maxRows={5} disabled={disabled}
          className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-slate-800 placeholder-slate-400 py-1.5"
          style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}
        />

        <button onClick={handleSend} disabled={disabled || (!text.trim() && !file)}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0 transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)' }}>
          <FiSend size={16} />
        </button>
      </div>

      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFile} />
      <p className="text-center text-[10px] text-slate-300 mt-2">
        AI guidance only - always consult a licensed doctor for medical decisions
      </p>
    </div>
  )
}
