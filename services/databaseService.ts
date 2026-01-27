/**
 * DATABASE SERVICE (REMOTE)
 * 
 * Host: mysql.muj.cloud
 * DB: gemini_ententeak_cz
 * User: gemini_5zNSQ
 * Pass: gQwbh4&6TX2AA7brNC
 * Prefix: lemris_
 */

import { ScoreEntry, KillerEntry, Difficulty, GameMode } from '../types';

const API_ENDPOINT = '/api/scores.php';
const TIMEOUT_MS = 10000; // 10 seconds timeout

const fetchWithTimeout = async (resource: string, options: RequestInit = {}) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
  
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export const fetchTopScoresRemote = async (difficulty: Difficulty, mode: GameMode): Promise<ScoreEntry[]> => {
    try {
        // Send empty difficulty to get all results for the mode
        const response = await fetchWithTimeout(`${API_ENDPOINT}?action=get_scores&difficulty=&mode=${encodeURIComponent(mode)}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.warn("Remote Fetch Failed (Scores):", e);
        throw e; // Propagate error so UI knows connection failed
    }
};

export const fetchTopKillersRemote = async (difficulty: Difficulty, mode: GameMode): Promise<KillerEntry[]> => {
    try {
        const response = await fetchWithTimeout(`${API_ENDPOINT}?action=get_killers&difficulty=&mode=${encodeURIComponent(mode)}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.warn("Remote Fetch Failed (Killers):", e);
        throw e;
    }
};

export const saveScoreRemote = async (entry: ScoreEntry) => {
    try {
        const response = await fetchWithTimeout(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'save_score',
                data: entry
            })
        });
        return await response.json();
    } catch (e) {
        console.warn("Remote Save Failed:", e);
        return null; // Fire and forget approach mostly
    }
};

export const saveKillerRemote = async (entry: KillerEntry) => {
    try {
        const response = await fetchWithTimeout(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'save_killer',
                data: entry
            })
        });
        return await response.json();
    } catch (e) {
        console.warn("Remote Save Failed:", e);
        return null;
    }
};