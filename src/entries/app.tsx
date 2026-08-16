import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'

/* The Telegram client. No analytics and no third-party scripts ever run on
   this page — see lib/analytics.ts for why that boundary exists. */
const QrLogin = lazy(() => import('@/components/QrLogin'))
const DemoWorkspace = import.meta.env.DEV
  ? lazy(() => import('@/components/app/DemoWorkspace'))
  : null

const demo = import.meta.env.DEV && window.location.hash === '#demo'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      {demo && DemoWorkspace ? <DemoWorkspace /> : <QrLogin onBack={() => (window.location.href = '/')} />}
    </Suspense>
  </StrictMode>,
)
