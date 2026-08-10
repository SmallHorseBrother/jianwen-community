import { describe, expect, it } from 'vitest';
import {
  usageStyleBetaItemIds,
  usageStyleCandidateItems,
  usageStyleExperimentalItems,
} from './aiStyleItemBank';
import {
  AI_STYLE_PROFILES,
  publicAIStyleForm,
  scoreAIStyle,
} from '../../../supabase/functions/_shared/aiUsageStyle';

describe('AI usage style candidate bank', () => {
  it('contains 56 balanced candidates and a 24-item scored short form', () => {
    expect(usageStyleCandidateItems).toHaveLength(56);
    expect(new Set(usageStyleCandidateItems.map((item) => item.id)).size).toBe(56);
    for (const axis of ['explore', 'create', 'reason', 'partner'] as const) {
      const candidates = usageStyleCandidateItems.filter((item) => item.axis === axis);
      expect(candidates).toHaveLength(14);
      expect(candidates.filter((item) => item.pole === 'first')).toHaveLength(7);
      expect(candidates.filter((item) => item.pole === 'second')).toHaveLength(7);
      expect(candidates.filter((item) => item.selectedForBeta)).toHaveLength(6);
    }
    expect(usageStyleBetaItemIds).toHaveLength(24);
    expect(usageStyleExperimentalItems).toHaveLength(4);
  });

  it('publishes 28 questions without reverse-scoring keys', () => {
    const form = publicAIStyleForm();
    expect(form.items).toHaveLength(28);
    expect(form.items.filter((item) => item.kind === 'likert')).toHaveLength(24);
    expect(form.items.filter((item) => item.kind === 'forced_choice')).toHaveLength(4);
    expect(JSON.stringify(form)).not.toContain('"pole"');
    expect(JSON.stringify(form)).not.toContain('centeredScore');
  });

  it('scores continuous axes deterministically and recognizes all 16 codes', () => {
    expect(Object.keys(AI_STYLE_PROFILES)).toHaveLength(16);
    const form = publicAIStyleForm();
    const responses = form.items.map((item) => ({
      item_id: item.id,
      value: item.kind === 'likert' ? 7 : 'first',
    }));
    const result = scoreAIStyle(responses);
    expect(result.axes.explore).toBe(50);
    expect(result.axes.create).toBe(50);
    expect(result.axes.reason).toBe(50);
    expect(result.axes.partner).toBe(50);
    expect(result.axisConfidence.explore).toBe('balanced');
    expect(result.code).toBe('ECRP');
  });

  it('uses reverse coding and rejects invalid responses', () => {
    const form = publicAIStyleForm();
    const responses = form.items.map((item) => ({
      item_id: item.id,
      value: item.kind === 'likert'
        ? (Number(item.id.slice(-2)) % 2 === 1 ? 7 : 1)
        : 'first',
    }));
    const result = scoreAIStyle(responses);
    expect(result.axes).toEqual({ explore: 100, create: 100, reason: 100, partner: 100 });
    expect(result.code).toBe('ECRP');
    expect(() => scoreAIStyle(responses.slice(1))).toThrow(/28/);
    expect(() => scoreAIStyle(responses.map((response, index) => index === 0
      ? { ...response, value: 9 }
      : response))).toThrow(/无效/);
  });
});
