import { useEffect } from 'react'
import type { Decorator, Preview } from '@storybook/react-vite'

// The generated token stylesheet, imported from the build output rather than
// restated. Every value every story renders comes from here.
import '@mizan/tokens/tokens.css'

/**
 * The four dimensions a Mizan surface can be in, as toolbar controls.
 *
 * Three of them are attributes on the root element and nothing else — the token
 * CSS keys off `data-theme` and `data-product`, and `dir` is a platform
 * attribute — so switching a mode is an attribute write. No reload, no second
 * stylesheet, no per-direction build. That is the claim Stage 2 made and this
 * toolbar is where a reviewer gets to disbelieve it.
 *
 * Direction and language are separate controls on purpose. Latin text in an RTL
 * container looks fine and proves nothing, so the mismatch has to stay reachable
 * deliberately rather than being ruled out by the toolbar.
 */
const globalTypes = {
  theme: {
    description: 'Theme mode — data-theme on the root element',
    toolbar: {
      title: 'Theme',
      icon: 'circlehollow',
      items: [
        { value: 'light', title: 'Light' },
        { value: 'dark', title: 'Dark' }
      ],
      dynamicTitle: true
    }
  },
  product: {
    description: 'Product mode — data-product on the root element',
    toolbar: {
      title: 'Product',
      icon: 'component',
      items: [
        { value: 'market', title: 'Market' },
        { value: 'move', title: 'Move' }
      ],
      dynamicTitle: true
    }
  },
  direction: {
    description: 'Layout direction — dir on the root element',
    toolbar: {
      title: 'Direction',
      icon: 'transfer',
      items: [
        { value: 'ltr', title: 'LTR' },
        { value: 'rtl', title: 'RTL' }
      ],
      dynamicTitle: true
    }
  },
  lang: {
    description: 'Document language — selects the script subtree via :lang()',
    toolbar: {
      title: 'Language',
      icon: 'globe',
      items: [
        { value: 'en', title: 'English' },
        { value: 'ar', title: 'العربية' }
      ],
      dynamicTitle: true
    }
  }
}

const initialGlobals = {
  theme: 'light',
  product: 'market',
  direction: 'ltr',
  lang: 'en'
}

const withModes: Decorator = (Story, context) => {
  const { theme, product, direction, lang } = context.globals

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = String(theme)
    root.dataset.product = String(product)
    root.dir = String(direction)
    // The document language. The Arabic *type* treatment is not attached here:
    // decision 013 scopes script to a subtree selected by :lang(), so the
    // component opts in and the root only states what language is on the page.
    root.lang = String(lang)

    // The story canvas is its own document, and a story that renders on
    // surface.default while the canvas stays white is a story that cannot show
    // the dark theme at all.
    document.body.style.backgroundColor = 'var(--surface-default)'
    document.body.style.color = 'var(--text-primary)'
  }, [theme, product, direction, lang])

  return <Story />
}

const preview: Preview = {
  globalTypes,
  initialGlobals,
  decorators: [withModes],
  parameters: {
    /*
      Start Here first, then the components alphabetically.

      It is pinned rather than left to file order because the sidebar is the
      only navigation a designer has, and the page that explains how to find
      things is worthless if it is found by scrolling past the things.
    */
    options: {
      storySort: {
        order: ['Start here', 'Components']
      }
    },

    controls: { expanded: true },
    a11y: {
      // Report rather than warn silently. A violation that only appears in a
      // panel nobody opens is a violation nobody fixes.
      test: 'error'
    },
    docs: {
      // The stories are the documentation. Autodocs turns the JSDoc on the
      // component and on every prop into the page an agent or a designer reads,
      // which is why those comments are written as documentation rather than as
      // notes to the next maintainer.
      toc: true,

      story: {
        /*
          Every story on a docs page renders in its OWN iframe, and this is a
          correctness fix rather than a preference. Two things broke without it,
          and both come from the same cause: a docs page renders every story at
          once, into one shared document.

          1. THE MODE ATTRIBUTES LEAKED. `withModes` above writes data-theme,
             data-product, dir and lang onto document.documentElement, because
             the generated token CSS selects on `:root[data-theme][data-product]`
             — the modes have to be on the root or no token resolves. On a story
             page there is one story and that is correct. On a docs page every
             story's effect ran against the same root and the LAST one won, and
             the last export in every stories file is the Arabic one. So every
             docs page in this library rendered right-to-left, with the prose
             right-aligned and its punctuation at the wrong end.

          2. THE DIALOG DOCS PAGE WAS UNREADABLE. showModal() puts a dialog in
             the browser's top layer, which is above the page and is per
             DOCUMENT. Seven stories meant seven stacked modals over the
             documentation, their scrims compounding to near-black. The page was
             not degraded, it was invisible.

          An iframe per story gives each one its own document, so it gets its
          own root to write modes onto and its own top layer to open into. It
          costs a frame per story, which is the honest price of components that
          legitimately touch document-level state.
        */
        inline: false,
        height: '320px'
      }
    }
  },
  tags: ['autodocs']
}

export default preview
