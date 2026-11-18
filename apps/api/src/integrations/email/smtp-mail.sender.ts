import { createTransport, type Transporter } from 'nodemailer';
import type { MailMessage, MailSender } from '../../modules/notifications/ports/mail-sender';

export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

/**
 * Sends the email digest over SMTP (learning-hub#49). Port 465 uses TLS from the start;
 * any other port must upgrade with STARTTLS (`requireTLS`), so a password is never sent
 * in clear text. Errors are thrown on purpose: the outbox worker retries them.
 */
export class SmtpMailSender implements MailSender {
  readonly enabled = true;
  private readonly transport: Transporter;

  constructor(private readonly settings: SmtpSettings) {
    const secure = settings.port === 465;
    this.transport = createTransport({
      host: settings.host,
      port: settings.port,
      secure,
      requireTLS: !secure,
      auth: settings.user ? { user: settings.user, pass: settings.password } : undefined,
      connectionTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.settings.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      list: { unsubscribe: message.unsubscribeUrl },
    });
  }
}
