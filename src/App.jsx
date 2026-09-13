import { lazy, Suspense, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

const LoginPage = lazy(() => import('./pages/Login').then(module => ({ default: module.LoginPage })))
const CatalogPage = lazy(() => import('./pages/Catalog').then(module => ({ default: module.CatalogPage })))

function App() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onNavigate = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onNavigate)
    return () => window.removeEventListener('hashchange', onNavigate)
  }, [])
  const isAuth = ['#entrar', '#criar-conta', '#recuperar-senha', '#verificar-email'].includes(hash)
  return (
    <div className="app">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div className="min-h-svh" key={isAuth ? hash : 'catalog'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <Suspense fallback={<div className="min-h-svh bg-[#fffaf3]" />}>
            {isAuth ? <LoginPage /> : <CatalogPage />}
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default App
