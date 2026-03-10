const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || './data';

const PATHS = {
  data: DATA_DIR,
  latest: path.join(DATA_DIR, 'latest'),
  latestJpg: path.join(DATA_DIR, 'latest', 'latest.jpg'),
  frames: path.join(DATA_DIR, 'frames'),
  timelapse: path.join(DATA_DIR, 'timelapse'),
  timelapseDaily: path.join(DATA_DIR, 'timelapse', 'daily'),
  stateFile: path.join(DATA_DIR, 'state.json'),
  configFile: path.join(DATA_DIR, 'config.json'),
};

function ensureDirs() {
  [
    PATHS.data,
    PATHS.latest,
    PATHS.frames,
    PATHS.timelapse,
    PATHS.timelapseDaily,
  ].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function readState() {
  try {
    if (fs.existsSync(PATHS.stateFile)) {
      return JSON.parse(fs.readFileSync(PATHS.stateFile, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading state:', e.message);
  }
  return {
    last_capture_ok: null,
    last_capture_error: null,
    total_frames_today: 0,
    camera_online: false,
  };
}

function writeState(state) {
  try {
    fs.writeFileSync(PATHS.stateFile, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing state:', e.message);
  }
}

const DEFAULT_CONFIG = {
  camera_base_url: process.env.CAMERA_BASE_URL || 'http://192.168.2.120',
  camera_stream_url: process.env.CAMERA_STREAM_URL || 'http://192.168.2.120:81/stream',
  capture_interval_min: parseInt(process.env.CAPTURE_INTERVAL_MIN || '10', 10),
  lights_on: process.env.LIGHTS_ON || '06:00',
  lights_off: process.env.LIGHTS_OFF || '24:00',
  timelapse_fps: parseInt(process.env.TIMELAPSE_FPS || '30', 10),
  retention_days: parseInt(process.env.RETENTION_DAYS || '30', 10),
};

function readConfig() {
  try {
    if (fs.existsSync(PATHS.configFile)) {
      const saved = JSON.parse(fs.readFileSync(PATHS.configFile, 'utf8'));
      return Object.assign({}, DEFAULT_CONFIG, saved);
    }
  } catch (e) {
    console.error('Error reading config:', e.message);
  }
  return Object.assign({}, DEFAULT_CONFIG);
}

function writeConfig(config) {
  try {
    const merged = Object.assign({}, readConfig(), config);
    fs.writeFileSync(PATHS.configFile, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  } catch (e) {
    console.error('Error writing config:', e.message);
    throw e;
  }
}

function listDailyTimelapses() {
  try {
    ensureDirs();
    const files = fs.readdirSync(PATHS.timelapseDaily)
      .filter((f) => f.endsWith('.mp4'))
      .sort()
      .reverse();
    return files.map((f) => {
      const fullPath = path.join(PATHS.timelapseDaily, f);
      const stats = fs.statSync(fullPath);
      return {
        filename: f,
        date: f.replace('.mp4', ''),
        size: stats.size,
        url: `/media/timelapse/daily/${f}`,
      };
    });
  } catch (e) {
    console.error('Error listing daily timelapses:', e.message);
    return [];
  }
}

function getRollingTimelapses() {
  const result = {};
  ['rolling_7d.mp4', 'rolling_30d.mp4'].forEach((name) => {
    const fullPath = path.join(PATHS.timelapse, name);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      result[name.replace('.mp4', '')] = {
        url: `/media/timelapse/${name}`,
        size: stats.size,
        exists: true,
      };
    } else {
      result[name.replace('.mp4', '')] = { exists: false };
    }
  });
  return result;
}

module.exports = {
  PATHS,
  ensureDirs,
  readState,
  writeState,
  readConfig,
  writeConfig,
  listDailyTimelapses,
  getRollingTimelapses,
};
