// src/utils/helpers.js

export const getInitials = (name = '') =>
  name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) || 'U'

export const timeAgo = (ts) => {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export const formatDate = (ts, opts = {}) =>
  new Date(ts).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', ...opts
  })

export const formatBytes = (bytes) => {
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1048576)    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export const greeting = (name = '') => {
  const h = new Date().getHours()
  const g = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'
  return `${g}, ${name.split(' ')[0] || 'there'}!`
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms))

export const clx = (...classes) => classes.filter(Boolean).join(' ')
