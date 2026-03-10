const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const router = express.Router();

const { readState, writeState, readConfig, writeConfig, PATHS, listDailyTimelapses, getRollingTimelapses } = require('../services/storage');
const { fetchSnapshot } = require('../services/cameraClient');
const { acquireLock } = require('../services/locks');

const CAPTURE_LOCK = '/tmp/growcam-capture.lock';

function getDiskUsage() {
  try {
    const stat = fs.statfsSync(PATHS.data);
    const total = stat.blocks * stat.bsize;
    const free = stat.bavail * stat.bsize;
    return {
      total,
      free,
      used: total - free,
      used_percent: total > 0 ? Number((((total - free) / total) * 100).toFixed(2)) : 0,
    };
  } catch (err) {
    return null;
  }
}

function spawnScript(scriptName, args = []) {
  const child = spawn(process.execPath, [path.join(__dirname, '..', '..', 'scripts', scriptName), ...args], {
    cwd: path.join(__dirname, '..', '..'),
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

router.get('/status', async (req, res) => {
  const state = readState();
  const config = readConfig();
  const latestExists = fs.existsSync(PATHS.latestJpg);
  const staleAfterMs = (Number(config.capture_interval_min) || 10) * 60 * 1000 * 2;
  const stale_capture = !state.last_capture_ok || (Date.now() - Date.parse(state.last_capture_ok) > staleAfterMs);

  res.json({
    camera_online: state.camera_online || false,
    last_capture_ok: state.last_capture_ok || null,
    last_capture_error: state.last_capture_error || null,
    total_frames_today: state.total_frames_today || 0,
    latest_snapshot_exists: latestExists,
    stream_url: config.camera_stream_url,
    stale_capture,
    disk_usage: getDiskUsage(),
  });
});

router.post('/capture-now', async (req, res) => {
  const state = readState();
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');

  const frameDir = path.join(PATHS.frames, dateStr);
  if (!fs.existsSync(frameDir)) {
    fs.mkdirSync(frameDir, { recursive: true });
  }
  if (!fs.existsSync(PATHS.latest)) {
    fs.mkdirSync(PATHS.latest, { recursive: true });
  }

  const framePath = path.join(frameDir, `${timeStr}.jpg`);
  let releaseLock;

  try {
    releaseLock = acquireLock(CAPTURE_LOCK);
    const result = await fetchSnapshot(PATHS.latestJpg);
    fs.copyFileSync(PATHS.latestJpg, framePath);

    state.camera_online = true;
    state.last_capture_ok = now.toISOString();
    state.last_capture_error = null;
    state.total_frames_today = (state.total_frames_today || 0) + 1;
    writeState(state);

    res.json({ ok: true, timestamp: now.toISOString(), size: result.size });
  } catch (err) {
    if (err.code === 'EEXIST') {
      return res.status(429).json({ ok: false, error: 'Capture already running' });
    }
    state.camera_online = false;
    state.last_capture_error = err.message;
    writeState(state);
    res.status(502).json({ ok: false, error: err.message });
  } finally {
    if (releaseLock) releaseLock();
  }
});

router.post('/timelapse/render-today', (req, res) => {
  const date = new Date().toISOString().slice(0, 10);
  spawnScript('render-daily.js', [date]);
  res.status(202).json({ ok: true, message: `Render for ${date} started` });
});

router.post('/timelapse/render-rolling', (req, res) => {
  spawnScript('render-rolling.js');
  res.status(202).json({ ok: true, message: 'Rolling render started' });
});

router.get('/timelapse/daily', (req, res) => {
  res.json(listDailyTimelapses());
});

router.get('/timelapse/rolling', (req, res) => {
  res.json(getRollingTimelapses());
});

router.get('/config', (req, res) => {
  res.json(readConfig());
});

router.post('/config', (req, res) => {
  try {
    const updated = writeConfig(req.body);
    res.json({ ok: true, config: updated });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/water/arm', (req, res) => {
  res.json({ ok: true, status: 'stub', message: 'Watering arm — coming soon' });
});

router.post('/water/run', (req, res) => {
  res.json({ ok: true, status: 'stub', message: 'Watering run — coming soon' });
});

module.exports = router;
