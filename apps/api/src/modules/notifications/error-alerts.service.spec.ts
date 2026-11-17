import type { Clock } from '../../infrastructure/clock';
import { ErrorAlerts } from './error-alerts.service';
import type { NotificationChannel } from './ports/notification-channel';

function setup(enabled = true) {
  const channel = {
    enabled,
    send: jest.fn(async (_content: string) => {}),
  } satisfies NotificationChannel;
  const clock = { now: () => new Date(0) } as Clock;
  return { alerts: new ErrorAlerts(channel, clock), channel };
}

describe('ErrorAlerts', () => {
  it('sends method, path without query, requestId and the error message only', () => {
    const { alerts, channel } = setup();
    const error = new Error('db down');
    alerts.report({ method: 'GET', url: '/api/v1/me?token=abc', requestId: 'r-1', error });
    const content = channel.send.mock.calls[0][0];
    expect(content).toContain('GET /api/v1/me');
    expect(content).toContain('r-1');
    expect(content).toContain('Error: db down');
    expect(content).not.toContain('token=abc');
    expect(content).not.toContain('at '); // no stack frames
  });

  it('sends one alert for a burst of the same error', () => {
    const { alerts, channel } = setup();
    for (let i = 0; i < 5; i++) {
      alerts.report({ method: 'GET', url: '/a', error: new Error('boom') });
    }
    expect(channel.send).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the alert channel is off', () => {
    const { alerts, channel } = setup(false);
    alerts.report({ method: 'GET', url: '/a', error: new Error('boom') });
    expect(channel.send).not.toHaveBeenCalled();
  });
});
