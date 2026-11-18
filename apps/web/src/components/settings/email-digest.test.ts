import { describe, expect, it } from 'vitest';
import { digestHint } from './email-digest';

describe('digestHint', () => {
  const ready = { emailDigest: false, emailAvailable: true, hasEmail: true };

  it('explains the digest when it can be used', () => {
    expect(digestHint(ready)).toContain('8 giờ sáng');
  });

  it('says why it cannot be turned on', () => {
    expect(digestHint({ ...ready, emailAvailable: false })).toContain('chưa được cấu hình');
    expect(digestHint({ ...ready, hasEmail: false })).toContain('chưa có email');
  });
});
