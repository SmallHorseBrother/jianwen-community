import type { PACFDimension, PACFItemType } from './pacfItemBank';

export type PACFEvidenceGrade = 'screening' | 'diagnostic' | 'certified';
export type PACFScorerType = 'rule' | 'llm_candidate' | 'human' | 'human_adjudicated';

export type PACFScoredResponse = {
  itemId: string;
  competencyId: string;
  dimension: PACFDimension;
  itemType: PACFItemType;
  normalizedScore: number;
  scorerType: PACFScorerType;
};

export type PACFGate = {
  id: string;
  passed: boolean;
  message: string;
};

export type PACFScoreResult = {
  totalScore: number;
  estimatedLevel: 0 | 1 | 2 | 3 | 4 | 5;
  awardedLevel: 0 | 1 | 2 | 3 | 4 | 5;
  evidenceGrade: PACFEvidenceGrade;
  dimensionScores: Record<PACFDimension, number>;
  competencyScores: Record<string, number>;
  gates: PACFGate[];
  requiresAppliedLab: boolean;
};

const dimensions: PACFDimension[] = ['M', 'F', 'T', 'V', 'C', 'S'];
const fullWeights: Record<'objective' | 'scenario' | 'applied', number> = {
  objective: 0.3,
  scenario: 0.3,
  applied: 0.4,
};

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function levelFromScore(score: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (score < 25) return 0;
  if (score < 40) return 1;
  if (score < 55) return 2;
  if (score < 70) return 3;
  if (score < 85) return 4;
  return 5;
}

function validateResponses(responses: PACFScoredResponse[]) {
  if (!responses.length) throw new Error('PACF responses are empty');
  const ids = new Set<string>();
  for (const response of responses) {
    if (ids.has(response.itemId)) throw new Error(`Duplicate PACF response: ${response.itemId}`);
    ids.add(response.itemId);
    if (!Number.isFinite(response.normalizedScore) || response.normalizedScore < 0 || response.normalizedScore > 100) {
      throw new Error(`Invalid PACF score for ${response.itemId}`);
    }
    if ((response.itemType === 'objective' || response.itemType === 'scenario') && response.scorerType !== 'rule') {
      throw new Error(`Choice item ${response.itemId} must use rule scoring`);
    }
  }
}

function dimensionScore(
  responses: PACFScoredResponse[],
  dimension: PACFDimension,
  evidenceGrade: PACFEvidenceGrade,
): number {
  const selected = responses.filter((response) => response.dimension === dimension);
  if (!selected.length) throw new Error(`PACF dimension ${dimension} has no evidence`);

  if (evidenceGrade === 'screening') return rounded(mean(selected.map((response) => response.normalizedScore)));

  const objectiveScores = selected.filter((response) => response.itemType === 'objective').map((response) => response.normalizedScore);
  const scenarioScores = selected.filter((response) => response.itemType === 'scenario').map((response) => response.normalizedScore);
  const appliedScores = selected
    .filter((response) => response.itemType === 'constructed' || response.itemType === 'practical')
    .map((response) => response.normalizedScore);

  if (!objectiveScores.length || !scenarioScores.length || !appliedScores.length) {
    throw new Error(`Diagnostic dimension ${dimension} lacks objective, scenario or applied evidence`);
  }

  return rounded(
    mean(objectiveScores) * fullWeights.objective
      + mean(scenarioScores) * fullWeights.scenario
      + mean(appliedScores) * fullWeights.applied,
  );
}

export function scorePACF(
  responses: PACFScoredResponse[],
  evidenceGrade: PACFEvidenceGrade,
  options: { organizationalScenarioPassed?: boolean; appliedLabPassed?: boolean } = {},
): PACFScoreResult {
  validateResponses(responses);

  const dimensionScores = Object.fromEntries(
    dimensions.map((dimension) => [dimension, dimensionScore(responses, dimension, evidenceGrade)]),
  ) as Record<PACFDimension, number>;

  const competencyScores = Object.fromEntries(
    [...new Set(responses.map((response) => response.competencyId))].map((competencyId) => [
      competencyId,
      rounded(mean(responses.filter((response) => response.competencyId === competencyId).map((response) => response.normalizedScore))),
    ]),
  );

  const totalScore = rounded(mean(Object.values(dimensionScores)));
  const estimatedLevel = levelFromScore(totalScore);
  let awardedLevel = estimatedLevel;
  const gates: PACFGate[] = [];

  const allAtLeastL1 = dimensions.every((dimension) => dimensionScores[dimension] >= 25);
  gates.push({ id: 'L2-all-dimensions-l1', passed: allAtLeastL1, message: 'L2 要求六维均至少达到 L1。' });
  if (awardedLevel >= 2 && !allAtLeastL1) awardedLevel = 1;

  const verificationForL3 = dimensionScores.V >= 40;
  gates.push({ id: 'L3-verification-l2', passed: verificationForL3, message: 'L3 要求核验、安全与责任至少达到 L2。' });
  if (awardedLevel >= 3 && !verificationForL3) awardedLevel = 2;

  const practicalResponses = responses.filter((response) => response.itemType === 'practical');
  const practicalPassed = practicalResponses.length >= 2 && mean(practicalResponses.map((response) => response.normalizedScore)) >= 60;
  const builderGate = dimensionScores.V >= 55 && dimensionScores.S >= 55 && practicalPassed;
  gates.push({ id: 'L4-system-practical', passed: builderGate, message: 'L4 要求 V、S 至少 L3，并通过两项实作。' });
  if (awardedLevel >= 4 && !builderGate) awardedLevel = 3;

  const transformationGate = dimensionScores.V >= 70
    && dimensionScores.S >= 70
    && options.organizationalScenarioPassed === true
    && options.appliedLabPassed === true
    && evidenceGrade === 'certified';
  gates.push({ id: 'L5-applied-lab', passed: transformationGate, message: 'L5 必须通过组织情境、真实应用实验室和人工认证。' });
  if (awardedLevel >= 5 && !transformationGate) awardedLevel = 4;

  // A short screening estimates placement but cannot award system-builder certification.
  if (evidenceGrade === 'screening' && awardedLevel > 3) awardedLevel = 3;

  return {
    totalScore,
    estimatedLevel,
    awardedLevel,
    evidenceGrade,
    dimensionScores,
    competencyScores,
    gates,
    requiresAppliedLab: estimatedLevel >= 5 && !transformationGate,
  };
}

export function normalizeChoiceScore(score: 0 | 1 | 2 | 3): number {
  return rounded((score / 3) * 100);
}

export function normalizeRubricScore(score: number, maxScore = 4): number {
  if (!Number.isFinite(score) || score < 0 || score > maxScore || maxScore <= 0) {
    throw new Error('Invalid PACF rubric score');
  }
  return rounded((score / maxScore) * 100);
}
