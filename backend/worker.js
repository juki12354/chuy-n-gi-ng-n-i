require("dotenv").config();
process.env.PROCESS_ROLE = "worker";
const { validateSecurityConfig } = require("./config/security");
const initDatabase = require("./initDb");
const {
  startTranscriptionWorker,
  stopTranscriptionWorker,
} = require("./services/transcriptionQueue");
const { cleanupExpiredStagingFiles } = require("./services/uploadStorage");

validateSecurityConfig();

async function start() {
  await initDatabase();
  await cleanupExpiredStagingFiles();
  await startTranscriptionWorker();
  console.log("Vbee transcription worker is ready");
}

function shutdown(signal) {
  console.log(`Worker received ${signal}; stopping new jobs.`);
  stopTranscriptionWorker();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch((error) => {
  console.error("Worker failed to start:", error.message);
  process.exit(1);
});

// Queue timers are unref'ed so the API can shut down cleanly. Keep the dedicated
// worker process alive while it waits for PostgreSQL jobs.
setInterval(() => {}, 60 * 60 * 1000);
