import { ScoreEntry, KillerEntry, Difficulty, GameMode } from '../types';

const SCORES_KEY = 'lemris_scores_v1';
const KILLERS_KEY = 'lemris_killers_v1';

export const getTopScores = (difficulty: Difficulty, mode: GameMode): ScoreEntry[] => {
  try {
    const data = localStorage.getItem(SCORES_KEY);
    const allScores: ScoreEntry[] = data ? JSON.parse(data) : [];
    return allScores
      .filter(s => s.difficulty === difficulty && (s.mode === mode || (!s.mode && mode === GameMode.SAVE))) // Backwards compatibility for SAVE
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  } catch (e) {
    return [];
  }
};

export const saveScore = (entry: ScoreEntry) => {
  try {
    const data = localStorage.getItem(SCORES_KEY);
    const allScores: ScoreEntry[] = data ? JSON.parse(data) : [];
    allScores.push(entry);
    localStorage.setItem(SCORES_KEY, JSON.stringify(allScores));
  } catch (e) {
    console.error("Failed to save score", e);
  }
};

export const getTopKillers = (difficulty: Difficulty, mode: GameMode): KillerEntry[] => {
  try {
    const data = localStorage.getItem(KILLERS_KEY);
    const allKillers: KillerEntry[] = data ? JSON.parse(data) : [];
    return allKillers
      .filter(k => k.difficulty === difficulty && (k.mode === mode || (!k.mode && mode === GameMode.SAVE)))
      .sort((a, b) => b.kills - a.kills)
      .slice(0, 10);
  } catch (e) {
    return [];
  }
};

export const saveKiller = (entry: KillerEntry) => {
  try {
    const data = localStorage.getItem(KILLERS_KEY);
    const allKillers: KillerEntry[] = data ? JSON.parse(data) : [];
    allKillers.push(entry);
    localStorage.setItem(KILLERS_KEY, JSON.stringify(allKillers));
  } catch (e) {
    console.error("Failed to save killer", e);
  }
};