
import { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import HowItWorks from './components/HowItWorks'
import AnalyzerForm from './components/AnalyzerForm'
import Footer from './components/Footer'
import AuthPage from './components/AuthPage'
import HistoryPage from './components/HistoryPage'
import { AuthProvider } from './context/AuthProvider'
import { useAuth } from './context/useAuth'

function AppContent() {
  const [path, setPath] = useState(window.location.pathname)
  const [locationKey, setLocationKey] = useState(() => `${window.location.pathname}${window.location.hash}`)
  const [locationVersion, setLocationVersion] = useState(0)
  const { user, loading } = useAuth()

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname)
      setLocationKey(`${window.location.pathname}${window.location.hash}`)
      setLocationVersion((version) => version + 1)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const hash = new URL(locationKey, window.location.origin).hash
    if (!hash) return undefined

    const timeoutId = window.setTimeout(() => {
      try {
        document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ behavior: 'smooth' })
      } catch {
        // Ignore malformed percent escapes in manually entered URL fragments.
      }
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [locationKey, locationVersion, path])

  const navigate = (nextLocation) => {
    const nextUrl = new URL(nextLocation, window.location.origin)
    const nextPath = nextUrl.pathname
    const nextLocationKey = `${nextPath}${nextUrl.hash}`
    if (`${window.location.pathname}${window.location.hash}` !== nextLocationKey) {
      window.history.pushState({}, '', nextLocationKey)
    }
    setPath(nextPath)
    setLocationKey(nextLocationKey)
    setLocationVersion((version) => version + 1)
    if (!nextUrl.hash) window.scrollTo(0, 0)
  }

  let page
  if (path === '/login' || path === '/register') {
    page = user ? <HistoryPage /> : loading ? <main className="p-12 text-center text-slate-600">Checking your session…</main> : <AuthPage mode={path.slice(1)} navigate={navigate} />
  } else if (path === '/history') {
    page = loading ? <main className="p-12 text-center text-slate-600">Checking your session…</main> : user ? <HistoryPage /> : <AuthPage mode="login" navigate={navigate} />
  } else if (path !== '/') {
    page = <main className="min-h-[70vh] px-6 py-20 text-center"><h1 className="text-3xl font-bold text-[#2E164B]">Page not found</h1><button onClick={() => navigate('/')} className="mt-5 rounded-xl bg-[#2E164B] px-5 py-3 font-semibold text-white">Return to OfferScan</button></main>
  } else {
    page = <><Hero /><HowItWorks /><AnalyzerForm /></>
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Navbar navigate={navigate} />
      {page}
      <Footer />
    </div>
  )
}

function App() {
  return <AuthProvider><AppContent /></AuthProvider>
}

export default App
