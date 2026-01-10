
import { ScoreEntry, KillerEntry, Difficulty, GameMode, ControlScheme } from '../types';

const SCORES_KEY = 'lemris_scores_v1';
const KILLERS_KEY = 'lemris_killers_v1';
const SETTINGS_KEY = 'lemris_settings_v1';

export interface GameSettings {
  musicVol: number;
  sfxVol: number;
  controlScheme: ControlScheme;
}

export const getSettings = (): GameSettings => {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? JSON.parse(data) : { musicVol: 0.5, sfxVol: 0.5, controlScheme: 'SWIPE' };
  } catch (e) {
    return { musicVol: 0.5, sfxVol: 0.5, controlScheme: 'SWIPE' };
  }
};

export const saveSettings = (settings: GameSettings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {}
};

export const getTopScores = (difficulty: Difficulty, mode: GameMode): ScoreEntry[] => {
  try {
    const data = localStorage.getItem(SCORES_KEY);
    const allScores: ScoreEntry[] = data ? JSON.parse(data) : [];
    return allScores
      .filter(s => s.difficulty === difficulty && (s.mode === mode || (!s.mode && mode === GameMode.SAVE)))
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
  } catch (e) {}
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
  } catch (e) {}
};
