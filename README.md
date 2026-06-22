# Odrive Wheel Pit House

A desktop configuration tool — styled after **FFBeast Pit House** — for the
[Odrive-Wheel](https://github.com/aksc857-stack/Odrive-Wheel) firmware
(MKS XDrive Mini / ODESC V4.2 direct-drive sim racing wheels).

Built with **React 18 + TypeScript + Vite + Electron**, talking to the board
over **Node SerialPort**.

> ⚠️ **Work in progress.** This is an early, actively-developed project. Some
> tabs are functional, others are still being wired up to the firmware (see
> [Status](#status) below). Expect rough edges, breaking changes, and incomplete
> features. Use at your own risk — and **do not** rely on it for anything safety
> critical. Feedback and issues are very welcome.

> 💡 **First-time setup & firmware configuration.** For the **initial setup and
> firmware configuration** of the wheel (motor / encoder calibration and the
> first-time flow), it's recommended to use the original firmware's web
> configurator instead: **<https://eagabriel.github.io/Odrive-Wheel/>**. Pit House
> is meant for day-to-day tuning once the board is already configured.

---

## What it does

**Odrive Wheel Pit House** turns an Odrive-Wheel direct-drive base into a fully
graphical experience — no command line, no editing raw register values by hand.
Plug the board in over USB and you can:

- **Watch the wheel live** — a dashboard showing the wheel rotating in real time,
  current angle, output torque and FFB intensity.
- **Tune force feedback** — rotation range, max torque, master gain, per-effect
  game gains, always-on effects and end-stop, plus per-effect biquad filters,
  all applied **live as you drag** the sliders (no "Apply" step).
- **Invert axis and FFB independently** — flip wheel direction and force-feedback
  direction separately, straight from the dashboard.
- **Browse the full ODrive config** — motor, encoder, controller, power and
  protection fields, read directly from the board.
- **Save per-game profiles** — capture your FFB + filter settings into a named
  profile, import the game's icon from its `.exe`, apply a profile in one click,
  and **auto-switch** profiles when a game launches.
- **Diagnose & maintain** — decoded error registers with one-click state-machine
  / NVM actions, a dual-protocol serial console, and in-app **DFU firmware flashing**.

On connect, the app auto-reads the real settings from the board, so the UI always
reflects what's actually flashed — not hard-coded defaults. (Under the hood it
speaks both **ODrive ASCII** and **OpenFFBoard cmdparser** over the same serial
link — see [How device communication works](#how-device-communication-works).)

## Screenshots

### Dashboard

![Dashboard — live wheel visual, profiles card, FFB intensity & output torque](docs/screenshots/dashboard.png)

### Force feedback

![FFB tab — live-applied wheel, effect gains and always-on effects](docs/screenshots/ffb.png)

### Filters

![Filters tab — per-effect biquad low-pass (frequency + Q), live-applied](docs/screenshots/filters.png)

### Tools — Status, Console & DFU

![Decoded error registers, dual-protocol serial console and DFU flashing](docs/screenshots/tools.png)

## Status

| Area | State |
|------|-------|
| Auto-connect by USB **VID:PID** (`1209:0D40`), independent of COM number | ✅ working |
| **Dashboard** — wheel visual with live HID-direction rotation, angle presets, **max torque** slider (capped at the motor's physical limit), **invert axis/FFB**, **profiles card** (click a profile to apply, create, update the active profile) | ✅ working |
| **ODrive** tab — PSU/RBrake, Axis 0, Motor, Encoder, Controller (full schema, read-only calibration fields flagged) | ✅ values read correctly |
| **FFB** tab — wheel (range, max torque, master gain, fx ratio), **per-effect game gains** (`fx.*`), **always-on added effects** (`axis.*`), end-stop. Correct paths & scales, **applied live as you drag**. Max torque is **capped at the physical limit** (`current_lim × torque_constant`, capped by `torque_lim`) with auto-clamp on limit drop | ✅ working |
| **Filters** tab — per-effect biquad low-pass (`fx.filter*` freq + Q), tooltips, live-applied | ✅ working |
| **Status** tab — decoded error registers (odrv/axis/motor/encoder/controller) + state-machine & NVM actions | ✅ working |
| **Profiles** — capture the FFB + Filters config into a named profile, apply it back, rename, delete, **import the game icon from its `.exe`** | ✅ working |
| **Auto-switch** — applies the profile whose `.exe` matches a running game (process detection via `tasklist`), toggle in Settings | ✅ working |
| **Console** — ODrive/OpenFFBoard ASCII, logs writes + on-demand reads, *Available commands* picker, Clear | ✅ working |
| **DFU flash** — WebUSB DfuSe (reboot DFU → detect bootloader → pick .bin → flash), preserves FFB EEPROM (S1/S2) | ✅ working (tested on hardware) |
| Serial transport — single-flight FIFO queue + resync guard (mirrors the reference tool, avoids CDC desync) | ✅ working |
| **Sidebar** — drag-to-reorder and hide/show tabs, persisted (Settings → *Menu latéral*) | ✅ working |
| **Languages** — FR / EN / PT-BR switcher in Settings, persisted | 🚧 UI translated (Dashboard, FFB, Filters, Settings, Profiles, Status, Console, DFU, command list, decoded errors) |
| **Overlay** (in-game telemetry window) | 🚧 experimental |
| Saving — live edits write to RAM instantly; **Save** persists FFB EEPROM (`sys.save!`) + ODrive NVM (`ss`) | ✅ working |
| **Config import/export** (Settings → *Config* tab) — export the full board config to a JSON file and import it back, in the **reference web-interface format**; **Save** (`sys.save!` + `ss`, reboot) to persist an import | ✅ working |
| **Inputs (GPIO)** — configure the MKS XDrive Mini GPIOs (1–4 & 6) as HID joystick inputs (buttons / axes) with live preview | 🔜 planned — coming soon |

Anything marked 🚧 may show placeholder or inconsistent values for now; 🔜 means planned / coming soon (not yet implemented).

## Tech stack

```
React 18 + TypeScript   — typed UI and reusable components
Vite 5                  — dev server with hot reload + fast builds
vite-plugin-electron    — Electron integration inside Vite
Electron 31             — cross-platform desktop shell
Node SerialPort 12      — serial communication with the board
SCSS                    — styling (dark FFBeast-style theme)
Tabler Icons (webfont)  — bundled locally, no CDN/internet needed
```

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Rebuild the native serialport module against Electron (required once,
#    and after any Electron version change)
npm run rebuild

# 3. Run in development (hot reload)
npm run dev
```

If `npm install` reports blocked install scripts (npm `allow-scripts`), approve
them so Electron and serialport can build their native binaries:

```bash
npm approve-scripts --allow-scripts-pending
npm run rebuild
```

### Build a distributable

```bash
npm run build:win      # Windows .exe (NSIS installer + portable) -> release/
npm run build:mac      # macOS .dmg
npm run build:linux    # Linux .AppImage + .deb
```

`build:win` runs `tsc` (strict type-check) → `vite build` → `electron-builder`.
Output lands in `release/`.

On Windows, native module compilation needs the **Desktop development with C++**
workload (Visual Studio Build Tools) for the `npm run rebuild` step.

The app icon is `public/icon.ico`. To regenerate it from `src/assets/logo.png`
(e.g. after changing the logo), run `node scripts/make-icon.cjs` — it emits a
multi-resolution (256/48/32/16) ICO via the `jimp` + `png-to-ico` dev deps.

## Project structure

```
electron/
  main.ts            # Main process: windows, IPC, overlay, WebUSB (DFU 0483:DF11),
                     #   pickGameExe (dialog + app.getFileIcon) + listProcesses (tasklist)
  preload.ts         # Typed bridge (contextBridge -> window.ow)
  serial.ts          # SerialManager: FIFO queue, resync guard, connect/query/send

src/
  main.tsx           # Entry point + providers + overlay routing
  App.tsx            # Shell + page routing

  context/
    DeviceContext.tsx  # Connection state, auto-connect, live polling (pausable), console log
    ThemeContext.tsx   # Accent colour (persisted)
    NavContext.tsx     # Sidebar order + hidden tabs (persisted, reorderable)
    I18nContext.tsx    # Language + t() translator (persisted)

  locales/             # fr (source) / en / pt-br dictionaries

  hooks/
    useLiveApply.ts    # Per-field debounced live writes (sliders -> board)
    useConfig.ts       # Persisted wheel/motor config helpers
    useAutoProfile.ts  # Background loop: auto-switch profile by detected game process

  lib/
    odrive.ts          # Dual-protocol read/write (odrv + offb), value parsing
    ffbConfig.ts       # FFB wheel/effects/filters read/write, live-apply, capture/apply profile
    odriveSchema.ts    # Full ODrive field schema (5 sections, enums, RO flags)
    odriveErrors.ts    # Error-register bit decoders (Status tab)
    serialLog.ts       # Serial log bus -> Console (writes + on-demand reads)
    commandList.ts     # "Available commands" list for the Console picker
    profiles.ts        # Shared profile store (localStorage load/save + ow:profiles event)
    dfu.ts             # DfuSe firmware flash over WebUSB (preserves FFB EEPROM)

  components/
    Titlebar.tsx       # Custom window title bar (logo + device status)
    Sidebar.tsx        # Icon navigation rail (consumes NavContext)
    SchemaSection.tsx  # Generic ODrive field renderer (read/write/dirty-track)
    ui.tsx             # Slider (with hint tooltip), Toggle, TorqueDial, Sparkline, Toast

  pages/
    Dashboard.tsx      # Wheel visual + angle presets + invert + profiles card
    Odrive.tsx         # PSU/RBrake - Axis 0 - Motor - Encoder - Controller tabs
    Config.tsx         # FFB tab (wheel, gains, added effects, end-stop) + Filters tab
    Tools.tsx          # Profiles - Status - Console (+ DFU component, hosted in Settings)
    Preferences.tsx    # Themes - Settings (connection, sidebar) with Réglages/Flash tabs
    Overlay.tsx        # In-game telemetry overlay

  types/index.ts       # Global types + window.ow API surface
  styles/global.scss   # Theme + component styles

scripts/make-icon.cjs  # Regenerates public/icon.ico from src/assets/logo.png
```

## How device communication works

The renderer never touches the serial port directly. It calls `window.ow.*`
(exposed by the typed preload), which forwards to the main process:

```ts
// Low level
await window.ow.query('r vbus_voltage')      // ODrive ASCII read
await window.ow.query('axis.range?')         // OpenFFBoard read -> "[axis.range?|900]"
await window.ow.send('w axis0.requested_state 1')

// Helpers (src/lib/odrive.ts) pick the right protocol automatically
import { readProp, writeProp } from '@/lib/odrive'
const range = await readProp('axis.range', 'offb')
await writeProp('axis0.motor.config.current_lim', 20, 'odrv')
```

The transport is **strictly serialized**: every command (read or write) goes
through a promise chain in `serial.ts`, so only ONE command is on the wire at a
time and there is only ever one pending reply. This guarantees a reply can only
match its own request — essential here because the background telemetry polling
runs continuously and would otherwise interleave with page reads and cross
replies (e.g. a read returning another command's value). A 2 s timeout flushes
the pending entry; writes leave a short drain window so a late error reply is
discarded before the next command.

The board is found by its USB **VID:PID `1209:0D40`**, so auto-connect works on
any machine regardless of which COM port Windows assigns.

## Editing, saving & customizing

- **Live editing.** Dragging any FFB slider writes the changed parameter to the
  board immediately (RAM only), debounced per-field so the single-flight serial
  queue isn't flooded. No "Apply" step — you feel changes as you make them.
- **Saving.** The **Save** button persists to non-volatile memory: FFB params to
  the OpenFFBoard EEPROM (`sys.save!`, after disarming the motor) and ODrive
  fields to NVM (`ss`). Live edits survive until you reboot the board; Save makes
  them permanent.
- **Sidebar.** In **Settings → *Menu latéral*** you can drag to reorder tabs (or
  use the up/down arrows) and hide the ones you don't use. The layout is stored
  in `localStorage`; *Thème* and *Réglages* are always visible so you can never
  lock yourself out.

## Adding a page

1. Create the component in `src/pages/`.
2. Register it in `PAGES` (`src/App.tsx`).
3. Add a nav entry to `NAV_ITEMS` (`src/context/NavContext.tsx`) — it becomes
   reorderable/hideable automatically; the persisted order merges new ids on
   upgrade. (Fixed bottom entries like *Thème* / *Réglages* live in
   `BOTTOM_NAV` in `src/components/Sidebar.tsx`.)
4. Add its id to the `PageId` type (`src/types/index.ts`).

## Credits

- **Firmware:** this app targets my own fork,
  [aksc857-stack/Odrive-Wheel](https://github.com/aksc857-stack/Odrive-Wheel),
  which adds **separate axis inversion and FFB inversion** controls — features the
  original firmware doesn't expose independently.
- **Original firmware:** full credit to
  [eagabriel/Odrive-Wheel](https://github.com/eagabriel/Odrive-Wheel), the project
  my fork is based on. It in turn combines
  [ODrive](https://github.com/odriverobotics/ODrive) and
  [OpenFFBoard](https://github.com/Ultrawipf/OpenFFBoard).
- UI inspired by FFBeast Pit House.

This is an independent, unofficial tool and is not affiliated with ODrive
Robotics, OpenFFBoard, MOZA, or FFBeast.

## License

GPL-3.0 — compatible with the Odrive-Wheel firmware (OpenFFBoard is GPLv3).
