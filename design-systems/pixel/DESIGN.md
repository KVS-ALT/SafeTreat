# SafeTreat Pixel Patrol

> Category: Retro & Nostalgic
> A handheld monster tracker from 1994: navy CRT screen, chunky light-blue bezel, pixel type and blinking sprites.

## 1. Visual Theme & Atmosphere
Inspired by the Spidey Tracker microsite (spideytracker.net): the whole app reads as a device. Maps sit inside a
thick stepped-corner bezel; the screen is deep navy with pale cyan text; buttons are chunky keys that press down;
a marquee ticker scrolls the latest reports. Built on OpenDesign's `retro` and `dithered` systems (limited palette,
dot-dither texture). Playful, but the information is still plain and readable.

## 2. Color
- **Background** `#13265c` royal blue with a 4px dither dot · **Screen / surface** `#0e1c3b` · **Surface 2** `#16295a`.
- **Bezel** `#4f86c6` with `#8ec5ef` rim and `#0b1630` outline.
- **Text** `#dff6ff` pale cyan · **Muted** `#8fb8d8`.
- **Accent** `#ffb347` key-orange (fill), `#ffd23f` yellow (as text, headings, guide labels).
- **Status**: danger `#ff5a5f` (red pin), safe `#5ee08a` (green pin), warn `#ffb347`, gold `#ffd23f`, teal `#4fe0d0`.

## 3. Typography
- **Silkscreen** for display and labels, uppercase, scaled to 0.78 so it stays inside cards.
- **Pixelify Sans** for body (readable at 15–16px). **Bitcount Prop Single** for numbers and the logo.

## 4. Components
- Square corners with 4px stepped notches (`--clip`), 3px borders, no blur anywhere.
- Buttons are keys: 4px darker bottom edge; press moves down 4px and drops the edge.
- Icons switch to a 12×12 pixel-art set; the logo becomes a pixel pumpkin sprite.
- Map tiles are inverted, tinted navy and rendered `pixelated`; pins are square sprites.
- Page chrome: CRT scanlines over everything, a marquee ticker on the home screen.

## 5. Anti-patterns
No soft shadows, gradients or rounded corners. Don't set long paragraphs in Silkscreen. Keep text ≥ 4.5:1 on navy.
