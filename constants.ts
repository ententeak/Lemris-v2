import { Tetromino } from './types';

export const COLS = 10;
export const ROWS = 20;
export const BLOCK_SIZE = 30; // Base block size, will be scaled
export const MAX_LEMMINGS = 20;

export const TETROMINOS: { [key: string]: Tetromino } = {
  I: { shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: '#06b6d4' }, // Cyan
  J: { shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: '#3b82f6' }, // Blue
  L: { shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: '#f97316' }, // Orange
  O: { shape: [[1, 1], [1, 1]], color: '#eab308' }, // Yellow
  S: { shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: '#22c55e' }, // Green
  T: { shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: '#a855f7' }, // Purple
  Z: { shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: '#ef4444' }, // Red
};

export const RANDOM_TETROMINO = () => {
  const keys = Object.keys(TETROMINOS);
  const randKey = keys[Math.floor(Math.random() * keys.length)];
  return TETROMINOS[randKey];
};

export const DIFFICULTY_SPEEDS = {
  'Lehká': 800,
  'Střední': 500,
  'Těžká': 200,
};