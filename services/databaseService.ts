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

export const fetchTopScoresRemote = async (difficulty: Difficulty, mode: GameMode): Promise<ScoreEntry[]> => {
    try {
        const response = await fetch(`${API_ENDPOINT}?action=get_scores&difficulty=${encodeURIComponent(difficulty)}&mode=${encodeURIComponent(mode)}`);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (e) {
        console.warn("Remote Fetch Failed: Using local fallback.", e);
        return [];
    }
};

export const fetchTopKillersRemote = async (difficulty: Difficulty, mode: GameMode): Promise<KillerEntry[]> => {
    try {
        const response = await fetch(`${API_ENDPOINT}?action=get_killers&difficulty=${encodeURIComponent(difficulty)}&mode=${encodeURIComponent(mode)}`);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (e) {
        console.warn("Remote Fetch Failed", e);
        return [];
    }
};

export const saveScoreRemote = async (entry: ScoreEntry) => {
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'save_score',
                data: entry
            })
        });
        return await response.json();
    } catch (e) {
        console.warn("Remote Save Failed", e);
        return null;
    }
};

export const saveKillerRemote = async (entry: KillerEntry) => {
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'save_killer',
                data: entry
            })
        });
        return await response.json();
    } catch (e) {
        console.warn("Remote Save Failed", e);
        return null;
    }
};