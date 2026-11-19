import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  /** Optional extra rule: members of this GitHub org are approved too. Empty = off. */
  GITHUB_ORG: z.string().default(''),
  BOOTSTRAP_ADMIN_GITHUB_LOGIN: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim().toLowerCase() : undefined)),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /**
   * Proxy hops in front of the API (Express "trust proxy"), so req.ip is the member's
   * IP for the per-IP rate limit. 1 = the web app's /api rewrite and server-side calls.
   * Production behind Cloudflare + Traefik: 2 (deploy/.env.example).
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  // Content source (CONTENT-SPECIFICATION §8): a local folder for dev, or a GitHub repo
  /** local = a folder (dev), github = one content repo, registry = tracks.yaml + one repo per track (ADR-10) */
  CONTENT_SOURCE: z.enum(['local', 'github', 'registry']).default('local'),
  CONTENT_LOCAL_DIR: z.string().default('../../content-example'),
  CONTENT_REPO: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .default('hcmute-dsc/learning-hub-content'),
  CONTENT_BRANCH: z.string().default('main'),
  /** Optional: raises GitHub rate limits / reads a private repo. Read-only scope. */
  CONTENT_GITHUB_TOKEN: z.string().optional(),
  // Reference solutions (CONTENT-SPECIFICATION §3.8): the PRIVATE checker repo, never the content repo
  /** none = no solutions, local = a folder (dev, checker-example), github = the checker repo */
  SOLUTIONS_SOURCE: z.enum(['none', 'local', 'github']).default('none'),
  SOLUTIONS_LOCAL_DIR: z.string().default('../../checker-example'),
  SOLUTIONS_REPO: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .default('hcmute-dsc/learning-hub-checker'),
  SOLUTIONS_BRANCH: z.string().default('main'),
  /** Read-only token that can read the private checker repo. Falls back to CONTENT_GITHUB_TOKEN. */
  SOLUTIONS_GITHUB_TOKEN: z.string().optional(),
  /** Target time for a mentor review, shown in the queue (E7; per semester, BACKEND-DESIGN). */
  REVIEW_TARGET_HOURS: z.coerce.number().int().min(1).max(720).default(72),
  /** Discord channel webhook for club notifications (E9). Empty = notifications off. */
  DISCORD_WEBHOOK_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  /** Discord webhook for ops alerts: server errors (E11). Empty = alerts off. */
  DISCORD_ALERT_WEBHOOK_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
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
