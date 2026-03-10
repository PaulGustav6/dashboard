require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const { ensureDirs, PATHS, readConfig } = require('./services/storage');
const apiRouter = require('./routes/api');

ensureDirs();

const app = express();
const PORT = process.env.PORT || 5000;
let liveStreamActive = false;

app.use(express.json());

app.use('/api', apiRouter);

app.use('/media/latest.jpg', (req, res) => {
  if (fs.existsSync(PATHS.latestJpg)) {
    res.sendFile(path.resolve(PATHS.latestJpg));
  } else {
    res.redirect('/placeholder.svg');
  }
});

app.get('/stream', async (req, res) => {
  if (liveStreamActive) {
    return res.status(429).send('Live stream already in use');
  }

  const { camera_stream_url: streamUrl } = readConfig();
  if (!streamUrl) {
    return res.status(503).send('Stream URL not configured');
  }

  let upstream;
  try {
    upstream = await fetch(streamUrl, { timeout: 10000 });
  } catch (err) {
    return res.status(502).send(`Unable to reach camera stream: ${err.message}`);
  }

  if (!upstream.ok || !upstream.body) {
    return res.status(502).send(`Camera stream error: HTTP ${upstream.status}`);
  }

  liveStreamActive = true;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'multipart/x-mixed-replace');

  const cleanup = () => {
    if (liveStreamActive) liveStreamActive = false;
    if (upstream && upstream.body) upstream.body.destroy();
  };

  req.on('close', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
  upstream.body.on('error', cleanup);
  upstream.body.pipe(res);
});

app.use('/media/timelapse/daily', express.static(path.resolve(PATHS.timelapseDaily)));
app.use('/media/timelapse', express.static(path.resolve(PATHS.timelapse)));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`GrowCam dashboard running on http://0.0.0.0:${PORT}`);
});
