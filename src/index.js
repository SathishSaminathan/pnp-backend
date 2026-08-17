const { createApp } = require('./app');
const config = require('./config');
const { initStore } = require('./store/db');

const start = async () => {
  await initStore();
  const app = createApp();
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`PNP API listening on http://localhost:${config.port}`);
    console.log(`Health check: http://localhost:${config.port}/health`);
  });
};

start().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
