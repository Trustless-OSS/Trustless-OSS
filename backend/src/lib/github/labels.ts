import type { ParsedLabels, Repo } from '../../types/index.js';

export function parseLabels(labels: { name: string }[]): ParsedLabels {
  const names = labels.map((l) => l.name.toLowerCase());

  const isRewarded = names.includes('rewarded');

  const difficulty: ParsedLabels['difficulty'] = names.includes('high')
    ? 'high'
    : names.includes('medium')
    ? 'medium'
    : names.includes('low')
    ? 'low'
    : null;

  // Parse bonus:50 label format
  const bonusLabel = names.find((n) => n.startsWith('bonus:'));
  const bonusAmount = bonusLabel ? parseFloat(bonusLabel.split(':')[1] ?? '0') || 0 : 0;

  return { isRewarded, difficulty, bonusAmount };
}

export function getRewardAmount(
  difficulty: ParsedLabels['difficulty'],
  bonusAmount: number,
  repoDefaults: Pick<Repo, 'reward_low' | 'reward_medium' | 'reward_high'>
): number {
  const base =
    difficulty === 'high'
      ? repoDefaults.reward_high
      : difficulty === 'medium'
      ? repoDefaults.reward_medium
      : difficulty === 'low'
      ? repoDefaults.reward_low
      : 0;

  return base + bonusAmount;
}
