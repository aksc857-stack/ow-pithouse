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

---

## What it does

The board speaks **two protocols over the same serial link**, and the app
handles both:

- **ODrive ASCII** (`r <path>` / `w <path> <value>`) — motor, encoder, power,
  live telemetry.
- **OpenFFBoard cmdparser** (`<path>?` / `<path>=<value>` / `<path>!`) — all FFB
  wheel, effects and filter parameters.

On connect, the app auto-reads the real settings from the board so the UI
reflects what's actually flashed, not hard-coded defaults.

## Status

| Area | State |
|------|-------|
| Auto-connect by USB **VID:PID** (`1209:0D40`), independent of COM number | ✅ working |
| **Dashboard** — wheel visual with live HID-direction rotation, angle presets (360/540/720/900/1080), FFB intensity, output torque | ✅ working |
| **ODrive** tab — PSU/RBrake, Axis 0, Motor, Encoder, Controller (full schema, read-only calibration fields flagged) | ✅ values read correctly |
| **FFB** tab — range, max torque, master gain, permanent effects, end-stop (correct OpenFFBoard paths & scales) | ✅ working |
| Serial transport — single-flight FIFO queue + resync guard (mirrors the reference tool, avoids CDC desync) | ✅ working |
| **Effects / Filters** tabs | 🚧 UI present, wiring to firmware in progress |
| **Monitor** tab | 🚧 partial / values being verified |
| **Auto-Profiler** (game detection → profile switch) | 🚧 UI mockup, detection not implemented |
| **Console** — ODrive/OpenFFBoard ASCII | ✅ working |
| **DFU flash** from the app | 🚧 UI present, flashing flow not finished |
| **Overlay** (in-game telemetry window) | 🚧 experimental |
| Save: FFB EEPROM (`sys.save!`) + ODrive NVM (`ss`) | ✅ working |

Anything marked 🚧 may show placeholder or inconsistent values for now.

## Tech stack

```
React 18 + TypeScript   — typed UI and reusable components
Vite 5                  — dev server with hot reload + fast builds
vite-plugin-electron    — Electron integration inside Vite
Electron 31             — cross-platform desktop shell
Node SerialPort 12      — serial communication with the board
SCSS                    — styling (dark FFBeast-style theme)
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
npm run build:win      # Windows .exe (NSIS installer + portable)
npm run build:mac      # macOS .dmg
npm run build:linux    # Linux .AppImage + .deb
```

On Windows, native module compilation needs the **Desktop development with C++**
workload (Visual Studio Build Tools) for the `npm run rebuild` step.

## Project structure

```
electron/
  main.ts            # Main process: windows, IPC, overlay
  preload.ts         # Typed bridge (contextBridge -> window.ow)
  serial.ts          # SerialManager: FIFO queue, resync guard, connect/query/send

src/
  main.tsx           # Entry point + providers + overlay routing
  App.tsx            # Shell + page routing

  context/
    DeviceContext.tsx  # Connection state, auto-connect, live polling, auto-read
    ThemeContext.tsx   # Accent colour (persisted)

  lib/
    odrive.ts          # Dual-protocol read/write (odrv + offb), value parsing
    ffbConfig.ts       # FFB wheel read/write with correct paths & scales
    odriveSchema.ts    # Full ODrive field schema (5 sections, enums, RO flags)

  components/
    Titlebar.tsx       # Custom window title bar
    Sidebar.tsx        # Icon navigation rail
    SchemaSection.tsx  # Generic ODrive field renderer (read/write/dirty-track)
    ui.tsx             # Slider, Toggle, TorqueDial, Sparkline, Toast

  pages/
    Dashboard.tsx      # Wheel visual + angle presets + base controls
    Odrive.tsx         # PSU/RBrake - Axis 0 - Motor - Encoder - Controller tabs
    Config.tsx         # FFB + Effects
    Tools.tsx          # Profiles - Monitor - Console - DFU
    Preferences.tsx    # Themes - Settings (connection, auto-connect)
    Overlay.tsx        # In-game telemetry overlay

  types/index.ts       # Global types + window.ow API surface
  styles/global.scss   # Theme + component styles
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

The transport uses a **single-flight FIFO queue with a resync guard**: only one
command is in flight at a time, and on a timeout the whole queue and read buffer
are flushed. This mirrors the reference web tool and prevents the CDC link from
desyncing (which otherwise causes replies to land on the wrong request).

The board is found by its USB **VID:PID `1209:0D40`**, so auto-connect works on
any machine regardless of which COM port Windows assigns.

## Adding a page

1. Create the component in `src/pages/`.
2. Register it in `PAGES` (`src/App.tsx`).
3. Add a nav entry in `TOP_NAV` / `BOTTOM_NAV` (`src/components/Sidebar.tsx`).
4. Add its id to the `PageId` type (`src/types/index.ts`).

## Credits

- Firmware: [Odrive-Wheel](https://github.com/aksc857-stack/Odrive-Wheel)
  (forked from [eagabriel/Odrive-Wheel](https://github.com/eagabriel/Odrive-Wheel)),
  itself combining [ODrive](https://github.com/odriverobotics/ODrive) and
  [OpenFFBoard](https://github.com/Ultrawipf/OpenFFBoard).
- UI inspired by FFBeast Pit House.

This is an independent, unofficial tool and is not affiliated with ODrive
Robotics, OpenFFBoard, MOZA, or FFBeast.

## License

GPL-3.0 — compatible with the Odrive-Wheel firmware (OpenFFBoard is GPLv3).
