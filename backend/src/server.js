import { app } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';
import { ensureAllCurrentYearBills } from './services/billing.js';

let server;
let generatedYear;
let rolloverTimer;

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; closing the API.`);
  if (rolloverTimer) clearInterval(rolloverTimer);
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
  await ensureAllCurrentYearBills();
  generatedYear = new Date().getFullYear();
  server = app.listen(config.port, () => {
    console.log(`Society Management API listening on port ${config.port}`);
  });
  rolloverTimer = setInterval(() => {
    const year = new Date().getFullYear();
    if (year === generatedYear) return;
    ensureAllCurrentYearBills()
      .then(() => {
        generatedYear = year;
        console.log(`Generated maintenance bills for ${year}.`);
      })
      .catch((error) => console.error(`Unable to generate maintenance bills for ${year}.`, error));
  }, 60 * 60 * 1000);
}

start().catch(async (error) => {
  console.error('Unable to start the Society Management API.', error);
  process.exitCode = 1;
  await prisma.$disconnect();
});
