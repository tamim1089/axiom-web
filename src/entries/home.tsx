import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { Landing } from '@/components/Landing'
import { initAnalytics } from '@/lib/analytics'

initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
)
