# Neon Coil — Dark Neon Snake & Synth Player

A dark neon arcade **Snake** game combined with an interactive **synth music player**, built with React, TypeScript, Tailwind CSS, and the Web Audio API.

### Play Online
👉 **[Play Neon Coil Live](https://metanetmx.github.io/Snake-game-with-gmini/)**

---

## Features

- **Center-Stage Snake Arena**: High-DPI HTML5 Canvas gameplay with smooth movement interpolation, glowing neon segments, particle bursts, combo streaks, and timed bonus orbs (`+30 pts`).
- **Score Counter & Top Runs**: Live HUD tracking **Score**, **Best** (saved in `localStorage`), **Length**, and **Streak**, paired with a persistent **Top Runs** leaderboard.
- **3 Synthesized Demo Tracks**: Real-time Web Audio API procedural electronic music with distinct chords, basslines, arpeggios, leads, drums, custom album artwork, and synced neon accent palettes:
  1. **Midnight Grid** — Outrun Synthwave · 118 BPM
  2. **Velvet Voltage** — Dark Electro · 126 BPM
  3. **Aurora Drift** — Ambient Chillwave · 94 BPM
- **Full Music Player Controls**: Play/Pause, Previous/Next track skip, interactive seek scrubber, repeat toggle, master volume & mute, independent game SFX toggle, and a live FFT frequency spectrum visualizer.
- **Customizable Gameplay**: Switch between **Chill / Classic / Turbo** speeds and **Solid Walls / Wrap Edges** boundary modes, with touch D-pad support on mobile devices.

## Controls

| Action | Keys |
| :--- | :--- |
| Steer Snake | `Arrow Keys` or `W A S D` |
| Start / Pause / Resume | `Space` |
| Reset Board | `R` |
| Previous / Next Track | `[` / `]` |
| Mute / Unmute Audio | `M` |

## Run Locally

```bash
npm install
npm run dev
```

To build for production:

```bash
npm run build
```
