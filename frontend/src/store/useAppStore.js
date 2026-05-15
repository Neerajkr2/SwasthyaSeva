// src/store/useAppStore.js
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * Global Zustand store — persisted in sessionStorage.
 * Holds UI state that should survive navigation but not browser restart.
 */
const useAppStore = create(
  persist(
    (set, get) => ({
      // ── Theme ───────────────────────────────────────────────────────────────
      theme: 'light',
      toggleTheme: () => set(s => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),

      // ── Sidebar collapse (dashboard) ────────────────────────────────────────
      sidebarCollapsed: false,
      toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      // ── Recent searches (symptom checker) ──────────────────────────────────
      recentSymptoms: [],
      addRecentSymptom: (text) =>
        set(s => ({
          recentSymptoms: [text, ...s.recentSymptoms.filter(t => t !== text)].slice(0, 5),
        })),

      // ── Notification badges ─────────────────────────────────────────────────
      unreadNotifications: 0,
      setUnreadNotifications: (n) => set({ unreadNotifications: n }),
      clearNotifications: () => set({ unreadNotifications: 0 }),

      // ── Last active dashboard tab ───────────────────────────────────────────
      lastDashTab: 'overview',
      setLastDashTab: (tab) => set({ lastDashTab: tab }),

      // ── Quick actions on landing (tutorial seen) ────────────────────────────
      tutorialSeen: false,
      markTutorialSeen: () => set({ tutorialSeen: true }),

      // ── Reset ───────────────────────────────────────────────────────────────
      reset: () => set({
        recentSymptoms: [],
        unreadNotifications: 0,
        lastDashTab: 'overview',
        tutorialSeen: false,
      }),
    }),
    {
      name:    'swasthyaseva-app-state',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        // Only persist these keys — theme, recent symptoms, tutorial, last tab
        theme:            s.theme,
        recentSymptoms:   s.recentSymptoms,
        tutorialSeen:     s.tutorialSeen,
        lastDashTab:      s.lastDashTab,
      }),
    }
  )
)

export default useAppStore
