const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const { readState, writeState, readConfig, writeConfig, PATHS, listDailyTimelapses, getRollingTimelapses } = require('../services/storage');
const { fetchSnapshot, checkCameraOnline, getStreamUrl } = require('../services/cameraClient');

router.get('/status', async (req, res) => {
  const state = readState();
  const config = readConfig();
  const latestExists = fs.existsSync(PATHS.latestJpg);
  res.json({
    camera_online: state.camera_online || false,
    last_capture_ok: state.last_capture_ok || null,
    last_capture_error: state.last_capture_error || null,
    total_frames_today: state.total_frames_today || 0,
    latest_snapshot_exists: latestExists,
    stream_url: config.camera_stream_url,
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

  try {
    const result = await fetchSnapshot(PATHS.latestJpg);
    fs.copyFileSync(PATHS.latestJpg, framePath);

    state.camera_online = true;
    state.last_capture_ok = now.toISOString();
    state.last_capture_error = null;
    state.total_frames_today = (state.total_frames_today || 0) + 1;
    writeState(state);

    res.json({ ok: true, timestamp: now.toISOString(), size: result.size });
  } catch (err) {
    state.camera_online = false;
    state.last_capture_error = err.message;
    writeState(state);
    res.status(502).json({ ok: false, error: err.message });
  }
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
