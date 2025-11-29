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

export interface Post {
    id: string;             // Unique ID (hash of content)
    platform: 'instagram';  // Hardcoded for now
    screenType: 'feed_post' | 'comment_thread' | 'unknown';
    accountName: string | null;
    caption: string | null;
    likes?: string;
    timestamp: number;
    rawScreenText: string;
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

            db.execute(`
        CREATE TABLE IF NOT EXISTS posts (
          id TEXT PRIMARY KEY,
          platform TEXT NOT NULL,
          screen_type TEXT NOT NULL,
          account_name TEXT,
          caption TEXT,
          likes TEXT,
          timestamp REAL NOT NULL,
          raw_screen_text TEXT
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

    async savePost(post: Post) {
        try {
            // Upsert: Insert or Replace if ID exists
            // We update timestamp to show it was viewed again
            await db.execute(
                `INSERT OR REPLACE INTO posts (id, platform, screen_type, account_name, caption, likes, timestamp, raw_screen_text)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    post.id,
                    post.platform,
                    post.screenType,
                    post.accountName,
                    post.caption,
                    post.likes || null,
                    post.timestamp,
                    post.rawScreenText
                ]
            );
            console.log(`Post saved/updated: ${post.id}`);
        } catch (e) {
            console.error('Failed to save post', e);
        }
    }

    async clearMemory() {
        try {
            await db.execute('DELETE FROM observations');
            await db.execute('DELETE FROM posts');
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

    async getRecentPosts(limit: number = 50): Promise<Post[]> {
        try {
            const results = await db.execute(
                'SELECT * FROM posts ORDER BY timestamp DESC LIMIT ?',
                [limit]
            );
            return results.rows?.map(this.mapRowToPost) || [];
        } catch (e) {
            console.error('Failed to get recent posts', e);
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

    private mapRowToPost(row: any): Post {
        return {
            id: row.id,
            platform: row.platform,
            screenType: row.screen_type,
            accountName: row.account_name,
            caption: row.caption,
            likes: row.likes,
            timestamp: row.timestamp,
            rawScreenText: row.raw_screen_text
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
