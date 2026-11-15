import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' so the static build works on GitHub Pages under /horizon-line/
export default defineConfig({
  base: './',
  plugins: [react()],
})
