# Platform Visual Identity

The established light gradient identity is intentional and preferred by the
platform owner. Navigation improvements must preserve it, not replace it with
a solid dark sidebar or a generic white theme.

- Use Raiz orange and light warm gradients with dark green text in the default
  context. Soft green accents balance the palette.
- Selected school brands supply their existing color, light and text tokens.
  The sidebar, page headings and dashboard highlights follow those tokens.
- Keep gradients broad and light. Financial tables and documents need neutral,
  readable surfaces. Preserve semantic colors for financial indicators.
- Use the full available workspace width. Avoid arbitrary page width caps,
  boxed page headings, nested summary cards and excessive divider lines.
  Group information with alignment, typography and purposeful spacing instead.
- Preserve boundaries for real inputs, dialogs and individual repeated records.
  A filtered single property expands into a horizontal summary on wide screens.
- Keep the grouped menu, including Real Estate, accessible icons, counters,
  collapsed navigation, mobile drawer and permission-specific visibility.
- Visual changes must not change data, permissions or financial calculations.
- Run `scripts/test_platform_menu.cjs` and inspect its desktop, school-brand,
  collapsed and mobile screenshots before publishing navigation changes.

Shared visual overrides live in `scripts/platform-menu.css` and
`scripts/platform-identity.css`; core brand tokens remain in `index.html`.
