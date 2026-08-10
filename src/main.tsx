import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { initPWA } from './lib/pwa'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

// Inicializa o PWA: registra o service worker e os listeners globais de
// instalação (captura o beforeinstallprompt para exibir botão customizado
// em vez do mini-infobar automático do Chrome).
initPWA()
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Falha silenciosa: o app continua funcionando sem SW.
    })
  })
}
