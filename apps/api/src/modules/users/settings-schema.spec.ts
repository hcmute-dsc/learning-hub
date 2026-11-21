import { settingsUpdateSchema } from '@hub/shared';

/** PUT /me/settings body (profile.ts): partial, but never empty. */
describe('settingsUpdateSchema', () => {
  it('accepts the theme alone, the achievements switch alone, or both', () => {
    expect(settingsUpdateSchema.parse({ theme: 'dark' })).toEqual({ theme: 'dark' });
    expect(settingsUpdateSchema.parse({ showAchievements: false })).toEqual({
      showAchievements: false,
    });
    expect(settingsUpdateSchema.safeParse({ theme: 'light', showAchievements: true }).success).toBe(
      true,
    );
  });

  it('accepts the leaderboard opt-in alone (E14)', () => {
    expect(settingsUpdateSchema.parse({ leaderboardOptIn: true })).toEqual({
      leaderboardOptIn: true,
    });
    expect(settingsUpdateSchema.safeParse({ leaderboardOptIn: 'yes' }).success).toBe(false);
  });

  it('rejects an empty body, unknown fields and wrong types', () => {
    expect(settingsUpdateSchema.safeParse({}).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ leaderboard: true }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ showAchievements: 'no' }).success).toBe(false);
  });
});
