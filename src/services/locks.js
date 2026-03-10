const fs = require('fs');

function acquireLock(lockPath) {
  const fd = fs.openSync(lockPath, 'wx');
  fs.writeFileSync(fd, String(process.pid));
  return () => {
    try {
      fs.closeSync(fd);
    } catch (e) {
      // noop
    }
    try {
      fs.unlinkSync(lockPath);
    } catch (e) {
      // noop
    }
  };
}

module.exports = { acquireLock };
