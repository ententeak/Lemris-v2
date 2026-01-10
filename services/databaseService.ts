
/**
 * DATABASE SERVICE (REMOTE)
 * 
 * Host: mysql.muj.cloud
 * DB: gemini_ententeak_cz
 * User: gemini_5zNSQ
 * Pass: gQwbh4&6TX2AA7brNC
 * Prefix: lemris_
 * 
 * POZNÁMKA: Prohlížeč nemůže přímo komunikovat s MySQL. 
 * Toto vyžaduje backend bridge (např. PHP nebo Node.js API), 
 * který tyto údaje použije k uložení dat.
 */

import { ScoreEntry, KillerEntry } from '../types';

const API_ENDPOINT = '/api/scores.php'; // Hypotetický endpoint na tvém serveru

/**
 * SQL SCHÉMA PRO TABULKY:
 * 
 * CREATE TABLE IF NOT EXISTS lemris_scores (
 *   id INT AUTO_INCREMENT PRIMARY KEY,
 *   name VARCHAR(50),
 *   score INT,
 *   difficulty VARCHAR(20),
 *   mode VARCHAR(20),
 *   quests INT,
 *   saved INT,
 *   killed INT,
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 * );
 * 
 * CREATE TABLE IF NOT EXISTS lemris_killers (
 *   id INT AUTO_INCREMENT PRIMARY KEY,
 *   name VARCHAR(50),
 *   kills INT,
 *   difficulty VARCHAR(20),
 *   mode VARCHAR(20),
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 * );
 */

export const saveScoreRemote = async (entry: ScoreEntry) => {
    console.log("Remote Save: Attempting to save score to mysql.muj.cloud", entry);
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'save_score',
                db_config: {
                    host: 'mysql.muj.cloud',
                    db: 'gemini_ententeak_cz',
                    user: 'gemini_5zNSQ',
                    pass: 'gQwbh4&6TX2AA7brNC',
                    table: 'lemris_scores'
                },
                data: entry
            })
        });
        return await response.json();
    } catch (e) {
        console.warn("Remote Save Failed (Hypothetical API): This requires a server-side script to handle the MySQL connection.", e);
        return null;
    }
};

export const saveKillerRemote = async (entry: KillerEntry) => {
    console.log("Remote Save: Attempting to save killer stats to mysql.muj.cloud", entry);
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'save_killer',
                db_config: {
                    host: 'mysql.muj.cloud',
                    db: 'gemini_ententeak_cz',
                    user: 'gemini_5zNSQ',
                    pass: 'gQwbh4&6TX2AA7brNC',
                    table: 'lemris_killers'
                },
                data: entry
            })
        });
        return await response.json();
    } catch (e) {
        console.warn("Remote Save Failed (Hypothetical API)", e);
        return null;
    }
};
