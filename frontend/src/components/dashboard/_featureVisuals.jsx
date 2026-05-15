// src/components/dashboard/_featureVisuals.jsx
/**
 * Feature-specific decorative visuals for the dashboard quick-action cards.
 *
 * Each visual is a memo'd SVG that paints a small, meaningful illustration
 * representing the actual feature use case — replacing the previous
 * abstract sparklines that didn't communicate what each card did.
 *
 *   • SymptomVisual   → ECG/pulse waveform with one distinct heartbeat
 *   • ReportVisual    → Stack of documents with "scanned" text lines
 *   • AssistantVisual → Two chat bubbles with typing-dot animation
 */
import { memo } from 'react'

/* ───────────────────────────────────────────────────────────────────────────
   1. SYMPTOM CHECK — ECG/pulse waveform
   ─────────────────────────────────────────────────────────────────────── */
export const SymptomVisual = memo(function SymptomVisual({ color = '#0F4C81' }) {
  return (
    <svg
      width="100%"
      height="46"
      viewBox="0 0 220 46"
      preserveAspectRatio="none"
      role="img"
      aria-label="Heart-rate pulse"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="pulse-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={color} stopOpacity="0" />
          <stop offset="20%"  stopColor={color} stopOpacity="0.45" />
          <stop offset="80%"  stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Soft baseline glow */}
      <line x1="0" y1="23" x2="220" y2="23" stroke={color} strokeOpacity="0.08" strokeWidth="1" />

      {/* The pulse line with one distinct QRS spike */}
      <path
        d="M0 23 L60 23 L72 23 L78 14 L84 33 L90 6 L96 38 L102 23 L120 23 L135 23 L142 18 L149 28 L156 23 L220 23"
        fill="none"
        stroke="url(#pulse-fade)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Soft dot at the peak — feels "alive" */}
      <circle cx="90" cy="6" r="1.6" fill={color} opacity="0.7" />
    </svg>
  )
})

/* ───────────────────────────────────────────────────────────────────────────
   2. UPLOAD REPORT — Mini document with scanned text lines
   ─────────────────────────────────────────────────────────────────────── */
export const ReportVisual = memo(function ReportVisual({ color = '#0E7490' }) {
  return (
    <svg
      width="100%"
      height="46"
      viewBox="0 0 220 46"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Medical report"
      style={{ display: 'block' }}
    >
      {/* Back document */}
      <rect x="88" y="6" width="48" height="36" rx="3"
        fill="white" stroke={color} strokeOpacity="0.25" strokeWidth="1" />
      <line x1="94" y1="14" x2="118" y2="14" stroke={color} strokeOpacity="0.30" strokeWidth="1" />
      <line x1="94" y1="20" x2="124" y2="20" stroke={color} strokeOpacity="0.30" strokeWidth="1" />
      <line x1="94" y1="26" x2="114" y2="26" stroke={color} strokeOpacity="0.30" strokeWidth="1" />

      {/* Front document (slightly offset, gives a "stack" feel) */}
      <rect x="98" y="11" width="48" height="36" rx="3"
        fill="white" stroke={color} strokeWidth="1.2" />
      {/* Lab header chip on front */}
      <rect x="103" y="16" width="14" height="3" rx="1.5" fill={color} opacity="0.7" />
      {/* "Lines" representing lab values */}
      <line x1="103" y1="24" x2="141" y2="24" stroke={color} strokeOpacity="0.45" strokeWidth="1" />
      <line x1="103" y1="29" x2="135" y2="29" stroke={color} strokeOpacity="0.45" strokeWidth="1" />
      <line x1="103" y1="34" x2="138" y2="34" stroke={color} strokeOpacity="0.45" strokeWidth="1" />
      <line x1="103" y1="39" x2="128" y2="39" stroke={color} strokeOpacity="0.45" strokeWidth="1" />

      {/* Scan/analysis tick on the front doc */}
      <circle cx="139" cy="16.5" r="3.5" fill={color} />
      <path d="M137.4 16.7 L138.7 18 L141 15.5" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
})

/* ───────────────────────────────────────────────────────────────────────────
   3. ASK ASSISTANT — Two chat bubbles with typing dots
   ─────────────────────────────────────────────────────────────────────── */
export const AssistantVisual = memo(function AssistantVisual({ color = '#2ECC71' }) {
  return (
    <svg
      width="100%"
      height="46"
      viewBox="0 0 220 46"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="AI conversation"
      style={{ display: 'block' }}
    >
      {/* User bubble (top-left side) */}
      <rect x="60" y="6" width="58" height="14" rx="7"
        fill={color} fillOpacity="0.10" stroke={color} strokeOpacity="0.25" strokeWidth="1" />
      <line x1="68" y1="13" x2="98" y2="13" stroke={color} strokeOpacity="0.45" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="68" y1="13" x2="86" y2="13" stroke={color} strokeOpacity="0.0" strokeWidth="1.2" />

      {/* Assistant bubble (bottom-right, filled — "active reply") */}
      <rect x="104" y="26" width="62" height="14" rx="7" fill={color} />
      {/* Animated typing dots */}
      <circle cx="120" cy="33" r="1.8" fill="white">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" begin="0s"   />
      </circle>
      <circle cx="128" cy="33" r="1.8" fill="white">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" begin="0.2s" />
      </circle>
      <circle cx="136" cy="33" r="1.8" fill="white">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" begin="0.4s" />
      </circle>

      {/* Tiny sparkle near the assistant bubble — "AI is thinking" */}
      <path d="M158 24 L159.5 26 L161 24 L159.5 22 Z" fill={color} opacity="0.6" />
    </svg>
  )
})
