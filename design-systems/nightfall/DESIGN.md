# SafeTreat Nightfall

> Category: Productivity & SaaS
> Precise, calm, night-native. Content emerges from a near-black canvas; one pumpkin accent marks the action.

## 1. Visual Theme & Atmosphere
Halloween happens at night, so the default UI is dark-native, not a dark coat of paint on a light design.
Hierarchy comes from luminance steps (bg → surface → surface-2) and hairline borders at 7–14% white,
not from colour. Adapted from OpenDesign's `linear-app` system, with Linear's indigo swapped for pumpkin.

## 2. Color
- **Background** `#09090c`, with one soft pumpkin glow top-right (the only gradient on the page).
- **Surface** `#111116` cards · **Surface 2** `#18181f` inputs, chips, hover.
- **Text** `#f4f4f6` · **Muted** `#9a9aa6`.
- **Accent** `#f2762e` (pumpkin): primary buttons, active nav, the route line. Max two uses per screen.
- **Status**: danger `#f0525f` (unsafe candy), warn `#f5a524` (incidents), safe `#3fcf8e`, gold `#e8c15a` (verified host), teal `#3cc7c1` (teal-pumpkin house).
- Borders: `rgba(255,255,255,.07)` default, `.14` emphasized. Never pure black or pure white.

## 3. Typography
- **Geist** for display and body, **Geist Mono** for numbers, times and distances (tabular).
- Display: weight 600, tracking −0.035em, line-height 1.02. Body 15–16px / 1.55.
- Labels: 11px, weight 600, tracking +0.06em, uppercase.

## 4. Spacing & Grid
4px base; card padding 20px; page max-width 1280px; 16px gutters on phones.

## 5. Components
- Buttons: primary = accent fill, dark ink label; ghost = surface-2 with hairline border. Hover lifts 1px, press scales to .98.
- Cards: surface, 1px hairline, radius 14px, inset top highlight + long soft shadow.
- Chips: pill, surface-2; selected = accent outline + 12% accent fill.
- Map: OpenStreetMap tiles inverted to a dark, desaturated basemap inside a 1px frame; danger zones are dashed tinted circles.

## 6. Motion & Interaction
150–220ms ease-out on colour, transform and shadow. Visible 2px accent focus ring offset by 2px.

## 7. Anti-patterns
No purple/indigo, no two-stop gradients, no emoji as UI icons (monoline SVG, 1.75px stroke), no coloured left-border cards.
