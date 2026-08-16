import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { NotFoundPage } from '@/components/site/Pages'
import { initAnalytics } from '@/lib/analytics'

initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NotFoundPage />
  </StrictMode>,
)
