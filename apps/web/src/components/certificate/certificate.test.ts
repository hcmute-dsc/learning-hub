import { describe, expect, it } from 'vitest';
import {
  certificatePath,
  contentCommitUrl,
  contentLabel,
  isCertificateCode,
  shareUrl,
} from './certificate';

const SHA = 'a'.repeat(40);

describe('certificate helpers', () => {
  it('builds the public path and the share URL', () => {
    expect(certificatePath('abcdefghijklmnopqrstuvwx')).toBe(
      '/certificates/abcdefghijklmnopqrstuvwx',
    );
    expect(shareUrl('https://learn.example.org/', 'abcdefghijklmnopqrstuvwx')).toBe(
      'https://learn.example.org/certificates/abcdefghijklmnopqrstuvwx',
    );
  });

  it('accepts only the 24-character base32 code', () => {
    expect(isCertificateCode('abcdefghijklmnopqrstuvwx')).toBe(true);
    expect(isCertificateCode('ABCDEFGHIJKLMNOPQRSTUVWX')).toBe(false);
    expect(isCertificateCode('short')).toBe(false);
  });

  it('links the content commit on GitHub, and nothing for other sources', () => {
    expect(contentCommitUrl({ repo: 'hcmute-dsc/track-sql', commitSha: SHA })).toBe(
      `https://github.com/hcmute-dsc/track-sql/commit/${SHA}`,
    );
    expect(contentCommitUrl({ repo: 'local:/content', commitSha: SHA })).toBeNull();
    expect(contentCommitUrl({ repo: 'a/b', commitSha: 'not-a-sha' })).toBeNull();
  });

  it('labels the content as repo@short-sha, without a local folder path', () => {
    expect(contentLabel({ repo: 'hcmute-dsc/track-sql', commitSha: SHA })).toBe(
      'hcmute-dsc/track-sql@aaaaaaa',
    );
    expect(contentLabel({ repo: 'local:D:/repos/content', commitSha: SHA })).toBe('local@aaaaaaa');
  });
});
