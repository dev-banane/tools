import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [
    cloudflare(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  server: {
    watch: {
      // Miniflare writes SQLite state (cache + observability trace store) on
      // every worker request. Without this the watcher sees those writes and
      // issues a full reload, which remounts the app, refires the request, and
      // loops forever - so no /api call ever finishes.
      ignored: ['**/.wrangler/**'],
    },
  },
})
