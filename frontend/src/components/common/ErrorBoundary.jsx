// src/components/common/ErrorBoundary.jsx
import { Component } from 'react'
import { FiAlertTriangle, FiRefreshCw, FiHome } from 'react-icons/fi'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
    this.setState({ info })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 bg-red-50">
            <FiAlertTriangle size={40} className="text-red-400"/>
          </div>
          <h1 className="font-display text-3xl font-bold text-slate-800 mb-3">
            Something went wrong
          </h1>
          <p className="text-slate-500 mb-2 leading-relaxed">
            An unexpected error occurred. Our team has been notified.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <details className="text-left bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-xs text-red-700 font-mono">
              <summary className="cursor-pointer font-semibold mb-2">Error details (dev mode)</summary>
              <pre className="whitespace-pre-wrap overflow-auto">
                {this.state.error.toString()}
                {this.state.info?.componentStack}
              </pre>
            </details>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => this.setState({ hasError:false, error:null, info:null })}
              className="btn-secondary gap-2">
              <FiRefreshCw size={15}/> Try Again
            </button>
            <button
              onClick={() => { window.location.href = '/' }}
              className="btn-primary gap-2">
              <FiHome size={15}/> Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }
}
