import type { ParsedLabels, Repo } from '../../types/index.js';

export function parseLabels(labels: { name: string }[]): ParsedLabels {
  const names = labels.map((l) => l.name.toLowerCase());

  const isRewarded = names.includes('rewarded');

  const difficulty: ParsedLabels['difficulty'] = names.includes('custom')
    ? 'custom'
    : names.includes('high')
    ? 'high'
    : names.includes('medium')
    ? 'medium'
    : names.includes('low')
    ? 'low'
    : null;

  return { isRewarded, difficulty };
}

export function getRewardAmount(
  difficulty: ParsedLabels['difficulty'],
  repoDefaults: Pick<Repo, 'reward_low' | 'reward_medium' | 'reward_high'>,
  customAmount?: number
): number {
  if (difficulty === 'custom' && customAmount != null) {
    return customAmount;
  }

  return difficulty === 'high'
    ? repoDefaults.reward_high
    : difficulty === 'medium'
    ? repoDefaults.reward_medium
    : difficulty === 'low'
    ? repoDefaults.reward_low
    : 0;
}
