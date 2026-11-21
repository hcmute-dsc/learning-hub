import { DISCORD_LINK_RESULTS, type DiscordLinkResult } from '@hub/shared';

/** Pure helpers for the Discord section of /settings (tested in discord-link.test.ts). */

/** `?discord=` after the round trip to Discord; anything else is ignored. */
export function parseDiscordResult(value: string | string[] | undefined): DiscordLinkResult | null {
  const v = Array.isArray(value) ? value[0] : value;
  return (DISCORD_LINK_RESULTS as readonly string[]).includes(v ?? '')
    ? (v as DiscordLinkResult)
    : null;
}

/** One line telling the member how the last attempt went. */
export function discordResultMessage(result: DiscordLinkResult): {
  tone: 'ok' | 'error';
  text: string;
} {
  switch (result) {
    case 'linked':
      return { tone: 'ok', text: 'Đã kết nối Discord.' };
    case 'taken':
      return {
        tone: 'error',
        text: 'Tài khoản Discord này đã được một thành viên khác kết nối.',
      };
    case 'error':
      return { tone: 'error', text: 'Chưa kết nối được Discord. Thử lại nhé.' };
  }
}
