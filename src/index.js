import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
import App from './App'
import { ContextProvider } from './Context'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ContextProvider>
      <App />
    </ContextProvider>
  </React.StrictMode>
);