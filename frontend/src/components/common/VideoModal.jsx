// src/components/common/VideoModal.jsx
import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiVolumeX } from 'react-icons/fi'

/**
 * Reusable, accessible video modal — for product demos, tutorials,
 * walkthroughs and future marketing videos.
 *
 * Props:
 *   open    — boolean, controls visibility
 *   onClose — () => void
 *   src     — video URL (web-optimized, faststart mp4 recommended)
 *   poster  — poster image shown while the video loads
 *   title   — accessible label / screen-reader heading
 *
 * Features: framer-motion open/close, backdrop blur, click-outside + ESC to
 * close, focus trap + focus restore, scroll lock, autoplay on open / pause on
 * close, native controls, loading spinner, and a fully responsive 16:9 frame
 * that never overflows (portrait, landscape, desktop, ultra-wide).
 */
export default function VideoModal({ open, onClose, src, poster, title = 'Product demo' }) {
  const videoRef   = useRef(null)
  const closeRef   = useRef(null)
  const dialogRef  = useRef(null)
  const restoreRef = useRef(null)              // element to refocus on close
  const onCloseRef = useRef(onClose)
  const [loading, setLoading] = useState(true)
  const [muted, setMuted]     = useState(true)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  // ── Scroll lock + ESC + focus trap + focus restore (only while open) ──────
  useEffect(() => {
    if (!open) return

    restoreRef.current = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e) => {
      if (e.key === 'Escape') { onCloseRef.current?.(); return }
      if (e.key === 'Tab' && dialogRef.current) {
        const f = dialogRef.current.querySelectorAll(
          'button, video, [href], [tabindex]:not([tabindex="-1"])'
        )
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const focusTimer = setTimeout(() => closeRef.current?.focus(), 60)

    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
      clearTimeout(focusTimer)
      restoreRef.current?.focus?.()            // return focus to the trigger
    }
  }, [open])

  // ── Autoplay on open, pause + reset on close ──────────────────────────────
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (open) {
      setLoading(true)
      setMuted(true)
      v.muted = true              // muted autoplay is permitted on every browser
      v.currentTime = 0
      const p = v.play()
      if (p && p.catch) p.catch(() => {/* extremely rare — controls available */})
    } else {
      v.pause()
    }
  }, [open])

  const onBackdrop = useCallback((e) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  const unmute = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = false
    if (v.paused) v.play().catch(() => {})
    setMuted(false)
  }, [])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6"
          style={{
            background: 'rgba(8,15,30,0.72)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onMouseDown={onBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            ref={dialogRef}
            className="relative w-full"
            /* Width is the smallest of: desktop cap (56rem), available width, or
               the width that keeps the 16:9 box within 80vh — so it fits every
               orientation (portrait, landscape, ultra-wide) with no overflow. */
            style={{ width: 'min(56rem, 100%, calc(80vh * 16 / 9))' }}
            initial={{ opacity: 0, scale: 0.95, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <div
              className="relative w-full overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10"
              style={{ aspectRatio: '16 / 9' }}
            >
              <video
                ref={videoRef}
                src={src}
                poster={poster}
                controls
                playsInline
                muted
                preload="metadata"
                aria-label={title}
                onLoadedData={() => setLoading(false)}
                onWaiting={() => setLoading(true)}
                onPlaying={() => setLoading(false)}
                onVolumeChange={() => { const v = videoRef.current; if (v) setMuted(v.muted) }}
                className="absolute inset-0 h-full w-full"
              />

              {/* Loading / buffering spinner */}
              {loading && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
                </div>
              )}

              {/* Unmute affordance — autoplays muted; one tap turns sound on */}
              {muted && !loading && (
                <button
                  onClick={unmute}
                  aria-label="Unmute video"
                  className="absolute top-2.5 left-2.5 z-20 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white/80"
                >
                  <FiVolumeX size={14} />
                  Tap to unmute
                </button>
              )}

              {/* Close — always visible over the top-right corner */}
              <button
                ref={closeRef}
                onClick={onClose}
                aria-label="Close video"
                className="absolute top-2.5 right-2.5 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75 focus:outline-none focus:ring-2 focus:ring-white/80"
              >
                <FiX size={18} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
