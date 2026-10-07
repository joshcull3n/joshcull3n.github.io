import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // user page served from the domain root
  base: '/',
  build: {
    // keep `build/` so the existing gh-pages deploy script works
    outDir: 'build',
  },
})
