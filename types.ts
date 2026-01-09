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

export type QuestType = 
  | 'LINES' 
  | 'LEMMINGS' 
  | 'KILL_TOTAL' 
  | 'KILL_MULTI' 
  | 'SELL_TOTAL' 
  | 'SELL_BATCH';

export interface Quest {
  type: QuestType;
  target: number;
  current: number;
  description: string;
  level: number;
}