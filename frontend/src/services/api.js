// frontend/src/services/api.js
import axios from 'axios'
import { auth } from './firebase'

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const api  = axios.create({ baseURL: BASE, timeout: 60000 })

// ── Token storage ─────────────────────────────────────────────────────────────
export const TOKEN_KEY     = 'ss_access_token'
export const getStoredToken = ()  => localStorage.getItem(TOKEN_KEY)
export const storeToken = (t)     => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = ()      => localStorage.removeItem(TOKEN_KEY)

// ── Request interceptor ───────────────────────────────────────────────────────
api.interceptors.request.use(async (config) => {
  const stored = getStoredToken()
  if (stored) {
    config.headers.Authorization = `Bearer ${stored}`
    return config
  }
  const user = auth.currentUser
  if (user) {
    const token = await user.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Response interceptor ──────────────────────────────────────────────────────
api.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.detail || err.message || 'Something went wrong'
    if (err.response?.status === 401 && getStoredToken()) {
      clearToken()
      window.location.href = '/'
    }
    return Promise.reject(new Error(msg))
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  loginWithGoogle:   (idToken, captchaToken) =>
    api.post('/auth/google', { id_token: idToken, captcha_token: captchaToken }),
  registerWithEmail: (data) => api.post('/auth/register', data),
  loginWithEmail:    (data) => api.post('/auth/login',    data),
  getProfile:        ()     => api.get('/auth/me'),
}

// ── ML / AI ───────────────────────────────────────────────────────────────────
export const mlAPI = {
  // Text-based free-form symptom analysis (existing flow)
  analyzeSymptoms:      (symptoms)     => api.post('/ml/symptoms',         { symptoms }),

  // NEW: fetch canonical 377-feature symptom list for the selection panel
  getSymptomList:       ()             => api.get('/ml/symptom-list'),

  // NEW: selection-based NB analysis — symptoms is string[] from the canonical list
  analyzeSymptomsList:  (symptoms)     => api.post('/ml/symptoms/select',  { symptoms }),

  predictRisk:          (params)       => api.post('/ml/risk',             params),
  checkDrugInteraction: (drugs)        => api.post('/ml/drugs',            { drugs }),
  analyzeReport:        (formData)     => api.post('/ml/report',           formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  }),
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export const chatAPI = {
  sendMessage:   (payload) => api.post('/chat/message',          payload),
  getSessions:   ()        => api.get('/chat/sessions'),
  getSession:    (id)      => api.get(`/chat/sessions/${id}`),
  createSession: ()        => api.post('/chat/sessions'),
  deleteSession: (id)      => api.delete(`/chat/sessions/${id}`),
}

// ── User / Vitals ─────────────────────────────────────────────────────────────
export const userAPI = {
  // User endpoints
  updateVitals:      (vitals) => api.put('/users/vitals',   vitals),
  getVitals:         ()       => api.get('/users/vitals'),
  updatePhoto:       (url)    => api.patch('/users/photo',  { photo_url: url }),
  getReports:        ()       => api.get('/users/reports'),
  getReport:         (id)     => api.get(`/users/reports/${id}`),
  deleteReport:      (id)     => api.delete(`/users/reports/${id}`),
  getDashboardStats: ()       => api.get('/users/dashboard'),

  // Admin endpoints
  adminListUsers:    ()              => api.get('/users/admin/all'),
  adminGetStats:     ()              => api.get('/users/admin/stats'),
  adminSetRole:      (id, role)      => api.patch(`/users/admin/role/${id}`, { role }),
  adminDeleteUser:   (id)            => api.delete(`/users/admin/users/${id}`),
  adminToggleActive: (id)            => api.patch(`/users/admin/toggle-active/${id}`),
  adminUserDetail:   (id)            => api.get(`/users/admin/user/${id}`),
  adminActivity:     ()              => api.get('/users/admin/activity'),
}

// ── Doctors ──────────────────────────────────────────────────────────────────
export const doctorAPI = {
  list:          (params) => api.get('/doctors/list',       { params }),
  specialties:   ()       => api.get('/doctors/specialties'),
  locations:     ()       => api.get('/doctors/locations'),
  recommend:     (symptoms) => api.get('/doctors/recommend', { params: { symptoms } }),
  getDoctor:     (id)     => api.get(`/doctors/${id}`),
}

export default api
