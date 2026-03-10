#!/usr/bin/env node
/**
 * Daily timelapse render — run after midnight via systemd timer.
 * Renders frames from yesterday into data/timelapse/daily/YYYY-MM-DD.mp4
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { acquireLock } = require('../src/services/locks');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FRAMES_DIR = path.join(DATA_DIR, 'frames');
const TIMELAPSE_DAILY = path.join(DATA_DIR, 'timelapse', 'daily');
const FPS = parseInt(process.env.TIMELAPSE_FPS || '30', 10);
const RENDER_LOCK = '/tmp/growcam-render.lock';

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

function getTargetDate() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function render(dateStr) {
  const frameDir = path.join(FRAMES_DIR, dateStr);
  if (!fs.existsSync(frameDir)) {
    console.log(`No frames for ${dateStr}, skipping`);
    return;
  }

  const frames = fs.readdirSync(frameDir).filter(f => f.endsWith('.jpg')).sort();
  if (frames.length === 0) {
    console.log(`No jpg frames in ${frameDir}, skipping`);
    return;
  }

  ensureDir(TIMELAPSE_DAILY);
  const output = path.join(TIMELAPSE_DAILY, `${dateStr}.mp4`);
  const cmd = `ffmpeg -y -framerate ${FPS} -pattern_type glob -i "${frameDir}/*.jpg" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${output}"`;

  console.log(`Rendering ${frames.length} frames for ${dateStr}...`);
  execSync(cmd, { stdio: 'inherit' });
  console.log(`Rendered: ${output}`);
}

async function main() {
  let releaseLock;
  try {
    releaseLock = acquireLock(RENDER_LOCK);
  } catch (err) {
    if (err.code === 'EEXIST') {
      console.log('Render already running, skipping');
      process.exit(0);
    }
    throw err;
  }

  try {
    const dateArg = process.argv[2] || getTargetDate();
    await render(dateArg);
  } catch (e) {
    console.error('Render failed:', e.message);
    process.exitCode = 1;
  } finally {
    releaseLock();
  }
}

main();
