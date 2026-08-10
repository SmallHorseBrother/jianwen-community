import { describe, expect, it } from 'vitest';
import { getCapabilityQuestions, personalityQuestions } from './catalog';
import { scoreCapability, scorePersonality } from './scoring';

describe('AI assessment scoring', () => {
  it('presents 30 capability questions for either audience track', () => {
    expect(getCapabilityQuestions('daily')).toHaveLength(30);
    expect(getCapabilityQuestions('work')).toHaveLength(30);
  });

  it('scores capability from observer to transformer', () => {
    expect(scoreCapability('daily', Array(30).fill(0)).level).toBe(0);
    const maximum = scoreCapability('work', Array(30).fill(3));
    expect(maximum.level).toBe(5);
    expect(maximum.total).toBe(90);
    expect(maximum.routeLevel).toBe('practice');
  });

  it('uses dimension gates for high capability levels', () => {
    const answers = getCapabilityQuestions('daily').map((question) => question.dimension === 'systems' ? 0 : 3);
    expect(scoreCapability('daily', answers).level).toBeLessThanOrEqual(3);
  });

  it('contains 28 personality questions and produces a valid four-axis code', () => {
    expect(personalityQuestions).toHaveLength(28);
    expect(scorePersonality(Array(28).fill(-2)).code).toBe('ECTH');
    expect(scorePersonality(Array(28).fill(2)).code).toBe('DOAS');
  });
});
