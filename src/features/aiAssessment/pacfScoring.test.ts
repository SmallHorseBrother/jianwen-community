import { describe, expect, it } from 'vitest';
import { PACF_FULL_FORM_A_IDS, PACF_QUICK_FORM_A_IDS, getPACFItemsByIds } from './pacfItemBank';
import { normalizeChoiceScore, normalizeRubricScore, scorePACF, type PACFScoredResponse } from './pacfScoring';

function responses(ids: string[], score: number): PACFScoredResponse[] {
  return getPACFItemsByIds(ids).map((item) => ({
    itemId: item.id,
    competencyId: item.competencyId,
    dimension: item.dimension,
    itemType: item.type,
    normalizedScore: score,
    scorerType: item.type === 'objective' || item.type === 'scenario' ? 'rule' : 'human',
  }));
}

describe('PACF scoring', () => {
  it('normalizes choice and rubric scores', () => {
    expect(normalizeChoiceScore(3)).toBe(100);
    expect(normalizeChoiceScore(2)).toBe(66.67);
    expect(normalizeRubricScore(3)).toBe(75);
  });

  it('caps a screening result at awarded L3', () => {
    const result = scorePACF(responses(PACF_QUICK_FORM_A_IDS, 100), 'screening');
    expect(result.estimatedLevel).toBe(5);
    expect(result.awardedLevel).toBe(3);
  });

  it('awards L4 for a strong diagnostic but requires an applied lab for L5', () => {
    const result = scorePACF(responses(PACF_FULL_FORM_A_IDS, 100), 'diagnostic', { organizationalScenarioPassed: true });
    expect(result.estimatedLevel).toBe(5);
    expect(result.awardedLevel).toBe(4);
    expect(result.requiresAppliedLab).toBe(true);
  });

  it('applies the verification gate', () => {
    const scored = responses(PACF_FULL_FORM_A_IDS, 70).map((response) =>
      response.dimension === 'V' ? { ...response, normalizedScore: 30 } : response,
    );
    const result = scorePACF(scored, 'diagnostic');
    expect(result.estimatedLevel).toBeGreaterThanOrEqual(2);
    expect(result.awardedLevel).toBe(2);
    expect(result.gates.find((gate) => gate.id === 'L3-verification-l2')?.passed).toBe(false);
  });

  it('can award L5 only with certified applied evidence', () => {
    const result = scorePACF(responses(PACF_FULL_FORM_A_IDS, 100), 'certified', {
      organizationalScenarioPassed: true,
      appliedLabPassed: true,
    });
    expect(result.awardedLevel).toBe(5);
  });
});
