// src/pages/ChatPage.jsx
/**
 * AI Assistant page — premium redesign
 *
 * Layout (matches design reference):
 *   [Sidebar] [Topbar — kicker · "Ask anything about your health" · + New chat]
 *             [content max-w-1280]
 *                ┌─── LEFT (centered, max-w-720) ───┐  ┌── RIGHT (280px) ──┐
 *                │  Chat thread                       │  │  Conversation       │
 *                │   • Date dividers                  │  │  context            │
 *                │   • User msgs (brand-tinted)        │  │                     │
 *                │   • AI msgs (no bubble, avatar +   │  │  Quick prompts      │
 *                │     name + content + sources +     │  │                     │
 *                │     actions)                        │  │  Educational        │
 *                │   • Typing indicator                │  │  disclaimer         │
 *                │  Composer card                      │  └─────────────────────┘
 *                └─────────────────────────────────────┘
 *
 * All visuals follow the SwasthyaSeva design system: Sora display,
 * Plus Jakarta body, #0F4C81 brand, #00C2FF cyan, rounded-2xl cards.
 */
import { useEffect, useRef, useCallback, useState, useMemo, memo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiPlus, FiMessageCircle, FiTrash2, FiPaperclip, FiMic, FiSend,
  FiX, FiInfo, FiActivity, FiShield, FiFileText, FiBookmark,
  FiThumbsUp, FiThumbsDown, FiCopy, FiClock, FiChevronDown,
} from 'react-icons/fi'
import TextareaAutosize from 'react-textarea-autosize'

import { useChat } from '../hooks/useChat'
import { useToast } from '../context/ToastContext'
import { timeAgo } from '../utils/helpers'

import DashboardSidebar from '../components/dashboard/DashboardSidebar'
import MobileBottomNav  from '../components/common/MobileBottomNav'
import AppTopBar        from '../components/dashboard/AppTopBar'
import { Card, Kicker } from '../components/dashboard/_primitives'
import LoadingSpinner   from '../components/common/LoadingSpinner'

/* ═══════════════════════════════════════════════════════════════════════════
   Suggested prompts (right rail + empty state)
   ═══════════════════════════════════════════════════════════════════════ */
const QUICK_PROMPTS = [
  'Explain my latest lab in 3 lines',
  'What foods raise glucose for me?',
  'Should I be worried about my LDL?',
  'Find a specialist near me',
]

const STARTER_PROMPTS = [
  { icon: '🩺', label: 'Symptoms',    text: 'I have fever and headache for 2 days — what could it be?' },
  { icon: '🥗', label: 'Nutrition',   text: 'Suggest a heart-healthy diet plan for me' },
  { icon: '💊', label: 'Medicines',    text: 'Are there any risks combining Metformin and Atorvastatin?' },
  { icon: '🧠', label: 'Wellness',     text: 'What are evidence-based ways to manage stress and sleep?' },
]

const MOCK_CONTEXT = [
  { icon: FiFileText, label: 'Lipid Panel · Nov 9' },
  { icon: FiActivity, label: 'Metformin 500 mg'    },
  { icon: FiActivity, label: 'Atorvastatin 20 mg'   },
  { icon: FiShield,   label: 'Family history: CAD'  },
]

/* ═══════════════════════════════════════════════════════════════════════════
   Cross-module CTA detection (preserved from original)
   ═══════════════════════════════════════════════════════════════════════ */
const CROSS_MODULE_PATTERNS = [
  { kws: ['symptom','pain','headache','fever','cough','nausea','feeling'],         label: 'Check your symptoms',    path: '/symptoms',        color: '#0F4C81', icon: FiActivity },
  { kws: ['drug','medicine','medication','interaction','tablet','pill'],            label: 'Check drug interactions', path: '/drugs',           color: '#FF9F43', icon: FiShield   },
  { kws: ['report','blood test','lab result','ecg','x-ray','panel'],                 label: 'Analyze your report',     path: '/report-analyzer', color: '#2ECC71', icon: FiFileText },
]

const detectCrossModuleCTA = (text) => {
  if (!text) return null
  const lower = text.toLowerCase()
  return CROSS_MODULE_PATTERNS.find(p => p.kws.some(kw => lower.includes(kw))) || null
}

/* ═══════════════════════════════════════════════════════════════════════════
   Lightweight markdown renderer (preserved)
   ═══════════════════════════════════════════════════════════════════════ */
const RichText = memo(function RichText({ content }) {
  if (!content) return null
  const lines = content.split('\n')
  const out = []
  let listBuf = []
  let inOL = false

  const flushList = (i) => {
    if (!listBuf.length) return
    const Tag = inOL ? 'ol' : 'ul'
    out.push(
      <Tag key={`list-${i}`}
        className={`my-2.5 pl-5 space-y-1.5 ${inOL ? 'list-decimal' : 'list-disc'}`}
        style={{ color: '#475569' }}
      >
        {listBuf.map((item, idx) => <li key={idx}>{item}</li>)}
      </Tag>
    )
    listBuf = []
    inOL = false
  }

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim()
    if (!line) { flushList(i); return }

    if (line.startsWith('### ')) {
      flushList(i)
      out.push(<h4 key={i} className="font-display font-bold text-[15px] mt-4 mb-1.5" style={{ color: '#0B1320' }}>{line.slice(4).replace(/\*\*/g, '')}</h4>)
    } else if (line.startsWith('## ')) {
      flushList(i)
      out.push(<h3 key={i} className="font-display font-bold text-[16px] mt-4 mb-1.5" style={{ color: '#0B1320' }}>{line.slice(3).replace(/\*\*/g, '')}</h3>)
    } else if (/^\d+\.\s/.test(line)) {
      inOL = true
      listBuf.push(<span dangerouslySetInnerHTML={{ __html: formatInline(line.replace(/^\d+\.\s/, '')) }} />)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      inOL = false
      listBuf.push(<span dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2)) }} />)
    } else {
      flushList(i)
      out.push(
        <p key={i} className="text-[14px] leading-[1.65] my-1.5" style={{ color: '#475569' }}
          dangerouslySetInnerHTML={{ __html: formatInline(line) }}
        />
      )
    }
  })
  flushList('end')
  return <div>{out}</div>
})

const formatInline = (s) =>
  s.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#0B1320;font-weight:600">$1</strong>')
   .replace(/\*(.+?)\*/g, '<em>$1</em>')
   .replace(/`(.+?)`/g, '<code style="background:#F8FBFD;padding:1px 5px;border-radius:4px;font-size:0.92em;border:1px solid #E6EEF5">$1</code>')

/* ═══════════════════════════════════════════════════════════════════════════
   AI avatar — leaf-inspired mark with brand gradient
   ═══════════════════════════════════════════════════════════════════════ */
const AIAvatar = memo(function AIAvatar({ size = 32 }) {
  return (
    <div
      className="rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold relative overflow-hidden"
      style={{
        width: size, height: size,
        background: 'linear-gradient(135deg,#0F4C81,#1a6db5)',
        fontSize: size * 0.42,
      }}
    >
      <span className="relative" style={{ fontFamily: 'Sora, sans-serif' }}>S</span>
      {/* Subtle cyan accent */}
      <div
        aria-hidden="true"
        className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full opacity-50"
        style={{ background: '#00C2FF' }}
      />
    </div>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   Date divider
   ═══════════════════════════════════════════════════════════════════════ */
const DateDivider = memo(function DateDivider({ label }) {
  return (
    <div className="flex items-center gap-3 my-5">
      <span className="flex-1 h-px" style={{ background: '#E6EEF5' }} />
      <span
        className="text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: '#94a3b8' }}
      >
        {label}
      </span>
      <span className="flex-1 h-px" style={{ background: '#E6EEF5' }} />
    </div>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   User message bubble
   ═══════════════════════════════════════════════════════════════════════ */
const UserMessage = memo(function UserMessage({ message }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-end mb-6"
    >
      <div
        className="max-w-[78%] px-4 py-3 leading-relaxed text-[14.5px]"
        style={{
          background: 'rgba(15,76,129,0.06)',
          color: '#0B1320',
          borderRadius: '18px 18px 4px 18px',
          border: '1px solid rgba(15,76,129,0.10)',
        }}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.file_name && (
          <div className="mt-2 text-[11px] flex items-center gap-1 opacity-70">
            <FiPaperclip size={11} /> {message.file_name}
          </div>
        )}
      </div>
    </motion.div>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   AI message — clean no-bubble layout with avatar + name + content + actions
   ═══════════════════════════════════════════════════════════════════════ */
const AIMessage = memo(function AIMessage({ message, onCopy, contextChip }) {
  const navigate = useNavigate()
  const cta = detectCrossModuleCTA(message.content)
  const [feedback, setFeedback] = useState(null)
  const [bookmarked, setBookmarked] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(message.content)
    onCopy?.()
  }, [message.content, onCopy])

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 mb-6"
    >
      <AIAvatar />
      <div className="flex-1 min-w-0 pt-0.5">
        {/* Name + optional context chip */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            className="font-display font-bold text-[14px]"
            style={{ color: '#0B1320' }}
          >
            SwasthyaSeva
          </span>
          {contextChip && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold"
              style={{
                background: 'rgba(15,76,129,0.08)',
                color: '#0F4C81',
                border: '1px solid rgba(15,76,129,0.18)',
              }}
            >
              <span className="text-[10px]">✦</span> {contextChip}
            </span>
          )}
        </div>

        {/* Rich content */}
        <RichText content={message.content} />

        {/* Sources row (mocked but ready) */}
        {message.sources && message.sources.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-[11px]" style={{ color: '#94a3b8' }}>Based on</span>
            {message.sources.map(s => (
              <span
                key={s}
                className="px-2.5 py-0.5 rounded-full text-[11px]"
                style={{ background: '#F8FBFD', border: '1px solid #E6EEF5', color: '#475569' }}
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Cross-module CTA */}
        {cta && (
          <motion.button
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            onClick={() => navigate(cta.path)}
            className="flex items-center gap-2.5 mt-3 px-3.5 py-2.5 rounded-xl transition-all hover:-translate-y-0.5"
            style={{
              background: '#fff',
              border: '1px solid #E6EEF5',
              color: '#0B1320',
            }}
          >
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
              style={{ background: cta.color }}
            >
              <cta.icon size={13} />
            </span>
            <span className="text-[13px] font-semibold">{cta.label}</span>
            <FiChevronDown size={12} className="rotate-[-90deg]" style={{ color: '#94a3b8' }} />
          </motion.button>
        )}

        {/* Action row */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button
            onClick={() => setBookmarked(v => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold transition-colors hover:bg-slate-50"
            style={{
              background: bookmarked ? 'rgba(15,76,129,0.06)' : '#fff',
              border: '1px solid #E6EEF5',
              color: bookmarked ? '#0F4C81' : '#475569',
            }}
          >
            <FiBookmark size={11.5} className={bookmarked ? 'fill-current' : ''} />
            {bookmarked ? 'Saved' : 'Save'}
          </button>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold transition-colors hover:bg-slate-50"
            style={{ background: '#fff', border: '1px solid #E6EEF5', color: '#475569' }}
          >
            <FiCopy size={11.5} /> Copy
          </button>

          <div className="ml-auto flex gap-1">
            <button
              onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
              aria-label="Helpful"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-50"
              style={{
                background: feedback === 'up' ? 'rgba(46,204,113,0.10)' : '#fff',
                border: '1px solid #E6EEF5',
                color: feedback === 'up' ? '#1f9d55' : '#94a3b8',
              }}
            >
              <FiThumbsUp size={12} />
            </button>
            <button
              onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
              aria-label="Not helpful"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-50"
              style={{
                background: feedback === 'down' ? 'rgba(239,68,68,0.10)' : '#fff',
                border: '1px solid #E6EEF5',
                color: feedback === 'down' ? '#ef4444' : '#94a3b8',
              }}
            >
              <FiThumbsDown size={12} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   Typing indicator — avatar + pill with brand-colored dots
   ═══════════════════════════════════════════════════════════════════════ */
const TypingIndicator = memo(function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 mb-6"
    >
      <AIAvatar />
      <div
        className="px-4 py-3 rounded-full flex items-center gap-1.5"
        style={{ background: '#F8FBFD', border: '1px solid #E6EEF5' }}
      >
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: '#0F4C81',
              animation: 'bounceDot 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </div>
    </motion.div>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   Empty state — premium welcome
   ═══════════════════════════════════════════════════════════════════════ */
const EmptyState = memo(function EmptyState({ onPickPrompt }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10">
      <AIAvatar size={56} />
      <h2
        className="font-display text-[28px] font-bold mt-6 mb-3 leading-tight"
        style={{ color: '#0B1320' }}
      >
        Hi, I'm <span style={{ color: '#0F4C81' }}>SwasthyaSeva</span>.
      </h2>
      <p className="text-[14.5px] leading-relaxed max-w-md mb-8" style={{ color: '#64748b' }}>
        Ask me anything about your symptoms, lab reports, medications, nutrition,
        or wellness — I'll explain it in plain language, grounded in clinical
        guidelines.
      </p>

      <div className="grid grid-cols-2 gap-3 w-full max-w-xl">
        {STARTER_PROMPTS.map(p => (
          <button
            key={p.label}
            onClick={() => onPickPrompt(p.text)}
            className="flex items-start gap-3 p-4 rounded-2xl text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            style={{
              background: '#fff',
              border: '1px solid #E6EEF5',
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: '#F8FBFD' }}
            >
              {p.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-[13.5px] mb-1" style={{ color: '#0B1320' }}>
                {p.label}
              </div>
              <div className="text-[12px] leading-snug" style={{ color: '#94a3b8' }}>
                {p.text}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   Composer — premium input with paperclip/mic, "Connected" status, send
   ═══════════════════════════════════════════════════════════════════════ */
const Composer = memo(function Composer({ onSend, disabled, contextCount, initialText = '' }) {
  const [text,      setText]      = useState(initialText)
  const [file,      setFile]      = useState(null)
  const [recording, setRecording] = useState(false)
  const fileRef   = useRef(null)
  const mediaRef  = useRef(null)
  const chunksRef = useRef([])

  const handleSend = useCallback(() => {
    if (!text.trim() && !file) return
    onSend({ text: text.trim(), file })
    setText('')
    setFile(null)
  }, [text, file, onSend])

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
    <div className="mt-4">
      {/* File preview */}
      <AnimatePresence>
        {file && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 rounded-xl px-3.5 py-2 mb-2"
            style={{ background: 'rgba(15,76,129,0.05)', border: '1px solid rgba(15,76,129,0.18)' }}
          >
            <FiPaperclip size={13} style={{ color: '#0F4C81' }} />
            <span className="flex-1 text-[12.5px] font-medium truncate" style={{ color: '#0B1320' }}>
              {file.name}
            </span>
            <button onClick={() => setFile(null)} className="text-slate-400 hover:text-slate-600">
              <FiX size={13} />
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
            className="flex items-center gap-2 rounded-xl px-3.5 py-2 mb-2"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.20)' }}
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[12.5px] font-medium text-red-600">
              Recording — click mic to stop
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="p-3">
        <TextareaAutosize
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about a symptom, a lab value, an interaction…"
          minRows={1}
          maxRows={6}
          disabled={disabled}
          className="w-full bg-transparent border-none outline-none resize-none text-[14.5px] px-2 py-1.5"
          style={{ color: '#0B1320', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        />

        <div className="flex items-center justify-between mt-2 gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => fileRef.current?.click()}
              aria-label="Attach file"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-brand-blue hover:bg-slate-50 transition-colors"
            >
              <FiPaperclip size={14} />
            </button>
            <button
              onClick={toggleRecording}
              aria-label="Voice input"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{
                background: recording ? 'rgba(239,68,68,0.08)' : 'transparent',
                color: recording ? '#ef4444' : '#64748b',
              }}
            >
              <FiMic size={14} />
            </button>
            {contextCount > 0 && (
              <span className="ml-2 text-[11px] hidden sm:inline" style={{ color: '#94a3b8' }}>
                Connected to <strong style={{ color: '#0B1320' }}>your {contextCount} reports</strong>
              </span>
            )}
          </div>

          <button
            onClick={handleSend}
            disabled={disabled || (!text.trim() && !file)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white font-semibold text-[13px] transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:transform-none"
            style={{ background: 'linear-gradient(135deg,#0F4C81,#1a6db5)' }}
          >
            Send <FiSend size={12} />
          </button>
        </div>
      </Card>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   Right rail — Conversation context · Quick prompts · Disclaimer
   ═══════════════════════════════════════════════════════════════════════ */
const ContextItem = memo(function ContextItem({ item }) {
  const Icon = item.icon
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] group"
      style={{ border: '1px solid #E6EEF5' }}
    >
      <Icon size={13} style={{ color: '#0F4C81' }} className="flex-shrink-0" />
      <span className="flex-1 min-w-0 truncate" style={{ color: '#475569' }}>{item.label}</span>
      <button className="opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Remove">
        <FiX size={11} style={{ color: '#94a3b8' }} />
      </button>
    </div>
  )
})

function ContextRail({ onPickPrompt }) {
  return (
    <aside className="hidden lg:flex flex-col gap-4 w-[280px] flex-shrink-0">
      {/* Conversation context */}
      <Card className="p-4">
        <Kicker>Conversation context</Kicker>
        <div className="flex flex-col gap-2 mt-3">
          {MOCK_CONTEXT.map(c => <ContextItem key={c.label} item={c} />)}
        </div>
        <button
          className="w-full mt-3 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold transition-colors hover:bg-slate-50"
          style={{ color: '#0F4C81', border: '1px solid #E6EEF5' }}
        >
          <FiPlus size={12} /> Attach more
        </button>
      </Card>

      {/* Quick prompts */}
      <Card className="p-4">
        <Kicker>Quick prompts</Kicker>
        <div className="flex flex-col gap-2 mt-3">
          {QUICK_PROMPTS.map(p => (
            <button
              key={p}
              onClick={() => onPickPrompt(p)}
              className="text-left px-3 py-2.5 rounded-lg text-[12.5px] transition-colors hover:-translate-y-0.5"
              style={{
                background: '#F8FBFD',
                border: '1px solid #E6EEF5',
                color: '#475569',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </Card>

      {/* Disclaimer callout */}
      <div
        className="rounded-xl p-3.5 flex items-start gap-2.5"
        style={{ background: 'rgba(255,159,67,0.08)', border: '1px solid rgba(255,159,67,0.22)' }}
      >
        <FiInfo size={14} style={{ color: '#b86b14', marginTop: 1 }} className="flex-shrink-0" />
        <p className="text-[11.5px] leading-relaxed" style={{ color: '#475569' }}>
          <strong style={{ color: '#0B1320' }}>Educational, not a diagnosis.</strong> For urgent
          symptoms — chest pain, breathing difficulty, severe bleeding — call{' '}
          <strong style={{ color: '#0B1320' }}>108</strong>.
        </p>
      </div>
    </aside>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   History dropdown — small popover in topbar for switching past chats
   ═══════════════════════════════════════════════════════════════════════ */
const HistoryDropdown = memo(function HistoryDropdown({ sessions, activeId, onSelect, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const recent = sessions?.slice(0, 12) || []

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-full text-[13px] font-semibold transition-colors hover:bg-slate-50"
        style={{ background: '#fff', border: '1px solid #E6EEF5', color: '#475569' }}
      >
        <FiClock size={13} /> History <FiChevronDown size={11} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-2xl shadow-xl py-2 z-50 max-h-[400px] overflow-y-auto bg-white"
          style={{ border: '1px solid #E6EEF5' }}
        >
          {recent.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12.5px]" style={{ color: '#94a3b8' }}>
              No past conversations yet.
            </p>
          ) : (
            recent.map(s => (
              <div
                key={s.id}
                className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-slate-50 group cursor-pointer"
                onClick={() => { onSelect(s.id); setOpen(false) }}
              >
                <FiMessageCircle size={13} style={{ color: activeId === s.id ? '#0F4C81' : '#94a3b8' }} />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[12.5px] font-medium truncate"
                    style={{ color: activeId === s.id ? '#0F4C81' : '#0B1320' }}
                  >
                    {s.title || 'Health consultation'}
                  </div>
                  <div className="text-[10.5px]" style={{ color: '#94a3b8' }}>
                    {timeAgo(s.created_at)}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); onDelete(s.id) }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  aria-label="Delete"
                >
                  <FiTrash2 size={11} style={{ color: '#ef4444' }} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════ */
export default function ChatPage() {
  const {
    messages, sessions, activeSession,
    isLoading, isTyping, bottomRef,
    loadSessions, loadSession, newSession,
    sendMessage, deleteSession,
  } = useChat()

  const toast = useToast()
  const [searchParams] = useSearchParams()

  const initRef = useRef(false)
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    const init = async () => {
      await loadSessions()
      const sessionId = searchParams.get('session')
      if (sessionId) await loadSession(sessionId)
      else await newSession()
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSend = useCallback(async (payload) => {
    try { await sendMessage(payload) }
    catch (err) { toast.error(err.message || 'Failed to send message') }
  }, [sendMessage, toast])

  const handleNew = useCallback(async () => {
    try { await newSession() }
    catch (err) { toast.error(err.message) }
  }, [newSession, toast])

  const handleSelect = useCallback(async (id) => {
    try { await loadSession(id) }
    catch (err) { toast.error(err.message) }
  }, [loadSession, toast])

  const handleDelete = useCallback(async (id) => {
    try { await deleteSession(id) }
    catch (err) { toast.error(err.message) }
  }, [deleteSession, toast])

  /* Pick a starter prompt: pushes new initial text into the composer.
     A counter ensures re-clicking the same prompt still re-fills the field. */
  const [pendingPrompt, setPendingPrompt] = useState({ text: '', counter: 0 })
  const handlePickPrompt = useCallback((text) => {
    setPendingPrompt(prev => ({ text, counter: prev.counter + 1 }))
  }, [])

  /* Title for topbar based on session */
  const subtitle = useMemo(() => {
    if (!activeSession) return 'New conversation'
    if (activeSession.title && activeSession.title !== 'New Chat') return activeSession.title
    return 'Health consultation'
  }, [activeSession])

  if (isLoading && !activeSession) return <LoadingSpinner fullScreen />

  return (
    <div className="flex min-h-screen" style={{ background: '#F8FBFD' }}>
      <DashboardSidebar />

      <main className="flex-1 min-h-screen flex flex-col overflow-x-hidden pb-20 lg:pb-0">
        <AppTopBar
          kicker="AI Assistant"
          title="Ask anything about your health"
          action={
            <div className="flex items-center gap-2">
              <HistoryDropdown
                sessions={sessions}
                activeId={activeSession?.id}
                onSelect={handleSelect}
                onDelete={handleDelete}
              />
              <button
                onClick={handleNew}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-white font-semibold text-[13px] transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg,#0F4C81,#1a6db5)' }}
              >
                <FiPlus size={13} /> New chat
              </button>
            </div>
          }
        />

        <div className="flex-1 p-6 lg:p-8 max-w-[1280px] w-full mx-auto">
          <div className="flex gap-6">
            {/* ── LEFT: Chat thread ─────────────────────────────────────── */}
            <section className="flex-1 min-w-0 flex flex-col" style={{ maxWidth: 760, marginLeft: 'auto', marginRight: 'auto' }}>
              <div className="flex-1 overflow-y-auto pr-1" style={{ minHeight: 'calc(100vh - 280px)' }}>
                {messages.length === 0 && !isTyping ? (
                  <EmptyState onPickPrompt={handlePickPrompt} />
                ) : (
                  <>
                    <DateDivider label={`${activeSession ? 'Today' : 'New chat'} · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} />
                    {messages.map((m, i) => (
                      m.role === 'user'
                        ? <UserMessage key={m.id || i} message={m} />
                        : <AIMessage   key={m.id || i} message={m} onCopy={() => toast.success('Copied to clipboard')} />
                    ))}
                    {isTyping && <TypingIndicator />}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>

              <Composer
                onSend={handleSend}
                disabled={isTyping}
                contextCount={MOCK_CONTEXT.length}
                key={pendingPrompt.counter}  /* remount when a prompt is picked */
                initialText={pendingPrompt.text}
              />

              <p className="text-center text-[10.5px] mt-2" style={{ color: '#94a3b8' }}>
                AI guidance only — always consult a licensed doctor for medical decisions.
                Session: <strong style={{ color: '#475569' }}>{subtitle}</strong>
              </p>
            </section>

            {/* ── RIGHT: Context rail ───────────────────────────────────── */}
            <ContextRail onPickPrompt={handlePickPrompt} />
          </div>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  )
}
