# CutView

A simple Windows video viewer with a built-in trim editor.

- Open a video (double-click, "Open with", drag & drop or `Ctrl+O`), play/pause, click the timeline to jump, volume, speed, frame step, fullscreen.
- Trim editor under the timeline: drag the amber handles to keep only the part you want. The red line is the current moment and the handles snap onto it when close.
- **Export** saves the selected part as a new video, next to the original by default.
- **Settings**: language (French by default, English available), default export folder, **Ask path** toggle (off = auto-save next to the original), **Fast export** (no re-encode).

## Shortcuts

| Key | Action |
|---|---|
| Space / K | Play / pause |
| ← / → | Back / forward 5 s (Shift: 1 s) |
| , / . | Previous / next frame |
| I / O | Set trim start / end at the current moment |
| M, ↑ / ↓ | Mute, volume |
| F | Fullscreen |
| Ctrl+O / Ctrl+E | Open / export |

## Develop

```bash
npm install
npm start            # run the app
npm run dist         # build release/CutView-Setup-*.exe and release/CutView-*-portable.exe
```

Built with Electron; export and conversion use the bundled `ffmpeg-static`. Formats the player cannot decode (e.g. AVI) are converted to a temporary preview automatically; export always reads the original file.

The installer registers CutView as a video app so it shows up in "Open with". The portable exe needs no install.
