import { open } from '@op-engineering/op-sqlite';

const DB_NAME = 'vibecheck.sqlite';
const db = open({ name: DB_NAME });

export interface Observation {
    id: number;
    text: string;
    embedding: number[];
    timestamp: number;
    packageName: string;
}

class MemoryService {
    constructor() {
        this.init();
    }

    private init() {
        try {
            db.execute(`
        CREATE TABLE IF NOT EXISTS observations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          text TEXT NOT NULL,
          embedding TEXT NOT NULL, -- Storing as JSON string for simplicity in JS
          timestamp REAL NOT NULL,
          package_name TEXT NOT NULL
        );
      `);
            console.log('MemoryService initialized');
        } catch (e) {
            console.error('Failed to init MemoryService', e);
        }
    }

    async saveObservation(text: string, embedding: number[], packageName: string) {
        try {
            const embeddingJson = JSON.stringify(embedding);
            const timestamp = Date.now();

            await db.execute(
                'INSERT INTO observations (text, embedding, timestamp, package_name) VALUES (?, ?, ?, ?)',
                [text, embeddingJson, timestamp, packageName]
            );
            console.log('Observation saved');
        } catch (e) {
            console.error('Failed to save observation', e);
        }
    }

    async clearMemory() {
        try {
            await db.execute('DELETE FROM observations');
            console.log('Memory cleared');
        } catch (e) {
            console.error('Failed to clear memory', e);
        }
    }

    async getRecentObservations(limit: number = 50): Promise<Observation[]> {
        try {
            // Get last 24 hours
            const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
            const results = await db.execute(
                'SELECT * FROM observations WHERE timestamp > ? ORDER BY timestamp DESC LIMIT ?',
                [oneDayAgo, limit]
            );

            return results.rows?.map(this.mapRowToObservation) || [];
        } catch (e) {
            console.error('Failed to get recent observations', e);
            return [];
        }
    }

    async searchRelevantObservations(queryVector: number[], limit: number = 5): Promise<Observation[]> {
        try {
            // Fetch all recent observations (optimization: fetch only needed fields or use native vector ext if available)
            // For hackathon: fetch all recent, compute cosine sim in JS
            const candidates = await this.getRecentObservations(200); // Look at last 200 items

            const scored = candidates.map(obs => ({
                obs,
                score: this.cosineSimilarity(queryVector, obs.embedding)
            }));

            // Sort by score desc
            scored.sort((a, b) => b.score - a.score);

            return scored.slice(0, limit).map(s => s.obs);
        } catch (e) {
            console.error('Vector search failed', e);
            return [];
        }
    }

    private mapRowToObservation(row: any): Observation {
        return {
            id: row.id,
            text: row.text,
            embedding: JSON.parse(row.embedding),
            timestamp: row.timestamp,
            packageName: row.package_name
        };
    }

    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

export const memoryService = new MemoryService();
