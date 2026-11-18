import { BADGES } from '@hub/shared';
import { badgesToAward, earnedBadges, type LearningFacts } from './badges';

const none: LearningFacts = {
  lessonsCompleted: 0,
  exercisesCompleted: 0,
  modulesCompleted: 0,
  tracksCompleted: 0,
  longestStreak: 0,
};

describe('earnedBadges', () => {
  it('gives nothing to a member who has not learned yet', () => {
    expect(earnedBadges(none)).toEqual([]);
  });

  it('awards each first-time badge from its own fact', () => {
    expect(earnedBadges({ ...none, lessonsCompleted: 1 })).toEqual(['first_lesson']);
    expect(earnedBadges({ ...none, exercisesCompleted: 1 })).toEqual(['first_exercise']);
    expect(earnedBadges({ ...none, modulesCompleted: 1 })).toEqual(['first_module']);
    expect(earnedBadges({ ...none, tracksCompleted: 1 })).toEqual(['first_track']);
  });

  it('needs exactly the threshold for count badges', () => {
    expect(earnedBadges({ ...none, exercisesCompleted: 9 })).not.toContain('exercises_10');
    expect(earnedBadges({ ...none, exercisesCompleted: 10 })).toContain('exercises_10');
    expect(earnedBadges({ ...none, longestStreak: 6 })).not.toContain('streak_7');
    expect(earnedBadges({ ...none, longestStreak: 7 })).toContain('streak_7');
  });

  it('lists badges in the order of BADGES', () => {
    const all = earnedBadges({
      lessonsCompleted: 5,
      exercisesCompleted: 12,
      modulesCompleted: 2,
      tracksCompleted: 1,
      longestStreak: 9,
    });
    expect(all).toEqual(BADGES.map((b) => b.code));
  });
});

describe('badgesToAward', () => {
  const facts = { ...none, lessonsCompleted: 3, exercisesCompleted: 1 };

  it('returns only badges the member does not have yet', () => {
    expect(badgesToAward(facts, [])).toEqual(['first_lesson', 'first_exercise']);
    expect(badgesToAward(facts, ['first_lesson'])).toEqual(['first_exercise']);
  });

  it('is empty when everything is stored, so awarding twice changes nothing', () => {
    expect(badgesToAward(facts, ['first_lesson', 'first_exercise'])).toEqual([]);
  });

  it('never takes a stored badge back when the facts shrink', () => {
    // e.g. a lesson was reopened: the badge stays, nothing new is awarded
    expect(badgesToAward(none, ['first_lesson'])).toEqual([]);
  });
});
