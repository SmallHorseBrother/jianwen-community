import { describe, expect, it } from 'vitest';
import {
  PACF_QUICK_ITEMS,
  publicPACFQuickForm,
  scorePACFQuick,
} from '../../../supabase/functions/_shared/pacfQuick';

describe('PACF Edge quick form', () => {
  it('publishes 42 sanitized items across all six dimensions', () => {
    const form = publicPACFQuickForm();
    expect(form.items).toHaveLength(42);
    expect(new Set(form.items.map((item) => item.id)).size).toBe(42);
    expect(Object.fromEntries(['M', 'F', 'T', 'V', 'C', 'S'].map((dimension) => [
      dimension,
      form.items.filter((item) => item.dimension === dimension).length,
    ]))).toEqual({ M: 7, F: 7, T: 7, V: 7, C: 7, S: 7 });
    expect(JSON.stringify(form)).not.toContain('"score"');
  });

  it('scores the complete response set on the server', () => {
    const responses = PACF_QUICK_ITEMS.map((item) => ({
      item_id: item.id,
      option_id: item.options.find((option) => option.score === 3)?.id || '',
    }));
    const result = scorePACFQuick(responses);
    expect(result.totalScore).toBe(100);
    expect(result.level).toBe(5);
    expect(result.gates.screening_only).toBe(true);
    expect(result.itemScores).toHaveLength(42);
  });

  it('rejects missing, duplicate and invalid answers', () => {
    const responses = PACF_QUICK_ITEMS.map((item) => ({
      item_id: item.id,
      option_id: item.options[0].id,
    }));
    expect(() => scorePACFQuick(responses.slice(1))).toThrow(/42/);
    expect(() => scorePACFQuick(responses.map((response, index) => index === 1
      ? { ...response, item_id: responses[0].item_id }
      : response))).toThrow(/重复/);
    expect(() => scorePACFQuick(responses.map((response, index) => index === 0
      ? { ...response, option_id: 'Z' }
      : response))).toThrow(/无效答案/);
  });
});
