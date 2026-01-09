export enum GameState {
  MENU,
  PLAYING,
  PAUSED,
  GAME_OVER
}

export enum GameMode {
  SAVE = 'Zachraň',
  KILL = 'Zabíjej',
  CAGE = 'Lov'
}

export enum Difficulty {
  EASY = 'Lehká',
  MEDIUM = 'Střední',
  HARD = 'Těžká'
}

export type ControlScheme = 'BUTTONS' | 'SWIPE';

export interface Tetromino {
  shape: number[][];
  color: string;
}

export interface Player {
  x: number;
  y: number;
  tetromino: Tetromino;
  rotation: number;
}

export interface Lemming {
  id: number;
  x: number; // Grid coordinates (float for smooth movement)
  y: number;
  dx: number; // Direction: -1 or 1
  dy: number;
  state: 'WALKING' | 'FALLING' | 'DYING';
  frame: number;
}

export interface BloodSplat {
  x: number;
  y: number;
  alpha: number;
  radius: number; // Used as font size for text particles
  type: 'BLOOD' | 'MONEY' | 'TEXT';
  text?: string;
  color?: string;
}

export interface ScoreEntry {
  name: string;
  score: number;
  date: string;
  difficulty: Difficulty;
  mode?: GameMode; // Added mode support
  saved?: number;  // Track saved count in history
  killed?: number; // Track killed count in history
  quests?: number; // Track completed quests
}

export interface KillerEntry {
  name: string;
  kills: number;
  date: string;
  difficulty: Difficulty;
  mode?: GameMode; // Added mode support
}

export type GridCell = {
  value: number; // 0 = empty, 1 = occupied
  color: string;
  hasLemming?: boolean; // For CAGE mode
};

export type QuestObjectiveType = 
  | 'CLEAR_LINES'      // Total lines cleared
  | 'CLEAR_DOUBLE'     // Clear 2 lines at once
  | 'CLEAR_TRIPLE'     // Clear 3 lines at once
  | 'CLEAR_TETRIS'     // Clear 4 lines at once
  | 'HAVE_LEMMINGS'    // Maintain X active lemmings (State based)
  | 'KILL_TOTAL'       // Kill X lemmings (Cumulative)
  | 'KILL_MULTI'       // Kill X lemmings in one drop (Event based)
  | 'SELL_TOTAL'       // Sell X lemmings (Cumulative)
  | 'SELL_BATCH';      // Sell X lemmings in one line clear (Event based)

export interface QuestObjective {
  type: QuestObjectiveType;
  target: number;
  current: number;
  description: string;
  isCompleted: boolean;
}

export interface Quest {
  objectives: QuestObjective[];
  level: number;
}