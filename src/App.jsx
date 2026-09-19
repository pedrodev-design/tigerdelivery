import { lazy, Suspense, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { LoadingOverlay } from './components/ui/LoadingOverlay'

const LoginPage = lazy(() => import('./pages/Login').then(module => ({ default: module.LoginPage })))
const CatalogPage = lazy(() => import('./pages/Catalog').then(module => ({ default: module.CatalogPage })))
const DriverPage = lazy(() => import('./pages/Driver').then(module => ({ default: module.DriverPage })))
const AdminPage = lazy(() => import('./pages/Admin').then(module => ({ default: module.AdminPage })))
const StorePage = lazy(() => import('./pages/Store').then(module => ({ default: module.StorePage })))

function App() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onNavigate = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onNavigate)
    return () => window.removeEventListener('hashchange', onNavigate)
  }, [])
  const isAuth = ['#entrar', '#criar-conta', '#recuperar-senha', '#verificar-email'].includes(hash)
  const isDriver = hash === '#motorista'
  const isAdmin = hash === '#admin'
  const isStore = hash === '#lojista'
  const routeKey = isAuth ? hash : isDriver ? 'driver' : isAdmin ? 'admin' : isStore ? 'store' : 'catalog'
  return (
    <div className="app">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div className="min-h-svh" key={routeKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <Suspense fallback={<LoadingOverlay label="Quase lá" detail="Abrindo o TigreDelivery..." />}>
            {isAuth ? <LoginPage /> : isDriver ? <DriverPage /> : isAdmin ? <AdminPage /> : isStore ? <StorePage /> : <CatalogPage />}
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default App
