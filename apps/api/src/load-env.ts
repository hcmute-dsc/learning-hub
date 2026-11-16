// Load apps/api/.env for local runs (Node >= 21.7 built-in, no dotenv dependency).
// Real environment variables win; a missing file is fine (CI, containers).
try {
  process.loadEnvFile();
} catch {
  /* no .env file */
}
