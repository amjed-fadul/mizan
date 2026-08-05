import { fileURLToPath } from 'node:url'
import type { StorybookConfig } from '@storybook/react-vite'

// The repository root. The token stylesheet is read from packages/tokens/ where
// the build wrote it, not copied into this package: a component library holding
// its own copy of the token CSS is a second source of truth with a timestamp on
// it, and the whole point of Stage 4 is that the component resolves values it
// does not own.
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))

const config: StorybookConfig = {
  /*
    The .mdx glob is listed FIRST, and the order matters: Storybook builds the
    sidebar in the order files are discovered, and the Start Here page has to be
    the first thing a designer sees rather than something below Button. The
    storySort in preview.tsx pins it regardless, but a glob that already reads
    in the right order means the two mechanisms agree instead of one correcting
    the other.
  */
  stories: ['../src/**/*.mdx', '../src/**/*.stories.tsx'],
  addons: [
    '@storybook/addon-docs',
    // The a11y addon runs axe against every story on render. It is the
    // deterministic half of "accessibility is a guarantee, not a variant"
    // (CLAUDE.md rule 4): what a script can check, a script checks, and the
    // judgment left over is what the spec argues in prose.
    '@storybook/addon-a11y'
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {}
  },
  viteFinal: (viteConfig) => {
    viteConfig.server ??= {}
    viteConfig.server.fs = { allow: [repoRoot] }
    return viteConfig
  }
}

export default config
