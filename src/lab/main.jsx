import React from 'react'
import ReactDOM from 'react-dom/client'
import StyleLab from './StyleLab.jsx'

// Entry for /water — its own page (water/index.html) rather than a route in
// the main app, because GitHub Pages has no server-side routing: a real
// water/index.html is what makes /water resolve in production.
ReactDOM.createRoot(document.getElementById('root')).render(<StyleLab />)
