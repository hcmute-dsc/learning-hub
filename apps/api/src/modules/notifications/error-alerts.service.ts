import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ErrorReporter, ServerErrorReport } from '../../common/error-reporter';
import { Clock } from '../../infrastructure/clock';
import { AlertThrottle, errorSignature } from './alert-throttle';
import { pathWithoutQuery, serverErrorMessage } from './messages';
import { ALERT_CHANNEL, type NotificationChannel } from './ports/notification-channel';

/**
 * Sends a throttled alert to the ops channel when the API answers 500 (E11).
 * Only method, path, requestId and the error's name/message go out: no stack,
 * headers, cookies or bodies. The full error is already in the API log (by requestId).
 */
@Injectable()
export class ErrorAlerts implements ErrorReporter {
  private readonly logger = new Logger(ErrorAlerts.name);
  private readonly throttle = new AlertThrottle();

  constructor(
    @Inject(ALERT_CHANNEL) private readonly channel: NotificationChannel,
    private readonly clock: Clock,
  ) {}

  report(report: ServerErrorReport): void {
    if (!this.channel.enabled) return;
    try {
      const path = pathWithoutQuery(report.url);
      const { name, message } = describe(report.error);
      const decision = this.throttle.check(
        errorSignature(report.method, path, name, message),
        this.clock.now().getTime(),
      );
      if (!decision.send) return;
      const content = serverErrorMessage({
        method: report.method,
        path,
        requestId: report.requestId,
        errorName: name,
        errorMessage: message,
        suppressed: decision.suppressed,
      });
      // Not awaited: the member's 500 response must not wait for Discord.
      this.channel.send(content).catch((err) => this.logger.warn({ err }, 'Alert send failed'));
    } catch (err) {
      this.logger.warn({ err }, 'Could not build the server-error alert');
    }
  }
}

function describe(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: typeof error, message: String(error) };
}
