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
- The continuous workspace and individual CAPEX, property and work cards
  carry light, visible gradients using their existing school brand tokens.
  Do not flatten these records to white, including on hover. Keep metric bands
  and payment rows unframed and readable, without nested tinted rectangles.
- The gradient must remain visible across the workspace, not fade into an
  almost-white theme. Preserve the warm Raiz-to-soft-green transition.
- Individual work, CAPEX and property records need a light branded surface
  and subtle separation. Removing every record surface destroys hierarchy.
  Documentos das Escolas is the visual reference for repeated records:
  `_brandSoftGradient` uses 135 degrees, the surface at 0% and brand light at
  132%. Match its 1px neutral border, existing 10px radius, 5px brand rail,
  compact spacing and gentle hover shadow. Do not redesign the reference
  cards or invent separate gradients per feature. Avoid nested cards and
  strong colored borders; the single brand rail is intentional.
- Use regular-weight supporting text and distinct headings. Never force all
  page text to bold. Avoid repeating the work title as its unit or subtitle.
- Keep work and invoice searches together in a compact toolbar. Validate
  populated multi-brand lists, not only empty or single-record screenshots.
- Keep the sidebar gradient restrained. Active navigation needs a text/icon
  emphasis and a small accent, not a colored capsule or a surrounding outline.
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
Repeated-record surfaces are unified in `scripts/record-cards.css`, loaded
after the legacy area styles. Feature-specific fields and actions remain
intact. Financial tables and full-page sections are not converted to cards.

Operational Suppliers and Investors use the same repeated-record cards as
School Documents. Comparative tables stay in Dashboards. Preserve filtering,
detail navigation and permission-aware editing in both presentations.

Screen typography uses Geist with a 16px body and form controls, a 14px minimum
for supporting text, and 18px record titles. Shared readability overrides live
in `scripts/typography.css`. Print-specific report typography is independent.
Validate long labels, monetary values, mobile wrapping and dialogs when changing
font sizes; do not reduce text to hide overflow.
