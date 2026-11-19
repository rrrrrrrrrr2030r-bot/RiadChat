export const ROOM_XP_REWARDS = {
  micAscend: 120,
  chatMessage: 150,
  sendGiftBase: 350,
  receiveGift: 250,
  incomingGiftBonus: 300,
  createRoom: 500,
} as const;

export function getXpForNextLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  return 1200 + (safeLevel - 1) * 100;
}

export function getDefaultXpForLevel(level: number): number {
  return Math.floor(getXpForNextLevel(level) * 0.5);
}

export interface XpGainResult {
  level: number;
  xp: number;
  levelsGained: number;
}

export function applyXpGain(level: number, currentXp: number, gain: number): XpGainResult {
  let nextLevel = Math.max(1, Math.floor(level));
  let nextXp = Math.max(0, Math.floor(currentXp)) + Math.max(0, Math.floor(gain));
  let levelsGained = 0;

  while (nextXp >= getXpForNextLevel(nextLevel)) {
    nextXp -= getXpForNextLevel(nextLevel);
    nextLevel += 1;
    levelsGained += 1;
  }

  return {
    level: nextLevel,
    xp: nextXp,
    levelsGained,
  };
}

export interface LevelProgressInfo {
  level: number;
  xp: number;
  requiredXp: number;
  remainingXp: number;
  percent: number;
}

export function getLevelProgress(level: number, xp: number): LevelProgressInfo {
  const safeLevel = Math.max(1, Math.floor(level));
  const requiredXp = getXpForNextLevel(safeLevel);
  const safeXp = Number.isFinite(xp) ? Math.max(0, Math.min(Math.floor(xp), requiredXp)) : 0;
  const remainingXp = Math.max(0, requiredXp - safeXp);
  const percent = Math.min(100, Math.max(0, Math.round((safeXp / requiredXp) * 100)));

  return {
    level: safeLevel,
    xp: safeXp,
    requiredXp,
    remainingXp,
    percent,
  };
}
