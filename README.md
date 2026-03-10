# GrowCam Dashboard

A lightweight, production-ready dashboard for an ESP32-CAM (OV2640) running on a Raspberry Pi.

## Features

- Live snapshot viewer with on-demand live stream
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
Description=GrowCam Dashboard
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/growcam
ExecStart=/usr/bin/node src/server.js
Restart=always
EnvironmentFile=/home/pi/growcam/.env

[Install]
WantedBy=multi-user.target
```

### `/etc/systemd/system/growcam-capture.timer`

```ini
[Unit]
Description=GrowCam Capture Timer

[Timer]
OnBootSec=1min
OnUnitActiveSec=10min
AccuracySec=30s

[Install]
WantedBy=timers.target
```

### `/etc/systemd/system/growcam-daily.timer`

```ini
[Unit]
Description=GrowCam Daily Timelapse Timer

[Timer]
OnCalendar=*-*-* 00:10:00
Persistent=true

[Install]
WantedBy=timers.target
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

    location /media/timelapse/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_buffering off;
    }
}
```
