import { ScoreEntry } from '../types';

const API_ENDPOINT = '/api/save_score.php';

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
        console.warn("Server save failed. Make sure api/save_score.php exists on your server.", e);
        return null;
    }
};

export const saveKillerRemote = async () => {
    // Pro zjednodušení používáme jeden endpoint pro vše podstatné
    return null;
};
