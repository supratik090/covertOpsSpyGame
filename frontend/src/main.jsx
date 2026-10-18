import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Define global handleUserActivity polyfill to prevent WebView/Leaflet ReferenceError
if (typeof window !== 'undefined') {
  window.handleUserActivity = window.handleUserActivity || function () {};
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
