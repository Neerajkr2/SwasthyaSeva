// src/components/common/LoadingSpinner.jsx
export default function LoadingSpinner({ fullScreen = false, size = 40, label = 'Loading…' }) {
  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <svg
        width={size} height={size}
        viewBox="0 0 50 50"
        className="animate-spin-slow"
        style={{ animationDuration: '1s' }}
      >
        <circle cx="25" cy="25" r="20" fill="none" stroke="#e0f2fe" strokeWidth="4" />
        <path
          d="M 25 5 A 20 20 0 0 1 45 25"
          fill="none" stroke="#0ea5e9" strokeWidth="4" strokeLinecap="round"
        />
      </svg>
      <span className="text-sm text-slate-400 font-medium">{label}</span>
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
        {spinner}
      </div>
    )
  }
  return <div className="flex items-center justify-center p-8">{spinner}</div>
}
