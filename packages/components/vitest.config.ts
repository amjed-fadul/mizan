/*
  Every story, run as a test.

  This exists because the a11y addon and eighteen play functions were configured
  correctly and executed by nobody. The addon runs axe on render, so it ran when
  a human opened Storybook; the play functions ran when a human clicked the
  story. `gates.yml` never executed either, and the documentation described
  accessibility as a guarantee for a whole stage on that basis.

  What the run asserts, per story:

    - it renders without throwing;
    - its play function completes and its assertions hold, if it has one;
    - axe finds no violation, because preview.tsx sets `a11y.test: 'error'`
      globally rather than story by story.

  There is deliberately no `setupFiles` and no `setProjectAnnotations` call.
  Since Storybook 10.3 the addon applies preview.tsx's annotations itself — the
  decorators, the four globals and the a11y parameter — and a setup file that
  applies them a second time is refused with a warning rather than merged. The
  first version of this config had one; the tool said so, and it was right.

  Chromium only, and headless. The point of this gate is to catch a missing
  label, a broken tab order or a contrast failure in the rendered tree — none of
  which are browser-specific. Cross-browser rendering is a different question
  that this repository has not claimed to answer, and adding two more engines
  would triple the runtime to re-check the same accessibility tree.
*/
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'

export default defineConfig({
  plugins: [storybookTest({ configDir: '.storybook' })],
  test: {
    name: 'stories',
    browser: {
      enabled: true,
      // A factory rather than the string 'playwright'. Vitest changed this and
      // reports the change clearly if you get it wrong, which is how this line
      // came to be written correctly.
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }]
    }
  }
})
