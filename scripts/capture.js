#!/usr/bin/env node
/**
 * Capture job — run via cron or systemd timer.
 * Grabs one snapshot from the camera and saves it to data/frames/YYYY-MM-DD/HHMMSS.jpg
 * Also updates data/latest/latest.jpg and data/state.json.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FRAMES_DIR = path.join(DATA_DIR, 'frames');
const LATEST_DIR = path.join(DATA_DIR, 'latest');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

function readConfig() {
  const defaults = {
    camera_base_url: process.env.CAMERA_BASE_URL || 'http://192.168.2.120',
    lights_on: process.env.LIGHTS_ON || '06:00',
    lights_off: process.env.LIGHTS_OFF || '24:00',
  };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return Object.assign({}, defaults, JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')));
    }
  } catch (e) { /* use defaults */ }
  return defaults;
}

function readState() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) { /* ignore */ }
  return { last_capture_ok: null, last_capture_error: null, total_frames_today: 0, camera_online: false };
}

function writeState(s) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

function isLightsOn(config) {
  const now = new Date();
  const hhmm = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  const on = config.lights_on || '06:00';
  const off = config.lights_off || '24:00';
  if (off === '24:00' || off === '00:00') return hhmm >= on;
  return hhmm >= on && hhmm < off;
}

async function run() {
  const config = readConfig();

  if (!isLightsOn(config)) {
    console.log('Capture skipped by lights schedule');
    process.exit(0);
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');

  const frameDir = path.join(FRAMES_DIR, dateStr);
  [frameDir, LATEST_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

  const framePath = path.join(frameDir, `${timeStr}.jpg`);
  const latestPath = path.join(LATEST_DIR, 'latest.jpg');
  const url = `${config.camera_base_url}/capture`;

  const state = readState();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.buffer();
    fs.writeFileSync(framePath, buf);
    fs.copyFileSync(framePath, latestPath);

    const todayFrames = fs.readdirSync(frameDir).filter(f => f.endsWith('.jpg')).length;
    state.camera_online = true;
    state.last_capture_ok = now.toISOString();
    state.last_capture_error = null;
    state.total_frames_today = todayFrames;
    writeState(state);
    console.log(`Captured ${framePath} (${buf.length} bytes)`);
  } catch (err) {
    clearTimeout(timer);
    state.camera_online = false;
    state.last_capture_error = err.message;
    writeState(state);
    console.error('Capture failed:', err.message);
    process.exit(1);
  }
}

run();
