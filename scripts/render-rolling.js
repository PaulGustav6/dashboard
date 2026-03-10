#!/usr/bin/env node
/**
 * Rolling timelapse render — concatenates daily mp4s for 7d and 30d windows.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { acquireLock } = require('../src/services/locks');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const TIMELAPSE_DAILY = path.join(DATA_DIR, 'timelapse', 'daily');
const TIMELAPSE_DIR = path.join(DATA_DIR, 'timelapse');
const RENDER_LOCK = '/tmp/growcam-render.lock';

function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

function getDailyFiles(days) {
  if (!fs.existsSync(TIMELAPSE_DAILY)) return [];
  return fs.readdirSync(TIMELAPSE_DAILY)
    .filter(f => f.endsWith('.mp4'))
    .sort()
    .slice(-days)
    .map(f => path.join(TIMELAPSE_DAILY, f));
}

function quoteConcatPath(filePath) {
  return filePath.replace(/'/g, "'\\''");
}

function buildConcat(files) {
  const lines = ['ffconcat version 1.0', ...files.map(f => `file '${quoteConcatPath(f)}'`)];
  const tmpFile = path.join(os.tmpdir(), `concat_${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, lines.join('\n'));
  return tmpFile;
}

function renderConcat(concatFile, output) {
  try {
    execSync(`ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c copy "${output}"`, { stdio: 'inherit' });
    return true;
  } catch (e) {
    console.warn('Copy concat failed, trying re-encode...');
    try {
      execSync(`ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -pix_fmt yuv420p "${output}"`, { stdio: 'inherit' });
      return true;
    } catch (e2) {
      console.error('Re-encode failed:', e2.message);
      return false;
    }
  }
}

function renderRolling(days, label) {
  const files = getDailyFiles(days);
  if (files.length === 0) {
    console.log(`No daily files for ${label}, skipping`);
    return;
  }
  ensureDir(TIMELAPSE_DIR);
  const concatFile = buildConcat(files);
  const output = path.join(TIMELAPSE_DIR, `rolling_${label}.mp4`);
  console.log(`Building ${label} from ${files.length} files...`);
  const ok = renderConcat(concatFile, output);
  fs.unlinkSync(concatFile);
  if (ok) console.log(`Done: ${output}`);
}

function main() {
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
    renderRolling(7, '7d');
    renderRolling(30, '30d');
  } finally {
    releaseLock();
  }
}

main();
