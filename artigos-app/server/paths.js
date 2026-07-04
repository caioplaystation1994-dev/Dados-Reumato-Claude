const path = require('path');

const BASE = process.env.APP_DATA_DIR || path.join(__dirname, '..');

module.exports = {
  DATA_DIR: path.join(BASE, 'data'),
  UPLOAD_DIR: path.join(BASE, 'uploads'),
};
