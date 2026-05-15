// frontend/src/components/dashboard/DashboardWidgets.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement,
  Tooltip, Legend, Filler,
} from 'chart.js'
import {
  FiMessageSquare, FiFileText, FiShield, FiCalendar,
  FiTrash2, FiUpload, FiFile, FiArrowRight,
  FiMessageCircle, FiDownload, FiX, FiEye,
} from 'react-icons/fi'
import { userAPI } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { formatDate, timeAgo } from '../../utils/helpers'

ChartJS.register(
  CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement,
  Tooltip, Legend, Filler,
)

const chartFont = { family: "'Plus Jakarta Sans', sans-serif" }
const chartBase = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top', labels: { font: chartFont, boxWidth: 12, padding: 12 } },
  },
}

function cleanVitals(form) {
  const out = {}
  for (const [k, v] of Object.entries(form)) {
    out[k] = (typeof v === 'string' && v.trim() === '') ? null : (v === undefined ? null : v)
  }
  return out
}

// ── StatsGrid ─────────────────────────────────────────────────────────────────
export function StatsGrid({ stats = {} }) {
  const cards = [
    { icon:FiMessageSquare, color:'#0ea5e9', bg:'#e0f2fe', label:'AI Consultations', value:stats.chat_count||0,   sub:'Total sessions' },
    { icon:FiFileText,      color:'#10b981', bg:'#d1fae5', label:'Reports Uploaded', value:stats.report_count||0, sub:'Analyzed by AI'  },
    { icon:FiShield,        color:'#8b5cf6', bg:'#ede9fe', label:'Health Score',     value:'78%',                 sub:'Good condition'  },
    {
      icon:FiCalendar, color:'#f59e0b', bg:'#fef3c7', label:'Member Since',
      value: stats.created_at ? formatDate(stats.created_at,{ month:'short', year:'numeric' }) : '—',
      sub:'Active member',
    },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
      {cards.map(c => {
        const Icon = c.icon
        return (
          <div key={c.label} className="card p-5 hover:-translate-y-1 group">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform" style={{background:c.bg}}>
              <Icon size={22} style={{color:c.color}}/>
            </div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{c.label}</div>
            <div className="text-2xl font-bold text-slate-800 leading-none mb-1">{c.value}</div>
            <div className="text-xs text-emerald-500">↑ {c.sub}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── HealthCharts ──────────────────────────────────────────────────────────────
export function HealthCharts() {
  return (
    <div className="grid lg:grid-cols-2 gap-6 mb-8">
      <div className="card p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-700 text-sm">Blood Pressure Trend</h3>
          <span className="text-xs text-slate-400">Last 6 months</span>
        </div>
        <div style={{height:200}}>
          <Line
            data={{ labels:['Jan','Feb','Mar','Apr','May','Jun'],
              datasets:[
                {label:'Systolic', data:[125,122,120,118,119,118], borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,0.08)', tension:.4, fill:true, borderWidth:2, pointRadius:4, pointBackgroundColor:'#ef4444'},
                {label:'Diastolic',data:[82,80,78,77,76,76],       borderColor:'#0ea5e9', backgroundColor:'rgba(14,165,233,0.08)',tension:.4, fill:true, borderWidth:2, pointRadius:4, pointBackgroundColor:'#0ea5e9'},
              ]}}
            options={{...chartBase, scales:{y:{min:60,max:140,grid:{color:'rgba(0,0,0,0.04)'}},x:{grid:{display:false}}}}}
          />
        </div>
      </div>
      <div className="card p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-700 text-sm">Weekly Steps</h3>
          <span className="text-xs text-slate-400">This week</span>
        </div>
        <div style={{height:200}}>
          <Bar
            data={{labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
              datasets:[{label:'Steps',data:[4200,6500,3800,7200,5100,8500,4500],backgroundColor:'rgba(16,185,129,0.7)',borderRadius:8,borderSkipped:false}]}}
            options={{...chartBase,plugins:{legend:{display:false}},scales:{y:{grid:{color:'rgba(0,0,0,0.04)'}},x:{grid:{display:false}}}}}
          />
        </div>
      </div>
      <div className="card p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-700 text-sm">Health Risk Assessment</h3>
          <span className="text-xs text-slate-400">AI Analysis</span>
        </div>
        <div style={{height:200}}>
          <Doughnut
            data={{labels:['Heart Health','Metabolic','Lung Health','Wellness'],
              datasets:[{data:[78,65,82,72],backgroundColor:['#0ea5e9','#f59e0b','#10b981','#8b5cf6'],borderWidth:0,hoverOffset:6}]}}
            options={{...chartBase,cutout:'65%',plugins:{legend:{position:'bottom',labels:{font:{...chartFont,size:11},boxWidth:10,padding:10}}}}}
          />
        </div>
      </div>
      <div className="card p-5 flex flex-col justify-between">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-700 text-sm">Biological Age Estimate</h3>
          <span className="text-xs text-slate-400">AI Analysis</span>
        </div>
        <div className="flex items-center gap-6 mb-5">
          <div>
            <div className="font-display text-5xl font-bold text-primary-500">35</div>
            <div className="text-xs text-slate-400 mt-1">Chronological Age</div>
          </div>
          <p className="text-slate-400 text-sm">Based on vitals &amp; reports</p>
        </div>
        <div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{width:'68%',background:'linear-gradient(135deg,#0F4C81,#00C2FF)'}}/>
          </div>
          <p className="text-xs text-slate-400 mt-2">✨ Keep tracking for a more accurate estimate</p>
        </div>
      </div>
    </div>
  )
}

// ── HealthMetrics ─────────────────────────────────────────────────────────────
export function HealthMetrics() {
  const metrics = [
    {icon:'🩸',label:'Fasting Glucose',  value:'92 mg/dL',   cls:'status-good',   badge:'Normal'    },
    {icon:'📊',label:'Total Cholesterol', value:'185 mg/dL',  cls:'status-warning',badge:'Borderline'},
    {icon:'🏃',label:'Daily Activity',   value:'4,500 steps', cls:'status-good',   badge:'+450 today'},
    {icon:'💧',label:'Hydration',        value:'1.8 L/day',   cls:'status-warning',badge:'Needs more'},
    {icon:'💤',label:'Sleep Quality',    value:'7.2 hrs',     cls:'status-good',   badge:'Good'      },
    {icon:'❤️',label:'Resting HR',       value:'72 bpm',      cls:'status-good',   badge:'Normal'    },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      {metrics.map(m => (
        <div key={m.label} className="card p-4 flex items-center gap-3">
          <div className="text-2xl flex-shrink-0">{m.icon}</div>
          <div>
            <div className="font-bold text-slate-800 text-sm">{m.value}</div>
            <div className="text-xs text-slate-400 mb-1">{m.label}</div>
            <span className={m.cls}>{m.badge}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── VitalsForm ────────────────────────────────────────────────────────────────
export function VitalsForm({ initial = {} }) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [form,   setForm]   = useState({
    age:initial.age??'', weight:initial.weight??'', height:initial.height??'',
    blood_group:initial.blood_group??'', blood_pressure:initial.blood_pressure??'', conditions:initial.conditions??'',
  })
  const handleSave = async () => {
    setSaving(true)
    try { await userAPI.updateVitals(cleanVitals(form)); toast.success('Vitals saved! ✅') }
    catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }
  const fields = [
    {name:'age',           label:'Age',                      ph:'35',      type:'number'},
    {name:'weight',        label:'Weight (kg)',               ph:'72',      type:'number'},
    {name:'height',        label:'Height (cm)',               ph:'175',     type:'number'},
    {name:'blood_group',   label:'Blood Group',               ph:'A+',      type:'text'  },
    {name:'blood_pressure',label:'Blood Pressure (Sys/Dia)', ph:'120/80',  type:'text'  },
    {name:'conditions',    label:'Known Conditions',          ph:'Diabetes…',type:'text' },
  ]
  return (
    <div className="card p-6">
      <h3 className="font-display font-bold text-slate-800 text-lg mb-2">Health Vitals Tracker</h3>
      <p className="text-slate-400 text-sm mb-6">Your vitals personalise AI responses and improve risk predictions.</p>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {fields.map(f => (
          <div key={f.name}>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">{f.label}</label>
            <input name={f.name} type={f.type} placeholder={f.ph} value={form[f.name]}
              onChange={e => setForm(v => ({...v,[f.name]:e.target.value}))}
              className="w-full px-4 py-3 text-sm border border-slate-200 rounded-2xl bg-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all placeholder:text-slate-400"/>
          </div>
        ))}
      </div>
      <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-60 gap-2">
        {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Saving…</> : '💾 Save Vitals'}
      </button>
    </div>
  )
}

// ── ReportsSection — with view modal + download ───────────────────────────────
export function ReportsSection({ reports = [], onDelete }) {
  const navigate   = useNavigate()
  const [selected, setSelected] = useState(null)

  const handleDownload = (report) => {
    if (!report.file_data) {
      alert('Download not available for this report (uploaded before file storage was enabled).')
      return
    }
    const a       = document.createElement('a')
    a.href        = report.file_data
    a.download    = report.original_name
    a.click()
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display font-bold text-slate-800 text-lg">My Medical Reports</h3>
        <button onClick={() => navigate('/report-analyzer')} className="btn-primary !py-2 !px-4 text-sm gap-2">
          <FiUpload size={14}/> Upload New
        </button>
      </div>

      {!reports.length ? (
        <div className="text-center py-12 text-slate-400">
          <FiFile size={40} className="mx-auto mb-3 opacity-30"/>
          <p className="text-sm">No reports uploaded yet.</p>
          <p className="text-xs mt-1">Use Report Analyzer to upload your first report.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id}
              className="flex items-center justify-between p-4 bg-slate-50 hover:bg-sky-50 rounded-2xl transition-colors cursor-pointer group"
              onClick={() => setSelected(r)}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-sky-100 group-hover:bg-sky-200 transition-colors">
                  <FiFile size={16} className="text-sky-500"/>
                </div>
                <div>
                  <div className="font-semibold text-slate-700 text-sm">{r.original_name}</div>
                  <div className="text-xs text-slate-400">{timeAgo(r.created_at)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="status-good">Analyzed</span>
                <button
                  onClick={e => { e.stopPropagation(); setSelected(r) }}
                  title="View report"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-sky-500 hover:bg-sky-50 transition-all">
                  <FiEye size={15}/>
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleDownload(r) }}
                  title="Download original file"
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 transition-all">
                  <FiDownload size={15}/>
                </button>
                {onDelete && (
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(r.id) }}
                    title="Delete report"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-400 hover:bg-red-50 transition-all">
                    <FiTrash2 size={15}/>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Report detail modal ── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:'rgba(15,23,42,0.65)', backdropFilter:'blur(8px)' }}
          onClick={() => setSelected(null)}>
          <div
            className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-slate-800 truncate max-w-xs">
                  {selected.original_name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{timeAgo(selected.created_at)}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {selected.file_data && (
                  <button
                    onClick={() => handleDownload(selected)}
                    className="btn-primary !py-2 !px-4 text-sm gap-1.5">
                    <FiDownload size={14}/> Download
                  </button>
                )}
                <button
                  onClick={() => setSelected(null)}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                  <FiX size={16}/>
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto p-6 space-y-5">
              {/* AI Analysis */}
              {selected.ai_analysis && (
                <div>
                  <h4 className="font-semibold text-slate-700 text-sm mb-3 flex items-center gap-2">
                    🤖 AI Interpretation
                  </h4>
                  <div className="bg-gradient-to-br from-sky-50 to-indigo-50 rounded-2xl p-5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap border border-sky-100">
                    {selected.ai_analysis}
                  </div>
                </div>
              )}

              {/* Extracted text */}
              {selected.extracted_text && (
                <details className="group">
                  <summary className="font-semibold text-slate-600 text-sm cursor-pointer hover:text-sky-500 transition-colors list-none flex items-center gap-2">
                    <span className="group-open:hidden">▶</span>
                    <span className="hidden group-open:block">▼</span>
                    📄 View extracted OCR text
                  </summary>
                  <pre className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-xl p-4 leading-relaxed whitespace-pre-wrap overflow-x-auto font-mono border border-slate-200">
                    {selected.extracted_text}
                  </pre>
                </details>
              )}

              {!selected.ai_analysis && !selected.extracted_text && (
                <div className="text-center py-8 text-slate-400">
                  <div className="text-4xl mb-3">📄</div>
                  <p className="text-sm">No analysis data available for this report.</p>
                  <p className="text-xs mt-1">Re-upload the file to generate a new analysis.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ChatHistory ───────────────────────────────────────────────────────────────
export function ChatHistory({ sessions = [], onOpen }) {
  return (
    <div className="card p-6">
      <h3 className="font-display font-bold text-slate-800 text-lg mb-5">Chat History</h3>
      {!sessions.length ? (
        <div className="text-center py-12 text-slate-400">
          <FiMessageCircle size={40} className="mx-auto mb-3 opacity-30"/>
          <p className="text-sm">No chat history yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...sessions].reverse().map(s => (
            <button key={s.id} onClick={() => onOpen(s.id)}
              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-sky-50 rounded-2xl transition-colors text-left group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-sky-100 group-hover:bg-sky-200 transition-colors">
                  <FiMessageCircle size={16} className="text-sky-500"/>
                </div>
                <div>
                  <div className="font-semibold text-slate-700 text-sm">{s.title||'Health Consultation'}</div>
                  <div className="text-xs text-slate-400">{timeAgo(s.created_at)} · {s.message_count||0} messages</div>
                </div>
              </div>
              <FiArrowRight size={16} className="text-slate-300 group-hover:text-sky-400 transition-colors"/>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── RecentActivity ────────────────────────────────────────────────────────────
export function RecentActivity({ sessions = [], reports = [] }) {
  const activities = [
    ...sessions.slice(-3).map(s => ({icon:'🤖',label:'AI Consultation',sub:`${s.message_count||0} messages`,ts:s.created_at})),
    ...reports.slice(-3).map(r  => ({icon:'📄',label:'Report Uploaded', sub:r.original_name,                ts:r.created_at})),
  ].sort((a,b) => new Date(b.ts)-new Date(a.ts)).slice(0,5)

  if (!activities.length) return (
    <div className="text-center py-10 text-slate-400">
      <div className="text-4xl mb-2 opacity-30">🤖</div>
      <p className="text-sm">No activity yet. Start a chat to begin!</p>
    </div>
  )
  return (
    <div className="space-y-2">
      {activities.map((a,i) => (
        <div key={i} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-sky-50 text-xl flex-shrink-0">{a.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-700 text-sm">{a.label}</div>
            <div className="text-xs text-slate-400 truncate">{a.sub}</div>
          </div>
          <div className="text-xs text-slate-300 flex-shrink-0">{timeAgo(a.ts)}</div>
        </div>
      ))}
    </div>
  )
}
