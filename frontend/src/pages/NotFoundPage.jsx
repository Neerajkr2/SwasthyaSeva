// src/pages/NotFoundPage.jsx
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiHome, FiArrowLeft } from 'react-icons/fi'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-indigo-50 px-6">
      <motion.div
        initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}
        className="max-w-md w-full text-center">
        <div className="font-display text-[8rem] font-black text-slate-100 leading-none select-none mb-4">
          404
        </div>
        <div className="text-5xl mb-6">🏥</div>
        <h1 className="font-display text-3xl font-bold text-slate-800 mb-3">
          Page Not Found
        </h1>
        <p className="text-slate-500 mb-8 leading-relaxed">
          The page you're looking for doesn't exist or may have been moved.
          Let's get you back to your health journey.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate(-1)} className="btn-secondary gap-2">
            <FiArrowLeft size={16}/> Go Back
          </button>
          <button onClick={() => navigate('/')} className="btn-primary gap-2">
            <FiHome size={16}/> Home
          </button>
        </div>
      </motion.div>
    </div>
  )
}
