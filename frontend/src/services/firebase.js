// frontend/src/services/firebase.js
import { initializeApp }  from 'firebase/app'
import {
  getAuth, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult, signOut,
} from 'firebase/auth'
import { getStorage } from 'firebase/storage'

// In production we serve Firebase's auth handler from OUR OWN domain (via the
// Vercel proxy in vercel.json) so the OAuth handshake is SAME-ORIGIN. This is
// what makes sign-in survive — cross-domain (firebaseapp.com) auth results are
// blocked by Chrome's cross-site storage rules. On localhost we keep the
// default firebaseapp.com auth domain (it's an authorized domain for dev).
const _isLocalhost =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname)

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        _isLocalhost
                       ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
                       : window.location.host,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth    = getAuth(app)
export const storage = getStorage(app)

export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export const signInWithGoogle         = () => signInWithPopup(auth, googleProvider)
export const signInWithGoogleRedirect = () => signInWithRedirect(auth, googleProvider)
export const getGoogleRedirectResult  = () => getRedirectResult(auth)
export const signOutUser              = () => signOut(auth)

export default app
