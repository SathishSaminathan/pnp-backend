const { createApp } = require('./app');
const config = require('./config');
const { readDb } = require('./store/db');

readDb();

const app = createApp();
app.listen(config.port, '0.0.0.0', () => {
  console.log(`PNP API listening on http://localhost:${config.port}`);
  console.log(`Health check: http://localhost:${config.port}/health`);
});
