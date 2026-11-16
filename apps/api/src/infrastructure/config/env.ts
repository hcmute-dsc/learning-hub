import { z } from 'zod';

const csv = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  GITHUB_ORG: z.string().default('hcmute-dsc'),
  ALLOWLIST_GITHUB_LOGINS: csv,
  BOOTSTRAP_ADMIN_GITHUB_LOGIN: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim().toLowerCase() : undefined)),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  // Content source (CONTENT-SPECIFICATION §8): a local folder for dev, or a GitHub repo
  CONTENT_SOURCE: z.enum(['local', 'github']).default('local'),
  CONTENT_LOCAL_DIR: z.string().default('../../content-example'),
  CONTENT_REPO: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .default('hcmute-dsc/learning-hub-content'),
  CONTENT_BRANCH: z.string().default('main'),
  /** Optional: raises GitHub rate limits / reads a private repo. Read-only scope. */
  CONTENT_GITHUB_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Parse once at startup; fail fast with a readable message. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return parsed.data;
}

export const ENV = Symbol('ENV');
