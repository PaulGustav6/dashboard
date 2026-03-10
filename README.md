# GrowCam Dashboard

A lightweight, production-ready dashboard for an ESP32-CAM (OV2640) running on a Raspberry Pi.

## Features

- Live snapshot viewer with on-demand live stream
- Live stream proxy endpoint (`/stream`) for remote access via the Pi
- Background capture scheduling
- Timelapse rendering (daily + rolling 7d/30d)
- Configurable settings (persisted to `data/config.json`)
- Watering control stubs (coming soon)

## Quick Start

```bash
cp .env.example .env
npm install
npm start
```

Dashboard available at `http://localhost:5000`

## Pi Prerequisites

```bash
sudo apt update
sudo apt install -y ffmpeg
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATA_DIR` | `./data` | Storage directory |
| `PORT` | `5000` | HTTP port |
| `CAMERA_BASE_URL` | `http://192.168.2.120` | Camera base URL |
| `CAMERA_STREAM_URL` | `http://192.168.2.120:81/stream` | MJPEG stream URL |
| `CAPTURE_INTERVAL_MIN` | `10` | Minutes between captures |
| `LIGHTS_ON` | `06:00` | Lights-on time |
| `LIGHTS_OFF` | `24:00` | Lights-off time |
| `TIMELAPSE_FPS` | `30` | Timelapse output FPS |
| `RETENTION_DAYS` | `30` | Days to retain frames and videos |

## Background Scripts

```bash
node scripts/capture.js
node scripts/render-daily.js
node scripts/render-rolling.js
node scripts/prune.js
```

## systemd Units (Pi)

### `/etc/systemd/system/growcam-web.service`

```ini
[Unit]
Description=GrowCam Dashboard (Web)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/growcam-dashboard
EnvironmentFile=/home/pi/growcam-dashboard/.env
ExecStart=/usr/bin/node /home/pi/growcam-dashboard/src/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

### `/etc/systemd/system/growcam-capture.service`

```ini
[Unit]
Description=GrowCam Capture Job

[Service]
Type=oneshot
User=pi
WorkingDirectory=/home/pi/growcam-dashboard
EnvironmentFile=/home/pi/growcam-dashboard/.env
ExecStart=/usr/bin/node /home/pi/growcam-dashboard/scripts/capture.js
```

### `/etc/systemd/system/growcam-capture.timer`

```ini
[Unit]
Description=GrowCam Capture Timer

[Timer]
OnBootSec=1min
OnUnitActiveSec=1min
AccuracySec=10s

[Install]
WantedBy=timers.target
```

> Note: the timer runs every minute, and `capture_interval_min` in `data/config.json` decides whether a run captures or skips.

### `/etc/systemd/system/growcam-render-daily.service`

```ini
[Unit]
Description=GrowCam Daily Timelapse Render

[Service]
Type=oneshot
User=pi
WorkingDirectory=/home/pi/growcam-dashboard
EnvironmentFile=/home/pi/growcam-dashboard/.env
ExecStart=/usr/bin/node /home/pi/growcam-dashboard/scripts/render-daily.js
TimeoutStartSec=20min
```

### `/etc/systemd/system/growcam-render-daily.timer`

```ini
[Unit]
Description=GrowCam Daily Render Timer

[Timer]
OnCalendar=*-*-* 00:10:00
Persistent=true
AccuracySec=1min

[Install]
WantedBy=timers.target
```

### `/etc/systemd/system/growcam-render-rolling.service`

```ini
[Unit]
Description=GrowCam Rolling Timelapse Render

[Service]
Type=oneshot
User=pi
WorkingDirectory=/home/pi/growcam-dashboard
EnvironmentFile=/home/pi/growcam-dashboard/.env
ExecStart=/usr/bin/node /home/pi/growcam-dashboard/scripts/render-rolling.js
TimeoutStartSec=20min
```

### `/etc/systemd/system/growcam-render-rolling.timer`

```ini
[Unit]
Description=GrowCam Rolling Render Timer

[Timer]
OnCalendar=*-*-* 00:20:00
Persistent=true

[Install]
WantedBy=timers.target
```

### `/etc/systemd/system/growcam-prune.service`

```ini
[Unit]
Description=GrowCam Prune Job

[Service]
Type=oneshot
User=pi
WorkingDirectory=/home/pi/growcam-dashboard
EnvironmentFile=/home/pi/growcam-dashboard/.env
ExecStart=/usr/bin/node /home/pi/growcam-dashboard/scripts/prune.js
```

### `/etc/systemd/system/growcam-prune.timer`

```ini
[Unit]
Description=GrowCam Prune Timer

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true

[Install]
WantedBy=timers.target
```

### Enable services/timers

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now growcam-web.service
sudo systemctl enable --now growcam-capture.timer growcam-render-daily.timer growcam-render-rolling.timer growcam-prune.timer
```

## NGINX Reverse Proxy (Optional)

```nginx
server {
    listen 80;
    server_name growcam.local;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /stream {
        proxy_pass http://127.0.0.1:5000/stream;
        proxy_buffering off;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```
