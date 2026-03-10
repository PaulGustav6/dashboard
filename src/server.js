require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const { ensureDirs, PATHS } = require('./services/storage');
const apiRouter = require('./routes/api');

ensureDirs();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.use('/api', apiRouter);

app.use('/media/latest.jpg', (req, res) => {
  if (fs.existsSync(PATHS.latestJpg)) {
    res.sendFile(path.resolve(PATHS.latestJpg));
  } else {
    res.redirect('/placeholder.jpg');
  }
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
