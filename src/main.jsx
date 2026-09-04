import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { installGlassRefraction } from './lib/glassRefraction.js'
import './index.css'

// Progressive enhancement: real refraction through the glass buttons where the
// browser supports SVG filters in backdrop-filter. A no-op everywhere else.
installGlassRefraction()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
