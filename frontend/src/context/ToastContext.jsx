// src/context/ToastContext.jsx
import { createContext, useContext } from 'react'
import { Toaster, toast } from 'react-hot-toast'

const ToastContext = createContext(null)
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }) {
  const show = {
    success: (msg) => toast.success(msg, { duration: 3500 }),
    error:   (msg) => toast.error(msg,   { duration: 4000 }),
    info:    (msg) => toast(msg,          { duration: 3000, icon: '💙' }),
    loading: (msg) => toast.loading(msg),
    dismiss: (id)  => toast.dismiss(id),
  }

  return (
    <ToastContext.Provider value={show}>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: '0.875rem',
            borderRadius: '14px',
            padding: '12px 18px',
          },
        }}
      />
    </ToastContext.Provider>
  )
}
