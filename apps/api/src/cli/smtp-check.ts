/**
 * Check the SMTP settings of the email digest (learning-hub#49, deploy/README.md):
 *   node dist/cli/smtp-check.js you@example.org      # inside the api container
 * Sends one test email with the same sender the digest uses. Prints only whether it
 * worked and the SMTP error text; never the password.
 */
import '../load-env';
import { loadEnv } from '../infrastructure/config/env';
import { mailSender } from '../integrations/notification-channels.module';

async function main(): Promise<number> {
  const to = process.argv[2];
  if (!to || !to.includes('@')) {
    console.error('Usage: node dist/cli/smtp-check.js <email to send a test to>');
    return 2;
  }
  const env = loadEnv();
  const sender = mailSender(env);
  if (!sender.enabled) {
    console.error('SMTP is off: SMTP_HOST or SMTP_FROM is empty in .env');
    return 1;
  }
  const origin = env.WEB_ORIGIN.replace(/\/+$/, '');
  await sender.send({
    to,
    subject: 'Learning Hub: thử email',
    text: `Email thử từ ${origin}. Nhận được là cấu hình SMTP đã đúng.`,
    html: `<p>Email thử từ ${origin}. Nhận được là cấu hình SMTP đã đúng.</p>`,
    unsubscribeUrl: `${origin}/settings`,
  });
  console.log(`SMTP OK: sent a test email via ${env.SMTP_HOST}:${env.SMTP_PORT}`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error('SMTP FAILED:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  },
);
