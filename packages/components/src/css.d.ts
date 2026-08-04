/**
 * A component brings its own stylesheet with it, so `Button.tsx` imports
 * `Button.css` as a side effect and every bundler that consumes this package
 * knows what to do with that. TypeScript does not, unless something says so.
 *
 * This is declared here rather than inherited from `vite/client` on purpose:
 * `vite/client` also hands the program `import.meta.env` and a set of asset
 * types, and the emitting build would then typecheck against globals that do
 * not exist in whatever application ends up importing this library. One line
 * that says exactly what is true is a smaller promise than a whole environment.
 */
declare module '*.css'
