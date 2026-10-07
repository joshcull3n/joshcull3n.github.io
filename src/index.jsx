import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
import App from './App'
import StyleLab from './lab/StyleLab.jsx'

// Minimal hash routing — the lab lives at #lab so the existing site is
// untouched while we tune the water. Swap this out when the real UI lands.
const Root = () => {
  const [hash, setHash] = useState(window.location.hash)

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  return hash === '#lab' ? <StyleLab /> : <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />)
