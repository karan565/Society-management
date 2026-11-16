import { app } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';

let server;

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; closing the API.`);
  if (!server) {
    await prisma.$disconnect();
    return;
  }
  server.close(async (error) => {
    if (error) {
      console.error('HTTP server shutdown failed.', error);
      process.exitCode = 1;
    }
    await prisma.$disconnect();
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

async function start() {
  await prisma.$connect();
  server = app.listen(config.port, () => {
    console.log(`Society Management API listening on port ${config.port}`);
  });
}

start().catch(async (error) => {
  console.error('Unable to start the Society Management API.', error);
  process.exitCode = 1;
  await prisma.$disconnect();
});
