import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // user page served from the domain root
  base: '/',
  build: {
    // keep `build/` so the existing gh-pages deploy script works
    outDir: 'build',
    // Two pages: the site, and the water lab at /water. GitHub Pages can't
    // rewrite routes, so /water needs a real water/index.html in the build.
    rollupOptions: {
      input: {
        main: 'index.html',
        water: 'water/index.html',
      },
    },
  },
})
