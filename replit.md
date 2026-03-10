# GrowCam Dashboard

A lightweight full-stack Node.js + Express dashboard for managing an ESP32-CAM (OV2640) on a Raspberry Pi.

## Architecture

- **Backend**: Node.js + Express, single server (`src/server.js`) on port 5000
- **Frontend**: Vanilla HTML/CSS/JS in `public/` — no build step required
- **Storage**: Filesystem-based (JSON config/state + folder structure for frames/timelapses). No database.
- **Scripts**: Background jobs in `scripts/` for capture, timelapse rendering, and pruning

## Project Structure

```
src/
  server.js              — Express entry point
  routes/api.js          — All API routes
  services/
    storage.js           — File paths, config/state read-write
    cameraClient.js      — Camera fetch helpers
public/
  index.html             — Single-page app
  styles.css             — Dark fluid-responsive design
  app.js                 — Vanilla JS frontend
scripts/
  capture.js             — Run periodically to grab a frame
  render-daily.js        — Build daily timelapse MP4
  render-rolling.js      — Build 7d/30d rolling timelapses
  prune.js               — Delete old frames and videos
data/
  config.json            — Persisted settings (created at runtime)
  state.json             — Camera status (created at runtime)
  latest/latest.jpg      — Most recent snapshot
  frames/YYYY-MM-DD/     — Captured frames
  timelapse/daily/       — Daily MP4s
  timelapse/rolling_*.mp4 — Rolling timelapses
```

## Key Configuration

Environment variables (see `.env.example`):
- `PORT=5000`
- `DATA_DIR=./data`
- `CAMERA_BASE_URL=http://192.168.2.120`
- `CAMERA_STREAM_URL=http://192.168.2.120:81/stream`

Settings can also be changed via the Settings tab in the UI — persisted to `data/config.json`.

## Running

- **Workflow**: `node src/server.js` on port 5000
- **Dependencies**: express, dotenv, node-fetch@2
- **System deps**: ffmpeg (for timelapse scripts, not required for the web server)

## Design

- Dark theme by default, fluid typography with `clamp()`
- Four tabs: Dashboard, Timelapse, Settings, Watering (stub)
- Camera offline gracefully shows a placeholder image
- Live stream only loads on demand (no auto-polling)
