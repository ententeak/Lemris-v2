export const GameState = {
  MENU: 0,
  PLAYING: 1,
  PAUSED: 2,
  GAME_OVER: 3
} as const;

export type GameState = typeof GameState[keyof typeof GameState];

export const GameMode = {
  SAVE: 'Zachraň',
  KILL: 'Zabíjej',
  CAGE: 'Lov'
} as const;

export type GameMode = typeof GameMode[keyof typeof GameMode];

export const Difficulty = {
  EASY: 'Lehká',
  MEDIUM: 'Střední',
  HARD: 'Těžká'
} as const;

export type Difficulty = typeof Difficulty[keyof typeof Difficulty];

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
  x: number; 
  y: number;
  dx: number; 
  dy: number;
  state: 'WALKING' | 'FALLING' | 'DYING';
  frame: number;
}

export interface BloodSplat {
  x: number;
  y: number;
  alpha: number;
  radius: number; 
  type: 'BLOOD' | 'MONEY' | 'TEXT';
  text?: string;
  color?: string;
}

export interface ScoreEntry {
  name: string;
  score: number;
  date: string;
  difficulty: Difficulty;
  mode?: GameMode;
  saved?: number;
  killed?: number;
  quests?: number;
}

export interface KillerEntry {
  name: string;
  kills: number;
  date: string;
  difficulty: Difficulty;
  mode?: GameMode;
}

export type GridCell = {
  value: number; 
  color: string;
  hasLemming?: boolean;
};

export type QuestObjectiveType = 
  | 'CLEAR_LINES'
  | 'CLEAR_DOUBLE'
  | 'CLEAR_TRIPLE'
  | 'CLEAR_TETRIS'
  | 'HAVE_LEMMINGS'
  | 'KILL_TOTAL'
  | 'KILL_MULTI'
  | 'SELL_TOTAL'
  | 'SELL_BATCH';

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