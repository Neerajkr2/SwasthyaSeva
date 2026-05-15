// src/pages/DoctorPortalPage.jsx
import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiSearch, FiFilter, FiStar, FiMapPin, FiClock, FiDollarSign,
  FiAward, FiChevronDown, FiPhone, FiCalendar,
  FiUser, FiHeart, FiShield, FiX, FiChevronRight, FiGlobe,
  FiCheckCircle, FiActivity, FiMessageSquare,
} from 'react-icons/fi'
import { doctorAPI } from '../services/api'
import DashboardSidebar from '../components/dashboard/DashboardSidebar'
import MobileBottomNav  from '../components/common/MobileBottomNav'
import AppTopBar        from '../components/dashboard/AppTopBar'

// ── Constants ─────────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'rating',     label: 'Top Rated' },
  { value: 'experience', label: 'Most Experienced' },
  { value: 'fee_low',    label: 'Fee: Low to High' },
  { value: 'fee_high',   label: 'Fee: High to Low' },
]

const SPECIALTY_ICONS = {
  'General Medicine':  FiActivity,
  'Cardiology':        FiHeart,
  'Neurology':         FiActivity,
  'Orthopedics':       FiShield,
  'Dermatology':       FiUser,
  'Pulmonology':       FiActivity,
  'Gastroenterology':  FiActivity,
  'Psychiatry':        FiMessageSquare,
  'Pediatrics':        FiHeart,
  'Endocrinology':     FiActivity,
  'ENT':               FiUser,
  'Ophthalmology':     FiUser,
  'Urology':           FiShield,
  'Gynecology':        FiHeart,
  'Oncology':          FiShield,
  'Nephrology':        FiActivity,
}

// ── Animations ────────────────────────────────────────────────────────────────
const fadeUp   = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } }
const stagger  = { animate: { transition: { staggerChildren: 0.06 } } }

// ── Star Rating ───────────────────────────────────────────────────────────────
function Stars({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <FiStar
          key={i}
          size={13}
          className={i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}
        />
      ))}
      <span className="text-xs font-semibold text-slate-600 ml-1">{rating}</span>
    </div>
  )
}

// ── Doctor Card ───────────────────────────────────────────────────────────────
function DoctorCard({ doctor, onSelect }) {
  const Icon = SPECIALTY_ICONS[doctor.specialty] || FiUser
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(15,76,129,0.12)' }}
      className="bg-white rounded-2xl border border-slate-100 overflow-hidden cursor-pointer group"
      onClick={() => onSelect(doctor)}
    >
      {/* Header band */}
      <div
        className="h-2"
        style={{ background: 'linear-gradient(90deg,#0F4C81,#00C2FF)' }}
      />

      <div className="p-5">
        {/* Top row: avatar + name */}
        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,rgba(15,76,129,0.12),rgba(0,194,255,0.08))' }}
          >
            <span className="text-xl font-bold text-sky-600">
              {doctor.name.split(' ').slice(-1)[0][0]}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-base truncate">{doctor.name}</h3>
              {doctor.is_verified && (
                <FiCheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-sky-600 font-medium">{doctor.specialty}</p>
            <p className="text-xs text-slate-400 truncate">{doctor.qualifications}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <FiAward size={12} className="text-violet-400" />
            {doctor.experience_years} yrs
          </span>
          <span className="flex items-center gap-1">
            <FiMapPin size={12} className="text-rose-400" />
            {doctor.location}
          </span>
          <span className="flex items-center gap-1">
            <FiDollarSign size={12} className="text-emerald-400" />
            ₹{doctor.consultation_fee}
          </span>
        </div>

        {/* Rating */}
        <div className="flex items-center justify-between">
          <Stars rating={doctor.rating} />
          <span className="flex items-center gap-1 text-xs text-sky-500 font-medium group-hover:text-sky-600 transition-colors">
            View Profile <FiChevronRight size={12} />
          </span>
        </div>

        {/* Specialization chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {doctor.specializations?.slice(0, 3).map(s => (
            <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 font-medium">
              {s}
            </span>
          ))}
          {(doctor.specializations?.length || 0) > 3 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-400">
              +{doctor.specializations.length - 3}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Doctor Detail Modal ───────────────────────────────────────────────────────
function DoctorDetail({ doctor, onClose }) {
  if (!doctor) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-6 text-white rounded-t-3xl"
          style={{ background: 'linear-gradient(135deg,#0F4C81,#00C2FF)' }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition"
          >
            <FiX size={18} />
          </button>

          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-3xl font-bold">
                {doctor.name.split(' ').slice(-1)[0][0]}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold">{doctor.name}</h2>
                {doctor.is_verified && (
                  <span className="flex items-center gap-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                    <FiCheckCircle size={11} /> Verified
                  </span>
                )}
              </div>
              <p className="text-white/80 text-sm">{doctor.specialty}</p>
              <p className="text-white/60 text-xs mt-0.5">{doctor.qualifications}</p>
            </div>
          </div>

          {/* Stats strip */}
          <div className="flex items-center gap-6 mt-5 text-sm">
            <span className="flex items-center gap-1.5">
              <FiAward size={14} />
              {doctor.experience_years} years
            </span>
            <span className="flex items-center gap-1.5">
              <FiStar size={14} className="fill-white" />
              {doctor.rating}
            </span>
            <span className="flex items-center gap-1.5">
              <FiMapPin size={14} />
              {doctor.location}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Bio */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <FiUser size={14} className="text-sky-500" /> About
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">{doctor.bio}</p>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4">
            <InfoBox
              icon={<FiMapPin size={16} className="text-rose-400" />}
              label="Hospital"
              value={doctor.hospital}
              sub={doctor.location}
            />
            <InfoBox
              icon={<FiDollarSign size={16} className="text-emerald-400" />}
              label="Consultation Fee"
              value={`₹${doctor.consultation_fee}`}
              sub="Per visit"
            />
            <InfoBox
              icon={<FiCalendar size={16} className="text-violet-400" />}
              label="Available Days"
              value={doctor.available_days?.join(', ')}
            />
            <InfoBox
              icon={<FiClock size={16} className="text-amber-400" />}
              label="Timings"
              value={doctor.available_hours}
            />
          </div>

          {/* Specializations */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <FiAward size={14} className="text-violet-500" /> Specializations
            </h3>
            <div className="flex flex-wrap gap-2">
              {doctor.specializations?.map(s => (
                <span
                  key={s}
                  className="text-xs px-3 py-1.5 rounded-full font-medium"
                  style={{ background: 'linear-gradient(135deg,rgba(15,76,129,0.08),rgba(0,194,255,0.06))', color: '#0F4C81' }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Languages */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <FiGlobe size={14} className="text-sky-500" /> Languages
            </h3>
            <div className="flex flex-wrap gap-2">
              {doctor.languages?.map(l => (
                <span key={l} className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                  {l}
                </span>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="flex gap-3 pt-2">
            <button
              className="flex-1 py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition"
              style={{ background: 'linear-gradient(135deg,#0F4C81,#00C2FF)' }}
              onClick={() => {
                alert(`In a production app, this would initiate a consultation request with ${doctor.name}.`)
              }}
            >
              <FiCalendar size={16} /> Book Consultation
            </button>
            <button
              className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm flex items-center gap-2 hover:bg-slate-50 transition"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function InfoBox({ icon, label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

// ── Specialty Quick-Filter Chips ──────────────────────────────────────────────
function SpecialtyChips({ specialties, active, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
          !active
            ? 'bg-sky-500 text-white shadow-sm'
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        }`}
      >
        All
      </button>
      {specialties.map(s => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
            active === s
              ? 'bg-sky-500 text-white shadow-sm'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function DoctorPortalPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Pre-fill specialty from query param (cross-module link from Symptom Checker)
  const preSpecialty = searchParams.get('specialty') || null

  const [doctors, setDoctors]           = useState([])
  const [specialties, setSpecialties]   = useState([])
  const [locations, setLocations]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [specialty, setSpecialty]       = useState(preSpecialty)
  const [location, setLocation]         = useState(null)
  const [sortBy, setSortBy]             = useState('rating')
  const [selected, setSelected]         = useState(null)
  const [showFilters, setShowFilters]   = useState(false)

  // ── Load metadata once ──────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([doctorAPI.specialties(), doctorAPI.locations()])
      .then(([sRes, lRes]) => {
        setSpecialties(sRes.data.specialties)
        setLocations(lRes.data.locations)
      })
      .catch(() => {})
  }, [])

  // ── Load doctors whenever filters change ────────────────────────────────
  useEffect(() => {
    setLoading(true)
    const params = { sort_by: sortBy }
    if (specialty) params.specialty = specialty
    if (location)  params.location  = location
    if (search.trim().length >= 2) params.search = search.trim()

    doctorAPI.list(params)
      .then(res => setDoctors(res.data.doctors))
      .catch(() => setDoctors([]))
      .finally(() => setLoading(false))
  }, [specialty, location, sortBy, search])

  // Debounced search — reuse above effect via search state
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  // ── Stats ───────────────────────────────────────────────────────────────
  const totalDoctors = doctors.length
  const avgRating    = doctors.length
    ? (doctors.reduce((s, d) => s + d.rating, 0) / doctors.length).toFixed(1)
    : '0'
  const uniqueHospitals = new Set(doctors.map(d => d.hospital)).size

  return (
    <div className="flex min-h-screen" style={{ background: '#F8FBFD' }}>
      <DashboardSidebar />

      <main className="flex-1 min-h-screen flex flex-col overflow-x-hidden pb-20 lg:pb-0">
        <AppTopBar
          kicker="Doctor portal"
          title="Find specialists & book consultations"
          action={
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-colors hover:bg-slate-50"
              style={{
                background: showFilters ? 'rgba(15,76,129,0.06)' : '#fff',
                border: `1px solid ${showFilters ? 'rgba(15,76,129,0.22)' : '#E6EEF5'}`,
                color: showFilters ? '#0F4C81' : '#475569',
              }}
            >
              <FiFilter size={13} /> Filters
            </button>
          }
        />

        <div className="flex-1 p-6 lg:p-8 max-w-[1280px] w-full mx-auto space-y-5">
          {/* Search bar */}
          <div className="relative">
            <FiSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#94a3b8' }} />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search doctors, specialties, hospitals..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl text-[14px] outline-none transition-colors"
              style={{ background: '#fff', border: '1px solid #E6EEF5', color: '#0B1320' }}
              onFocus={e => e.currentTarget.style.borderColor = '#0F4C81'}
              onBlur={e => e.currentTarget.style.borderColor = '#E6EEF5'}
            />
          </div>

        {/* ── Stats strip ────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Doctors',   value: totalDoctors, icon: FiUser,    color: '#0ea5e9' },
            { label: 'Avg Rating', value: avgRating,   icon: FiStar,    color: '#f59e0b' },
            { label: 'Hospitals', value: uniqueHospitals, icon: FiMapPin, color: '#8b5cf6' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 text-center">
              <s.icon size={18} className="mx-auto mb-1" style={{ color: s.color }} />
              <div className="text-xl font-bold text-slate-800">{s.value}</div>
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Filter panel (collapsible) ─────────────────────────────── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
                {/* Specialty chips */}
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Specialty</p>
                  <SpecialtyChips specialties={specialties} active={specialty} onSelect={setSpecialty} />
                </div>

                {/* Location + Sort row */}
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[140px]">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Location</p>
                    <select
                      value={location || ''}
                      onChange={e => setLocation(e.target.value || null)}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    >
                      <option value="">All Locations</option>
                      {locations.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Sort By</p>
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    >
                      {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Active filter badges */}
                {(specialty || location) && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-slate-400">Active:</span>
                    {specialty && (
                      <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        {specialty}
                        <FiX size={10} className="cursor-pointer" onClick={() => setSpecialty(null)} />
                      </span>
                    )}
                    {location && (
                      <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        {location}
                        <FiX size={10} className="cursor-pointer" onClick={() => setLocation(null)} />
                      </span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Results heading ────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">
            {specialty ? `${specialty} Doctors` : 'All Doctors'}
            <span className="text-sm font-normal text-slate-400 ml-2">({totalDoctors})</span>
          </h2>
          {!showFilters && (
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none text-slate-500"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
        </div>

        {/* ── Doctor grid ────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-3 border-sky-200 border-t-sky-500 rounded-full animate-spin mb-3" />
            <p className="text-sm text-slate-400">Loading doctors...</p>
          </div>
        ) : doctors.length === 0 ? (
          <div className="text-center py-20">
            <FiSearch size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">No doctors found</p>
            <p className="text-sm text-slate-400 mt-1">Try adjusting your filters or search terms</p>
            <button
              onClick={() => { setSpecialty(null); setLocation(null); setSearchInput('') }}
              className="mt-4 text-sm text-sky-500 hover:text-sky-600 font-medium"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {doctors.map(d => (
              <DoctorCard key={d.id} doctor={d} onSelect={setSelected} />
            ))}
          </motion.div>
        )}

        {/* ── Bottom info ────────────────────────────────────────────── */}
        <div className="text-center py-8">
          <p className="text-xs text-slate-300">
            Doctor profiles are curated for demonstration purposes.
            Always verify credentials independently.
          </p>
        </div>
        </div>
      </main>

      {/* ── Doctor Detail Modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {selected && <DoctorDetail doctor={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>

      <MobileBottomNav />
    </div>
  )
}
