import { describe, expect, it } from 'vitest';
import { discordResultMessage, parseDiscordResult } from './discord-link';

describe('Discord link result on /settings', () => {
  it('reads only the known results from ?discord=', () => {
    expect(parseDiscordResult('linked')).toBe('linked');
    expect(parseDiscordResult(['taken', 'x'])).toBe('taken');
    expect(parseDiscordResult('<script>')).toBeNull();
    expect(parseDiscordResult(undefined)).toBeNull();
  });

  it('says what happened', () => {
    expect(discordResultMessage('linked').tone).toBe('ok');
    expect(discordResultMessage('taken').text).toContain('thành viên khác');
    expect(discordResultMessage('error').tone).toBe('error');
  });
});
