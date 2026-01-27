import { ScoreEntry, KillerEntry, Difficulty, GameMode, GameSettings } from '../types';

const SCORES_KEY = 'lemris_scores_v1';
const KILLERS_KEY = 'lemris_killers_v1';
const SETTINGS_KEY = 'lemris_settings_v1';

// Default settings
const DEFAULT_SETTINGS: GameSettings = {
    controlScheme: 'SWIPE',
    musicVol: 0.5,
    sfxVol: 0.5,
    showParticles: true
};

export const getTopScores = (difficulty: Difficulty, mode: GameMode): ScoreEntry[] => {
  try {
    const data = localStorage.getItem(SCORES_KEY);
    const allScores: ScoreEntry[] = data ? JSON.parse(data) : [];
    // We now filter only by Mode, showing all difficulties in one leaderboard (sorted by score)
    return allScores
      .filter(s => (s.mode === mode || (!s.mode && mode === GameMode.SAVE))) 
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
      .filter(k => (k.mode === mode || (!k.mode && mode === GameMode.SAVE)))
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

export const saveSettings = (settings: GameSettings) => {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error("Failed to save settings", e);
    }
};

export const getSettings = (): GameSettings => {
    try {
        const data = localStorage.getItem(SETTINGS_KEY);
        return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch (e) {
        return DEFAULT_SETTINGS;
    }
};