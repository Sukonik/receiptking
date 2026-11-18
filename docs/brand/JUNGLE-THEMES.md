# ReceiptKing Jungle themes

Eight Emperor UI color themes, inspired by WYWO's named-theme format and implemented with light, dark, and system-auto modes. Jungle icon choice is independent of color theme, and both choices persist in the browser.

| Theme | Slug | Light primary | Accent | Light background | Dark background | Mood |
| --- | --- | --- | --- | --- | --- | --- |
| Emperor Tamarin | `emperor-tamarin` | `#163F36` | `#D7F06B` | `#F6F7F2` | `#0D1F1A` | Default; forest green and vivid lime |
| Squirrel Monkey | `squirrel-monkey` | `#A95227` | `#F1B566` | `#FFF8F0` | `#21160F` | Copper, orange, and canopy gold |
| Capuchin Monkey | `capuchin-monkey` | `#69503A` | `#D8AD79` | `#FAF5EC` | `#1E1A16` | Coffee, bark, and warm cream |
| Three-Toed Sloth | `three-toed-sloth` | `#506D58` | `#A9C39B` | `#F4F8F1` | `#18251D` | Moss, fern, and soft sage |
| Toco Toucan | `toco-toucan` | `#234F5C` | `#EAAE20` | `#F2F8F8` | `#101F25` | Deep teal with a beak-gold highlight |
| Green Anaconda | `green-anaconda` | `#176F61` | `#A4CC74` | `#F1F8F3` | `#0C2521` | River emerald and scale green |
| Jaguar | `jaguar` | `#86501E` | `#DDA94F` | `#FCF7EF` | `#211B12` | Amber, spotted-coat gold, and dark bark |
| Capybara | `capybara` | `#795B48` | `#C7A27C` | `#FAF5EE` | `#241D18` | Riverbank brown and warm sand |

## Token definitions

For each theme: `primary` is used for action buttons and active navigation; `accent` is for progress and small highlights. Keep receipts, totals, warnings, and exported documents semantically consistent across themes. A theme must never change numeric values or status meaning.

```css
/* Live Emperor UI interface contract. */
<html data-theme="emperor-tamarin" data-mode="light|dark">
```

Use `data-mode="light"` or `"dark"`; if omitted, follow the OS preference. Persist theme and icon selections separately. Default theme: Emperor Tamarin. Default icon: HackBerry. Every mode needs readable text on its own surfaces and primary buttons.

## Complete palette

| Theme | Light primary | Accent | Light background | Light surface | Light text | Dark background | Dark surface | Dark text |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Emperor Tamarin | `#163F36` | `#D7F06B` | `#F6F7F2` | `#FFFFFF` | `#18332B` | `#0D1F1A` | `#172F28` | `#EAF5ED` |
| Squirrel Monkey | `#A95227` | `#F1B566` | `#FFF8F0` | `#FFFFFF` | `#392414` | `#21160F` | `#332216` | `#F8E5C6` |
| Capuchin Monkey | `#69503A` | `#D8AD79` | `#FAF5EC` | `#FFFFFF` | `#30281F` | `#1E1A16` | `#302820` | `#F3E4CE` |
| Three-Toed Sloth | `#506D58` | `#A9C39B` | `#F4F8F1` | `#FFFFFF` | `#26372B` | `#18251D` | `#25362B` | `#E8F3E2` |
| Toco Toucan | `#234F5C` | `#EAAE20` | `#F2F8F8` | `#FFFFFF` | `#18363E` | `#101F25` | `#1C3138` | `#F9E8A5` |
| Green Anaconda | `#176F61` | `#A4CC74` | `#F1F8F3` | `#FFFFFF` | `#143C34` | `#0C2521` | `#163A32` | `#E2F2D6` |
| Jaguar | `#86501E` | `#DDA94F` | `#FCF7EF` | `#FFFFFF` | `#392711` | `#211B12` | `#342719` | `#F8E9CA` |
| Capybara | `#795B48` | `#C7A27C` | `#FAF5EE` | `#FFFFFF` | `#35291F` | `#241D18` | `#352A22` | `#F2E5D6` |

## Implementation notes

1. Map these palettes to semantic CSS variables, such as `--rk-primary`, `--rk-accent`, `--rk-bg`, `--rk-surface`, and `--rk-text`.
2. Each theme has light and dark tokens; Auto follows the operating-system preference.
3. The Appearance menu contains eight animal swatches and six plant previews, with HackBerry marked as default.
4. Do not recolor the original receipt or exported PDF, CSV, and Excel data based on the UI theme.
5. Retain the full-body Clerk mark in each icon. At 16 px the receipt details simplify visually; use 32 px or larger when possible.

References: https://github.com/Sukonik/wywo and https://sukonik.github.io/GoldenSunLaw/
