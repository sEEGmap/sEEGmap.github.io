import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base path is set for GitHub Pages project root deployment (sEEGplan.github.io).
// If deploying under a sub-path repo instead, change base to '/<repo-name>/'.
export default defineConfig({
  plugins: [react()],
  base: './',
})
