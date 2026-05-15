// src/components/landing/Features.jsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { FiCheck, FiX } from 'react-icons/fi'
import { Section, SectionHeading } from './_shared'

// ── SECTION 4: What You Can Do (Visual Product Demo) ─────────────────────────
const PRODUCT_TABS = [
  {
    id: 'symptoms',
    emoji: '🤒',
    label: 'When you feel sick',
    color: '#0F4C81',
    bg: '#e8f0f8',
    demo: {
      title: 'Tell us what hurts',
      input: '"I have a headache and feel dizzy"',
      results: [
        { name: 'Could be: Tired eyes',   match: 78, color: '#2ECC71', tag: 'Most likely', mood: '😌' },
        { name: 'Could be: Dehydration',   match: 56, color: '#FF9F43', tag: 'Maybe',       mood: '🤔' },
        { name: 'Could be: Migraine',     match: 32, color: '#94a3b8', tag: 'Less likely', mood: '🙂' },
      ],
      tip: 'Drink water and rest. See a doctor if it gets worse.',
    },
  },
  {
    id: 'report',
    emoji: '📋',
    label: 'When you have a report',
    color: '#2ECC71',
    bg: '#e8f8ef',
    demo: {
      title: 'Your blood test &mdash; explained',
      tag: 'Mostly good!',
      tagColor: '#2ECC71',
      lines: [
        { label: 'Hemoglobin',     value: '14.2', plain: 'Good blood',          status: 'good'   },
        { label: 'Blood Sugar',    value: '98',   plain: 'Normal',               status: 'good'   },
        { label: 'Cholesterol',    value: '215',  plain: 'A bit high',           status: 'warn'   },
        { label: 'Vitamin D',      value: '18',   plain: 'You need more',        status: 'warn'   },
      ],
      tip: 'Eat less oily food. Sit in the sun for 15 mins daily.',
    },
  },
  {
    id: 'drugs',
    emoji: '💊',
    label: 'When you take medicine',
    color: '#FF9F43',
    bg: '#fff3e6',
    demo: {
      title: 'Is it safe to take these together?',
      drugs: [
        { name: 'Aspirin', emoji: '💊' },
        { name: 'Warfarin', emoji: '💊' },
      ],
      severity: 'Careful!',
      message: 'These together can cause bleeding. Ask your doctor first.',
      tip: 'Never mix without asking your doctor.',
    },
  },
  {
    id: 'risk',
    emoji: '❤️',
    label: 'For your future health',
    color: '#00C2FF',
    bg: '#e6f9ff',
    demo: {
      title: 'Your health forecast',
      risks: [
        { disease: 'Heart health',  risk: 18, level: 'Looking good', emoji: '💚' },
        { disease: 'Diabetes risk', risk: 35, level: 'Watch out',    emoji: '⚠️' },
        { disease: 'Bone health',   risk: 12, level: 'Strong',       emoji: '💪' },
      ],
      tip: 'Eat less sugar &amp; walk 30 mins daily &mdash; you&rsquo;ll feel great!',
    },
  },
]

function ProductExperience({ inView }) {
  const [activeId, setActiveId] = useState('symptoms')
  const active = PRODUCT_TABS.find(t => t.id === activeId)

  return (
    <Section id="features">
      <SectionHeading
        eyebrow="🩺 What we do"
        eyebrowColor="blue"
        title={<>Like having a doctor friend <span style={{ color: '#0F4C81' }}>in your pocket</span></>}
        subtitle="We help with 4 everyday health worries. Tap any to see how."
        inView={inView}
      />

        {/* Tab buttons (large, friendly) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8 max-w-4xl mx-auto"
        >
          {PRODUCT_TABS.map(t => {
            const isActive = activeId === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-300 ${
                  isActive ? 'scale-[1.03]' : 'hover:scale-[1.02]'
                }`}
                style={{
                  background: isActive ? t.bg : '#F8FBFD',
                  border: `2px solid ${isActive ? t.color : '#E6EEF5'}`,
                  boxShadow: isActive ? `0 8px 24px ${t.color}20` : 'none',
                }}
              >
                <span className="text-3xl">{t.emoji}</span>
                <span
                  className="text-xs sm:text-sm font-bold leading-tight"
                  style={{ color: isActive ? t.color : '#4a5568' }}
                >
                  {t.label}
                </span>
              </button>
            )
          })}
        </motion.div>

        {/* Demo content area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="max-w-4xl mx-auto"
        >
          <div
            className="bg-white rounded-3xl border-2 p-6 sm:p-8"
            style={{
              borderColor: active.color + '30',
              boxShadow: `0 20px 60px ${active.color}15`,
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {/* SYMPTOMS DEMO */}
                {activeId === 'symptoms' && (
                  <div>
                    <h3 className="font-display text-xl sm:text-2xl font-bold mb-5" style={{ color: '#0B1320' }}>
                      {active.demo.title}
                    </h3>

                    {/* User question bubble */}
                    <div className="flex justify-end mb-5">
                      <div className="bg-slate-100 rounded-2xl rounded-tr-sm px-4 py-3 max-w-md">
                        <p className="text-sm" style={{ color: '#0B1320' }}>{active.demo.input}</p>
                      </div>
                    </div>

                    {/* AI response */}
                    <div className="flex gap-3 mb-5">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm"
                        style={{ background: 'linear-gradient(135deg,#0F4C81,#00C2FF)' }}
                      >
                        AI
                      </div>
                      <div className="flex-1 bg-[#F8FBFD] rounded-2xl rounded-tl-sm px-4 py-3 border border-brand-border">
                        <p className="text-sm font-medium mb-3" style={{ color: '#0B1320' }}>
                          Here&rsquo;s what it might be:
                        </p>
                        <div className="space-y-3">
                          {active.demo.results.map((r, i) => (
                            <div key={r.name} className="flex items-center gap-3">
                              <span className="text-xl">{r.mood}</span>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium" style={{ color: '#0B1320' }}>{r.name}</span>
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: r.color + '15', color: r.color }}>
                                    {r.tag}
                                  </span>
                                </div>
                                <div className="bg-white rounded-full h-2 overflow-hidden border border-brand-border">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${r.match}%` }}
                                    transition={{ duration: 1, delay: 0.3 + i * 0.15 }}
                                    className="h-full rounded-full"
                                    style={{ background: r.color }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Simple tip */}
                    <div
                      className="rounded-2xl p-4 flex items-start gap-3"
                      style={{ background: '#e8f8ef', border: '1px solid #2ECC7130' }}
                    >
                      <span className="text-2xl">💡</span>
                      <p className="text-sm font-medium" style={{ color: '#0B1320' }}>
                        <strong>What to do:</strong> {active.demo.tip}
                      </p>
                    </div>
                  </div>
                )}

                {/* REPORT DEMO */}
                {activeId === 'report' && (
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <h3
                        className="font-display text-xl sm:text-2xl font-bold"
                        style={{ color: '#0B1320' }}
                        dangerouslySetInnerHTML={{ __html: active.demo.title }}
                      />
                      <span
                        className="text-xs font-bold px-3 py-1.5 rounded-full text-white flex items-center gap-1"
                        style={{ background: active.demo.tagColor }}
                      >
                        <span>✓</span> {active.demo.tag}
                      </span>
                    </div>

                    <div className="space-y-3 mb-5">
                      {active.demo.lines.map(l => (
                        <div
                          key={l.label}
                          className="flex items-center gap-4 p-3 rounded-xl border border-brand-border bg-[#F8FBFD]"
                        >
                          <span className="text-2xl">{l.status === 'good' ? '✅' : '⚠️'}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-bold" style={{ color: '#0B1320' }}>{l.label}</span>
                              <span className="text-xs text-slate-400">({l.value})</span>
                            </div>
                            <p className="text-sm" style={{ color: l.status === 'good' ? '#2ECC71' : '#FF9F43' }}>
                              {l.plain}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      className="rounded-2xl p-4 flex items-start gap-3"
                      style={{ background: '#e8f0f8', border: '1px solid #0F4C8130' }}
                    >
                      <span className="text-2xl">💡</span>
                      <p className="text-sm font-medium" style={{ color: '#0B1320' }}>
                        <strong>What to do:</strong> {active.demo.tip}
                      </p>
                    </div>
                  </div>
                )}

                {/* DRUGS DEMO */}
                {activeId === 'drugs' && (
                  <div>
                    <h3 className="font-display text-xl sm:text-2xl font-bold mb-5" style={{ color: '#0B1320' }}>
                      {active.demo.title}
                    </h3>

                    {/* Medicine cards */}
                    <div className="flex flex-wrap gap-3 mb-5 items-center justify-center">
                      {active.demo.drugs.map((d, i) => (
                        <div key={d.name}>
                          <div className="bg-[#F8FBFD] rounded-2xl px-5 py-4 flex items-center gap-2 border-2 border-brand-border">
                            <span className="text-3xl">{d.emoji}</span>
                            <span className="text-base font-bold" style={{ color: '#0B1320' }}>{d.name}</span>
                          </div>
                          {i === 0 && <div className="text-center text-2xl text-slate-300 my-1">+</div>}
                        </div>
                      ))}
                    </div>

                    {/* Warning */}
                    <div className="bg-red-50 rounded-2xl p-5 border-2 border-red-200 mb-5">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">⚠️</span>
                        <span className="text-lg font-bold text-red-600">{active.demo.severity}</span>
                      </div>
                      <p className="text-base" style={{ color: '#0B1320' }}>{active.demo.message}</p>
                    </div>

                    <div
                      className="rounded-2xl p-4 flex items-start gap-3"
                      style={{ background: '#fff3e6', border: '1px solid #FF9F4330' }}
                    >
                      <span className="text-2xl">💡</span>
                      <p className="text-sm font-medium" style={{ color: '#0B1320' }}>
                        <strong>What to do:</strong> {active.demo.tip}
                      </p>
                    </div>
                  </div>
                )}

                {/* RISK DEMO */}
                {activeId === 'risk' && (
                  <div>
                    <h3 className="font-display text-xl sm:text-2xl font-bold mb-5" style={{ color: '#0B1320' }}>
                      {active.demo.title}
                    </h3>

                    <div className="space-y-4 mb-5">
                      {active.demo.risks.map(r => (
                        <div key={r.disease} className="p-4 rounded-xl border border-brand-border bg-[#F8FBFD]">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{r.emoji}</span>
                              <span className="text-base font-bold" style={{ color: '#0B1320' }}>{r.disease}</span>
                            </div>
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                              r.risk < 25 ? 'bg-green-50 text-green-600' :
                              r.risk < 50 ? 'bg-amber-50 text-amber-600' :
                                            'bg-red-50 text-red-600'
                            }`}>
                              {r.level}
                            </span>
                          </div>
                          <div className="bg-white rounded-full h-3 overflow-hidden border border-brand-border">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${r.risk}%` }}
                              transition={{ duration: 1, delay: 0.3 }}
                              className="h-full rounded-full"
                              style={{
                                background: r.risk < 25
                                  ? 'linear-gradient(90deg,#2ECC71,#20B2AA)'
                                  : 'linear-gradient(90deg,#FF9F43,#e74c3c)',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div
                      className="rounded-2xl p-4 flex items-start gap-3"
                      style={{ background: '#e6f9ff', border: '1px solid #00C2FF30' }}
                    >
                      <span className="text-2xl">💡</span>
                      <p
                        className="text-sm font-medium"
                        style={{ color: '#0B1320' }}
                        dangerouslySetInnerHTML={{
                          __html: `<strong>What to do:</strong> ${active.demo.tip}`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
    </Section>
  )
}

// ── SECTION 5: Why Choose Us (Before vs After) ───────────────────────────────
function WhyDifferent({ inView }) {
  return (
    <Section background="#F8FBFD" containerClassName="max-w-6xl">
      <SectionHeading
        eyebrow="✨ See the difference"
        eyebrowColor="cyan"
        title="Before vs After SwasthyaSeva"
        subtitle="See how your health journey changes when you have us by your side."
        inView={inView}
      />

      {/* Before / After comparison */}
      <div className="grid md:grid-cols-2 gap-6">
          {/* BEFORE */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white rounded-3xl p-7 border border-brand-border"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl bg-slate-100">
                😟
              </div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Before</div>
                <h3 className="font-display text-xl font-bold" style={{ color: '#0B1320' }}>The old way</h3>
              </div>
            </div>

            <div className="space-y-3">
              {[
                'Searching Google &mdash; getting scary results',
                'Confusing medical reports you can&rsquo;t read',
                'Worry about which medicines mix safely',
                'Waiting weeks for a doctor visit',
                'Feeling alone with health worries',
              ].map(item => (
                <div key={item} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FiX size={14} className="text-red-400" />
                  </div>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: '#4a5568' }}
                    dangerouslySetInnerHTML={{ __html: item }}
                  />
                </div>
              ))}
            </div>
          </motion.div>

          {/* AFTER */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative bg-white rounded-3xl p-7 border-2"
            style={{
              borderColor: '#0F4C81',
              boxShadow: '0 20px 60px rgba(15,76,129,0.15)',
            }}
          >
            {/* Highlight badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span
                className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full text-white text-xs font-bold"
                style={{ background: 'linear-gradient(135deg,#0F4C81,#00C2FF)' }}
              >
                ⭐ With SwasthyaSeva
              </span>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: '#e8f8ef' }}
              >
                😊
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: '#0F4C81' }}>After</div>
                <h3 className="font-display text-xl font-bold" style={{ color: '#0B1320' }}>The smart way</h3>
              </div>
            </div>

            <div className="space-y-3">
              {[
                'Get answers in plain English &mdash; in minutes',
                'Reports explained like a friend would',
                'Instant medicine safety checks',
                '24/7 health guidance &mdash; anytime, anywhere',
                'Peace of mind for your whole family',
              ].map(item => (
                <div key={item} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FiCheck size={14} className="text-green-500" />
                  </div>
                  <p
                    className="text-sm font-medium leading-relaxed"
                    style={{ color: '#0B1320' }}
                    dangerouslySetInnerHTML={{ __html: item }}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center mt-10"
        >
          <p className="text-base text-slate-500">
            <strong className="text-brand-text">10,000+ families</strong> already made the switch.
            <span className="text-amber-500 ml-2">⭐⭐⭐⭐⭐</span>
          </p>
        </motion.div>
    </Section>
  )
}

// ── Combined Export ──────────────────────────────────────────────────────────
export default function Features() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.05 })

  return (
    <div ref={ref}>
      <ProductExperience inView={inView} />
      <WhyDifferent inView={inView} />
    </div>
  )
}
