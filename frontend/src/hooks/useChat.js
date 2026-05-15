// src/hooks/useChat.js
// Module 3: Enhanced chat hook with search support and session metadata
import { useState, useCallback, useRef } from 'react'
import { chatAPI } from '../services/api'

export function useChat() {
  const [sessions,      setSessions]      = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [messages,      setMessages]      = useState([])
  const [isLoading,     setIsLoading]     = useState(false)
  const [isTyping,      setIsTyping]      = useState(false)
  const bottomRef = useRef(null)

  const scrollToBottom = () =>
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })

  // ── Load all sessions ───────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data } = await chatAPI.getSessions()
      setSessions(data || [])
    } catch (err) {
      console.error('loadSessions:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ── Load single session ─────────────────────────────────────────────────────
  const loadSession = useCallback(async (id) => {
    setIsLoading(true)
    try {
      const { data } = await chatAPI.getSession(id)
      setActiveSession(data)
      setMessages(data.messages || [])
      setTimeout(scrollToBottom, 100)
    } catch (err) {
      console.error('loadSession:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ── Create new session ──────────────────────────────────────────────────────
  const newSession = useCallback(async () => {
    const { data } = await chatAPI.createSession()
    setActiveSession(data)
    setMessages([])
    setSessions(prev => [data, ...prev])
    return data
  }, [])

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async ({ text, file }) => {
    if (!activeSession) return

    const userMsg = {
      id:         Date.now().toString(),
      role:       'user',
      content:    text || (file ? `[Uploaded: ${file.name}]` : ''),
      file_name:  file?.name || null,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)
    setTimeout(scrollToBottom, 50)

    try {
      const formData = new FormData()
      formData.append('session_id', activeSession.id)
      formData.append('message', text || '')
      if (file) formData.append('file', file)

      const { data } = await chatAPI.sendMessage(formData)

      const botMsg = {
        ...data.reply,
        id: (Date.now() + 1).toString(),
      }
      setMessages(prev => [...prev, botMsg])

      // Update session title on first real message
      if (messages.length === 0 && text?.trim()) {
        const trimmedTitle = text.trim().slice(0, 55)
        setSessions(prev =>
          prev.map(s => s.id === activeSession.id ? { ...s, title: trimmedTitle } : s)
        )
        setActiveSession(prev => prev ? { ...prev, title: trimmedTitle } : prev)
      }
    } catch (err) {
      // Show error message in chat
      const errMsg = {
        id:         (Date.now() + 2).toString(),
        role:       'assistant',
        content:    `⚠️ ${err.message || 'Something went wrong. Please try again.'}`,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setIsTyping(false)
      setTimeout(scrollToBottom, 100)
    }
  }, [activeSession, messages.length])

  // ── Delete session ──────────────────────────────────────────────────────────
  const deleteSession = useCallback(async (id) => {
    try {
      await chatAPI.deleteSession(id)
      setSessions(prev => prev.filter(s => s.id !== id))
      if (activeSession?.id === id) {
        setActiveSession(null)
        setMessages([])
      }
    } catch (err) {
      console.error('deleteSession:', err)
    }
  }, [activeSession])

  // ── Clear current conversation (local only) ─────────────────────────────────
  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return {
    sessions, activeSession, messages,
    isLoading, isTyping, bottomRef,
    loadSessions, loadSession, newSession,
    sendMessage, deleteSession, clearMessages,
  }
}
