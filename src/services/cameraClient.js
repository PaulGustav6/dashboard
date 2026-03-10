const fetch = require('node-fetch');
const fs = require('fs');
const { readConfig } = require('./storage');

const TIMEOUT_MS = 8000;

async function fetchSnapshot(destPath) {
  const config = readConfig();
  const url = `${config.camera_base_url}/capture`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Camera responded with status ${res.status}`);
    }

    const buffer = await res.buffer();
    fs.writeFileSync(destPath, buffer);
    return { ok: true, size: buffer.length };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`Camera snapshot timed out after ${TIMEOUT_MS}ms`);
    }
    throw err;
  }
}

async function checkCameraOnline() {
  const config = readConfig();
  const url = `${config.camera_base_url}/capture`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    return res.ok || res.status < 500;
  } catch (err) {
    clearTimeout(timer);
    return false;
  }
}

function getStreamUrl() {
  const config = readConfig();
  return config.camera_stream_url;
}

module.exports = { fetchSnapshot, checkCameraOnline, getStreamUrl };
