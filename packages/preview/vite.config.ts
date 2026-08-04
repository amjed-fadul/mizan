import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The repository root. Two files outside this package are read directly rather
// than copied, because copying either one would create a second source of truth:
//
//   packages/tokens/css/tokens.css   — imported twice: once as a stylesheet, and
//                                      once as text, so the gallery describes the
//                                      same file that is styling the page.
//   content/tokens/pairs.json        — the declared contrast pairings, read from
//                                      the only editing surface (CLAUDE.md rule 1).
const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    fs: { allow: [repoRoot] }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
