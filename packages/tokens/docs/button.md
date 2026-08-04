# Button — one set of semantics, three implementations

What this proves: the *decisions* are shared and the *code* is not. A Button on web, iOS and Android reads the same semantic tokens from `content/tokens/semantic/`. What each platform does with them is different, because a `UIButton`, an `<button>` and a `MaterialButton` are different objects with different state models. Nothing below is a shared abstraction over the three. The shared thing is the token names.

## The decisions, once

| Slot | Token | Why it is a token and not a value |
|---|---|---|
| Filled background | `action.primary` | Green in Market, blue in Move. The component never learns which — the product mode does. |
| Filled background, pressed | `action.primary-hover` | The size of a state change is a system decision (decision 008), not a per-component nudge. |
| Label on a filled background | `text.on-action` | Paired with `action.primary` in `pairs.json` at the 4.5 text threshold, in all four mode combinations. |
| Outline of an unfilled button | `border.control` | Gated at the 1.4.11 non-text threshold. `border.default` is a divider and would fail this job. |
| Label on an unfilled button | `text.primary` | Same tier as body text, because that is what it is. |
| Inline padding | `space.200` comfortable / `space.150` compact | Density is which step a component selects, never a second scale. |
| Block padding | `space.150` comfortable / `space.100` compact | Same rule. |
| Gap between icon and label | `space.100` | |
| Corner | `radius.100` | The small radius, for things the hand touches directly. |
| Label size / weight | `font-size.300`, `font-weight.medium` | Weight carries emphasis; decision 009 removed the third grey that used to. |
| Tracking | `letter-spacing.none` | Non-negotiable — see `content/rules/rtl-arabic.md`. |

Two gaps, stated rather than invented: there is **no disabled token pair yet**, and **no focus-ring token**. Both need a declared entry in `pairs.json` before a component may use them. Until then a Button implementation that needs either is blocked on the token layer, which is the correct place for it to be blocked.

## Web

Semantics arrive as custom properties. Nothing is imported per-mode: the whole matrix is in one stylesheet and the product and theme are attributes on the root element, so a Button written once is correct in all four combinations.

```css
.button {
  padding-inline: var(--space-200);         /* logical, always — never padding-left */
  padding-block: var(--space-150);
  gap: var(--space-100);
  border-radius: var(--radius-100);
  font: var(--font-weight-medium) var(--font-size-300) / var(--line-height-tight) var(--font-family-sans);
  letter-spacing: var(--letter-spacing-none);
}

.button--primary {
  background: var(--action-primary);
  color: var(--text-on-action);
  border: none;
}
.button--primary:hover,
.button--primary:active { background: var(--action-primary-hover); }

.button--secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-control);
}

[data-density="compact"] .button {                /* when a density dimension exists */
  padding-inline: var(--space-150);
  padding-block: var(--space-100);
}
```

Platform-specific, and only here: `padding-inline` / `padding-block` rather than four physical sides, `:hover` as a real state, and mode switching by attribute. `.button` never reads `dir` and never branches on it.

## iOS

Same names, different object. There is no hover, so `action.primary-hover` is the *highlighted* state; padding is `contentEdgeInsets` with a leading/trailing pair rather than a shorthand; and the system, not the component, owns the touch target minimum.

```swift
// Tokens = DesignTokensLightMarket, DesignTokensDarkMove, … selected at launch.
var config = UIButton.Configuration.filled()
config.baseBackgroundColor = Tokens.actionPrimary
config.baseForegroundColor = Tokens.textOnAction
config.background.cornerRadius = Tokens.radius100
config.contentInsets = NSDirectionalEdgeInsets(   // directional, not left/right
    top: Tokens.space150, leading: Tokens.space200,
    bottom: Tokens.space150, trailing: Tokens.space200)
config.imagePadding = Tokens.space100

button.configurationUpdateHandler = { button in
    button.configuration?.baseBackgroundColor =
        button.isHighlighted ? Tokens.actionPrimaryHover : Tokens.actionPrimary
}
```

`NSDirectionalEdgeInsets` is the same decision `padding-inline` is: the geometry is described in reading order, so RTL is a layout property rather than a branch in the component.

## Android

Same names again, in the resource system. Colour and state live in XML, and the pressed state is a `ColorStateList` rather than a pseudo-class or a closure.

```xml
<!-- res/color/button_primary_background.xml -->
<selector xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:state_pressed="true" android:color="@color/action_primary_hover" />
  <item android:color="@color/action_primary" />
</selector>
```

```xml
<com.google.android.material.button.MaterialButton
    android:textColor="@color/text_on_action"
    app:backgroundTint="@color/button_primary_background"
    app:cornerRadius="@dimen/radius_100"
    android:paddingStart="@dimen/space_200"
    android:paddingEnd="@dimen/space_200"
    android:paddingTop="@dimen/space_150"
    android:paddingBottom="@dimen/space_150"
    app:iconPadding="@dimen/space_100" />
```

`paddingStart` / `paddingEnd`, never `paddingLeft` / `paddingRight` — the same rule in the third dialect.

One honest caveat: `font-size.300` is generated as `14dp`, and a label size should be `sp` so it respects the user's text-size setting. The build cannot tell a type dimension from a spacing dimension by shape alone, and teaching it to guess by token name would put Mizan's naming into brand-agnostic machinery. The fix is a `$extensions` hint on the token, not a special case in the build — see [`../README.md`](../README.md).

## What differs, and what does not

| | Web | iOS | Android |
|---|---|---|---|
| Pressed state | `:hover` / `:active` | `configurationUpdateHandler` | `ColorStateList` selector |
| Reading-order padding | `padding-inline` | `NSDirectionalEdgeInsets` | `paddingStart` / `paddingEnd` |
| Mode switching | root attribute, all modes in one file | one generated `enum` per combination | one resource directory per combination |
| Token names | identical | identical | identical |

The last row is the whole point. Three teams can disagree about every other row and still be building the same button, because `action.primary` means one thing and it is written down in one place.
