/* GrowCam Dashboard - Vanilla JS */

(function () {
  'use strict';

  // --- TAB NAVIGATION ---
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabSections = document.querySelectorAll('.tab-section');

  function showTab(name) {
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    tabSections.forEach(s => {
      const isTarget = s.id === `tab-${name}`;
      s.classList.toggle('hidden', !isTarget);
      s.classList.toggle('active', isTarget);
    });
    if (name === 'timelapse') loadTimelapse();
    if (name === 'settings') loadSettings();
  }

  tabBtns.forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));

  // --- API helpers ---
  async function api(path, opts = {}) {
    const res = await fetch(path, opts);
    return res.json();
  }

  // --- STATUS ---
  async function loadStatus() {
    try {
      const data = await api('/api/status');
      const badge = document.getElementById('status-badge');
      badge.textContent = data.camera_online ? 'Online' : 'Offline';
      badge.className = 'badge ' + (data.camera_online ? 'badge-online' : 'badge-offline');

      document.getElementById('last-capture').textContent =
        data.last_capture_ok ? new Date(data.last_capture_ok).toLocaleString() : '—';
      document.getElementById('frames-today').textContent = data.total_frames_today || 0;
      document.getElementById('last-error').textContent = data.last_capture_error || '—';
    } catch (e) {
      console.error('Status load error:', e);
    }
  }

  document.getElementById('btn-refresh-status').addEventListener('click', () => {
    loadStatus();
    refreshSnapshot();
  });

  // --- CAPTURE ---
  document.getElementById('btn-capture').addEventListener('click', async () => {
    const btn = document.getElementById('btn-capture');
    btn.disabled = true;
    btn.textContent = 'Capturing…';
    try {
      const data = await api('/api/capture-now', { method: 'POST' });
      if (data.ok) {
        refreshSnapshot();
        await loadStatus();
      } else {
        alert('Capture failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Request failed: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Capture Now';
    }
  });

  // --- SNAPSHOT ---
  function refreshSnapshot() {
    const img = document.getElementById('snapshot-img');
    img.src = '/media/latest.jpg?t=' + Date.now();
    document.getElementById('snapshot-ts').textContent = new Date().toLocaleTimeString();
  }

  // --- LIVE STREAM ---
  let liveActive = false;

  document.getElementById('btn-live').addEventListener('click', async () => {
    document.getElementById('live-section').classList.remove('hidden');
    document.getElementById('live-img').src = '/stream';
    liveActive = true;
    document.getElementById('btn-live').disabled = true;
  });

  document.getElementById('btn-live-stop').addEventListener('click', () => {
    document.getElementById('live-img').src = '';
    document.getElementById('live-section').classList.add('hidden');
    liveActive = false;
    document.getElementById('btn-live').disabled = false;
  });

  // --- TIMELAPSE ---
  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  async function loadTimelapse() {
    await Promise.all([loadRolling(), loadDaily()]);
  }

  async function loadRolling() {
    const container = document.getElementById('rolling-timelapse-container');
    try {
      const data = await api('/api/timelapse/rolling');
      const keys = ['rolling_7d', 'rolling_30d'];
      const labels = { rolling_7d: '7-Day Rolling', rolling_30d: '30-Day Rolling' };

      container.innerHTML = keys.map(k => {
        const item = data[k];
        if (!item || !item.exists) {
          return `<div class="rolling-row">
            <div><div class="rolling-label">${labels[k]}</div>
            <div class="rolling-meta not-generated">Not generated yet</div></div>
          </div>`;
        }
        return `<div class="rolling-row">
          <div>
            <div class="rolling-label">${labels[k]}</div>
            <div class="rolling-meta">${fmtSize(item.size)}</div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-primary btn-sm" onclick="playVideo('${item.url}','${labels[k]}')">&#9654; Play</button>
            <a class="btn btn-ghost btn-sm" href="${item.url}" download>Download</a>
          </div>
        </div>`;
      }).join('');
    } catch (e) {
      container.innerHTML = '<div class="loading">Failed to load</div>';
    }
  }

  async function loadDaily() {
    const container = document.getElementById('daily-timelapse-container');
    try {
      const data = await api('/api/timelapse/daily');
      if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state">No daily timelapses yet. They will appear here once generated.</div>';
        return;
      }
      container.innerHTML = data.map(v => `
        <div class="video-card">
          <div class="video-date">${v.date}</div>
          <div class="video-size">${fmtSize(v.size)}</div>
          <div class="video-actions">
            <button class="btn btn-primary btn-sm" onclick="playVideo('${v.url}','${v.date}')">&#9654; Play</button>
            <a class="btn btn-ghost btn-sm" href="${v.url}" download="${v.filename}">Save</a>
          </div>
        </div>
      `).join('');
    } catch (e) {
      container.innerHTML = '<div class="empty-state">Failed to load daily timelapses.</div>';
    }
  }

  document.getElementById('btn-render-today').addEventListener('click', async () => {
    const btn = document.getElementById('btn-render-today');
    btn.disabled = true;
    btn.textContent = 'Rendering…';
    try {
      const data = await api('/api/timelapse/render-today', { method: 'POST' });
      alert(data.message || 'Render started');
    } catch (e) {
      alert('Render request failed: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Render Today';
    }
  });

  // --- SETTINGS ---
  async function loadSettings() {
    const data = await api('/api/config').catch(() => null);
    if (!data) return;
    document.getElementById('cfg-camera-base-url').value = data.camera_base_url || '';
    document.getElementById('cfg-stream-url').value = data.camera_stream_url || '';
    document.getElementById('cfg-interval').value = data.capture_interval_min || 10;
    document.getElementById('cfg-lights-on').value = data.lights_on || '06:00';
    document.getElementById('cfg-lights-off').value = data.lights_off === '24:00' ? '00:00' : (data.lights_off || '00:00');
    document.getElementById('cfg-fps').value = data.timelapse_fps || 30;
    document.getElementById('cfg-retention').value = data.retention_days || 30;
  }

  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('settings-msg');
    const formData = new FormData(e.target);
    const body = {};
    formData.forEach((v, k) => { body[k] = isNaN(v) || v === '' ? v : Number(v); });

    try {
      const data = await api('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (data.ok) {
        msg.textContent = 'Settings saved!';
        msg.className = 'settings-msg ok';
      } else {
        msg.textContent = 'Error: ' + (data.error || 'unknown');
        msg.className = 'settings-msg err';
      }
    } catch (err) {
      msg.textContent = 'Request failed: ' + err.message;
      msg.className = 'settings-msg err';
    }
    setTimeout(() => { msg.textContent = ''; }, 3000);
  });

  // --- WATERING STUBS ---
  window.callStub = async function (path) {
    try {
      const data = await api(path);
      document.getElementById('stub-result').textContent = JSON.stringify(data);
    } catch (e) {
      document.getElementById('stub-result').textContent = 'Error: ' + e.message;
    }
  };

  // --- VIDEO MODAL ---
  window.playVideo = function (url, title) {
    document.getElementById('modal-title').textContent = title || 'Video';
    document.getElementById('modal-video').src = url;
    document.getElementById('video-modal').classList.remove('hidden');
  };

  function closeModal() {
    document.getElementById('video-modal').classList.add('hidden');
    const vid = document.getElementById('modal-video');
    vid.pause();
    vid.src = '';
  }

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', closeModal);

  // --- PLACEHOLDER SVG ---
  const placeholderCanvas = document.createElement('canvas');
  placeholderCanvas.width = 640;
  placeholderCanvas.height = 480;
  const ctx = placeholderCanvas.getContext('2d');
  ctx.fillStyle = '#0a0c12';
  ctx.fillRect(0, 0, 640, 480);
  ctx.fillStyle = '#2a2d3e';
  ctx.font = 'bold 22px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Camera Offline', 320, 230);
  ctx.font = '16px system-ui';
  ctx.fillText('No snapshot available', 320, 265);

  const snapshotImg = document.getElementById('snapshot-img');
  snapshotImg.onerror = function () {
    this.onerror = null;
    this.src = placeholderCanvas.toDataURL();
  };

  // --- INIT ---
  loadStatus();

})();
