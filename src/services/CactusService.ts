import { CactusLM, type Message } from 'cactus-react-native';
import RNFS from 'react-native-fs';

const CORPUS_DIR = `${RNFS.DocumentDirectoryPath}/corpus`;

class CactusService {
    private cactus: CactusLM;
    private isModelLoaded: boolean = false;
    private initPromise: Promise<void> | null = null;
    private requestQueue: Promise<any> = Promise.resolve();

    constructor() {
        // Initialize with LiquidAI model and RAG corpus directory
        this.cactus = new CactusLM({
            model: 'lfm2-vl-450m',
            corpusDir: CORPUS_DIR
        });
    }

    async initialize() {
        console.log('Initializing Cactus Service with model: lfm2-vl-450m');

        // Ensure corpus directory exists
        const exists = await RNFS.exists(CORPUS_DIR);
        if (!exists) {
            await RNFS.mkdir(CORPUS_DIR);
        }

        if (this.isModelLoaded) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                let attempts = 0;
                const maxAttempts = 3;

                while (attempts < maxAttempts) {
                    try {
                        console.log(`Attempting model download (${attempts + 1}/${maxAttempts})...`);
                        // Use default download params
                        await this.cactus.download({
                            onProgress: (progress) => {
                                console.log(`Model Download Progress: ${Math.round(progress * 100)}%`);
                            },
                        });
                        this.isModelLoaded = true;
                        console.log('Cactus Model Loaded');
                        break; // Success
                    } catch (e) {
                        attempts++;
                        console.error(`Download attempt ${attempts} failed:`, e);
                        if (attempts === maxAttempts) throw e;
                        // Wait 1 second before retrying
                        await new Promise(resolve => setTimeout(() => resolve(null), 1000));
                    }
                }
            } catch (error) {
                console.error('Failed to initialize Cactus:', error);
                throw error;
            } finally {
                this.initPromise = null;
            }
        })();

        return this.initPromise;
    }

    // Helper to queue requests to prevent "already generating" errors
    private async enqueueRequest<T>(operation: () => Promise<T>): Promise<T> {
        // Chain the new operation to the end of the existing queue
        const result = this.requestQueue.then(() => operation());
        // Update the queue to wait for this new operation (catch errors so the queue doesn't stall)
        this.requestQueue = result.catch(() => { });
        return result;
    }

    async generateEmbedding(text: string): Promise<number[]> {
        if (!this.isModelLoaded) await this.initialize();

        return this.enqueueRequest(async () => {
            const result = await this.cactus.embed({ text });
            return result.embedding;
        });
    }

    async chat(messages: Message[], context?: string): Promise<string> {
        if (!this.isModelLoaded) await this.initialize();

        let finalMessages = [...messages];

        if (context) {
            const systemPrompt = `You are "Vibe Check", a witty, cyberpunk digital mirror. 
      Analyze the user's recent content consumption to build a personality profile.
      
      CONTEXT (User's recent screen activity):
      ${context}
      
      Be insightful, slightly edgy, and use Gen-Z slang appropriately but not cringey.
      Tell them what their "Vibe" is based on what they watch.`;

            finalMessages = [
                { role: 'system', content: systemPrompt },
                ...messages
            ];
        }

        return this.enqueueRequest(async () => {
            const result = await this.cactus.complete({ messages: finalMessages });
            return result.response;
        });
    }

    async extractPostData(text: string): Promise<any> {
        if (!this.isModelLoaded) await this.initialize();

        const prompt = `
        You are a data extraction assistant.
        Extract the following information from the text below and return it as a VALID JSON object.
        Do not include any markdown formatting (like \`\`\`json). Just the raw JSON string.

        Fields to extract:
        - accountName (The username of the poster)
        - caption (The main text of the post)
        - screenType (e.g., "instagram_reel", "tiktok", "twitter_post")
        - likes (Number of likes if visible, as a string)

        TEXT:
        ${text}
        `;

        return this.enqueueRequest(async () => {
            const result = await this.cactus.complete({
                messages: [{ role: 'user', content: prompt }]
            });

            try {
                // Clean the response in case the model adds markdown
                const cleanJson = result.response.replace(/```json/g, '').replace(/```/g, '').trim();
                return JSON.parse(cleanJson);
            } catch (e) {
                console.error('Failed to parse extracted JSON:', e);
                console.log('Raw response:', result.response);
                return null;
            }
        });
    }

    async performRawQuery(messages: Message[]): Promise<string> {
        if (!this.isModelLoaded) await this.initialize();

        return this.enqueueRequest(async () => {
            const result = await this.cactus.complete({ messages });
            return result.response;
        });
    }

    /**
     * Re-initializes the CactusLM instance. 
     * This is necessary when the RAG corpus has changed, as the model needs to re-index the files.
     */
    async refreshSession(): Promise<void> {
        return this.enqueueRequest(async () => {
            console.log('[CactusService] Refreshing session to update RAG index...');
            // 1. Stop any ongoing generation
            await this.cactus.stop();

            // 2. Destroy the current instance to release resources
            await this.cactus.destroy();

            // 3. Create a new instance with the same config
            this.cactus = new CactusLM({
                model: 'lfm2-vl-450m',
                corpusDir: CORPUS_DIR
            });

            // 4. Re-initialize (this will re-read the corpus)
            await this.cactus.init();
            console.log('[CactusService] Session refreshed.');
        });
    }

    async getAvailableModels(): Promise<any[]> {
        return this.cactus.getModels();
    }
}

export const cactusService = new CactusService();
