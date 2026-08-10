import { describe, expect, it } from 'vitest';
import {
  PACF_COMPETENCY_IDS,
  PACF_FULL_FORM_A_IDS,
  PACF_QUICK_FORM_A_IDS,
  getPACFItemsByIds,
  pacfCandidateItemBank,
} from './pacfItemBank';

describe('PACF candidate item bank', () => {
  it('contains exactly 120 unique candidate items', () => {
    expect(pacfCandidateItemBank).toHaveLength(120);
    expect(new Set(pacfCandidateItemBank.map((item) => item.id)).size).toBe(120);
  });

  it('contains one item of every evidence type for all 30 competencies', () => {
    for (const competencyId of PACF_COMPETENCY_IDS) {
      const items = pacfCandidateItemBank.filter((item) => item.competencyId === competencyId);
      expect(items).toHaveLength(4);
      expect(new Set(items.map((item) => item.type))).toEqual(
        new Set(['objective', 'scenario', 'constructed', 'practical']),
      );
    }
  });

  it('keeps choice keys and rubrics structurally valid', () => {
    for (const item of pacfCandidateItemBank) {
      if (item.type === 'objective' || item.type === 'scenario') {
        expect(item.options).toHaveLength(4);
        expect(item.rubric).toBeUndefined();
        expect(item.quickEligible).toBe(true);
        expect(Math.max(...item.options!.map((option) => option.score))).toBe(3);
      } else {
        expect(item.options).toBeUndefined();
        expect(item.rubric).toHaveLength(4);
        expect(item.rubric!.reduce((sum, criterion) => sum + criterion.maxPoints, 0)).toBe(4);
        expect(item.quickEligible).toBe(false);
      }
    }
  });

  it('defines a balanced 30-item quick form', () => {
    const items = getPACFItemsByIds(PACF_QUICK_FORM_A_IDS);
    expect(items).toHaveLength(30);
    expect(new Set(items.map((item) => item.competencyId)).size).toBe(30);
    for (const dimension of ['M', 'F', 'T', 'V', 'C', 'S']) {
      expect(items.filter((item) => item.dimension === dimension)).toHaveLength(5);
    }
  });

  it('defines a 44-interaction full diagnostic with two practical tasks', () => {
    const items = getPACFItemsByIds(PACF_FULL_FORM_A_IDS);
    expect(items).toHaveLength(44);
    expect(items.filter((item) => item.type === 'practical')).toHaveLength(2);
    expect(items.filter((item) => item.type === 'constructed')).toHaveLength(12);
  });
});
