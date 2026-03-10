#!/usr/bin/env node
/**
 * Prune job — deletes frames and daily timelapses older than RETENTION_DAYS.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { acquireLock } = require('../src/services/locks');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const PRUNE_LOCK = '/tmp/growcam-prune.lock';

function readRetentionDays() {
  const def = parseInt(process.env.RETENTION_DAYS || '30', 10);
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return cfg.retention_days || def;
    }
  } catch (e) { /* ignore */ }
  return def;
}

function pruneDir(dir, days) {
  if (!fs.existsSync(dir)) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  fs.readdirSync(dir).forEach(entry => {
    if (entry < cutoffStr) {
      const fullPath = path.join(dir, entry);
      try {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`Pruned: ${fullPath}`);
      } catch (e) {
        console.error(`Failed to prune ${fullPath}:`, e.message);
      }
    }
  });
}

function main() {
  let releaseLock;
  try {
    releaseLock = acquireLock(PRUNE_LOCK);
  } catch (err) {
    if (err.code === 'EEXIST') {
      console.log('Prune already running, skipping');
      process.exit(0);
    }
    throw err;
  }

  try {
    const days = readRetentionDays();
    console.log(`Pruning entries older than ${days} days...`);
    pruneDir(path.join(DATA_DIR, 'frames'), days);
    pruneDir(path.join(DATA_DIR, 'timelapse', 'daily'), days);
    console.log('Prune complete');
  } finally {
    releaseLock();
  }
}

main();
