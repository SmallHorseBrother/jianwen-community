import { describe, expect, it } from 'vitest';
import { buildFirstAIExamReview, publicExamForm, type ExamItem } from '../../../supabase/functions/_shared/firstAIExam';

describe('First AI Exam answer review', () => {
  const items: ExamItem[] = [
    {
      id: 'choice-1', competencyId: 'M01', dimension: 'M', targetLevel: 1, section: 'basic', kind: 'choice',
      prompt: '选择题', rationale: '选择高分选项。',
      options: [
        { id: 'A', text: '干扰项', score: 0 }, { id: 'B', text: '标准项', score: 3 },
        { id: 'C', text: '部分项', score: 2 }, { id: 'D', text: '干扰项二', score: 1 },
      ],
    },
    {
      id: 'open-1', competencyId: 'M01', dimension: 'M', targetLevel: 2, section: 'open', kind: 'open',
      prompt: '主观题', rationale: '观察解释与迁移。', unscored: true,
    },
  ];

  it('reveals the best answer only in the post-submit review', () => {
    const review = buildFirstAIExamReview(
      items,
      [{ item_id: 'choice-1', value: 'C' }, { item_id: 'open-1', value: '我的解释' }],
      [{ itemId: 'choice-1', rawScore: 2, scored: true }, { itemId: 'open-1', rawScore: null, scored: false }],
    );

    expect(review[0]).toMatchObject({ standard_answer: 'B. 标准项', user_answer: 'C', score: 2, max_score: 3 });
    expect(review[1]).toMatchObject({ standard_answer: null, score: null, max_score: null, rationale: '观察解释与迁移。' });
  });

  it('keeps answers and rationales out of the exam form', () => {
    const form = publicExamForm(items, 'session-id');
    expect(form.items[0]).not.toHaveProperty('standard_answer');
    expect(form.items[0]).not.toHaveProperty('rationale');
    expect(form.items[0].options?.[0]).not.toHaveProperty('score');
  });
});
