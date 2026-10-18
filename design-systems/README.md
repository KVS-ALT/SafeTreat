# SafeTreat design systems

Four interchangeable looks for SafeTreat, packaged in the [OpenDesign](https://github.com/nexu-io/open-design)
design-system format (`manifest.json` + `DESIGN.md` + `tokens.css`), so they can be dropped into
OpenDesign's `design-systems/` folder or handed to a coding agent as the brand contract.

| Package | Starts from (OpenDesign) | One line |
|---|---|---|
| `nightfall` (default) | `linear-app` | Precise, near-black, one pumpkin accent. |
| `porchlight` | `warm-editorial` | Warm paper, serif headlines, terracotta. |
| `candy` | `neobrutalism` | Cream, ink outlines, hard offset shadows. |
| `pixel` | `retro` + `dithered`, inspired by spideytracker.net | Handheld-device bezel, pixel type, CRT scanlines. |

## How the app uses them

- Each `tokens.css` defines the same semantic tokens under `[data-theme="<id>"]`
  (`nightfall` also under `:root`). `src/app/globals.css` imports all four.
- Components only read tokens (`--accent`, `--r-md`, `--sh-btn`, `--ff-display`, …), never raw
  colours, so any element with a `data-theme` attribute renders in that design. The `/designs` page uses
  this to show all four side by side.
- The active design is stored in the `safetreat_theme` cookie and set on `<html data-theme>`.
- Maps use one keyless OpenStreetMap tile source; each design restyles it with `--tile-filter`.

## Token contract

| Token | Meaning |
|---|---|
| `--bg`, `--bg-pattern` | page background colour and optional texture |
| `--surface`, `--surface-2` | cards; inputs, chips and hover fills |
| `--border`, `--border-strong`, `--border-w` | hairlines, emphasized lines, line width |
| `--text`, `--muted` | body copy, metadata |
| `--accent`, `--accent-text`, `--accent-ink` | primary action fill, accent used as text, text on accent fill |
| `--danger`, `--warn`, `--safe`, `--gold`, `--teal` | candy reports, incidents, all-clear, verified hosts, teal pumpkin |
| `--r-lg/md/sm`, `--clip` | corner shapes (`--clip` gives Pixel its stepped corners) |
| `--sh-card`, `--sh-btn`, `--sh-btn-hover`, `--lift`, `--press` | elevation and button physics |
| `--ff-display/body/label/mono`, `--display-*`, `--label-*` | type roles |
| `--frame-*` | the frame drawn around maps |
| `--tile-filter`, `--map-bg` | map tile treatment |
| `--icon-line`, `--icon-pixel` | which icon set shows (`inline-block` / `none`) |
| `--scanlines` | CRT overlay (`none` except Pixel) |
