import { CactusLM, type Message } from 'cactus-react-native';

class CactusService {
    private cactus: CactusLM;
    private isModelLoaded: boolean = false;
    private initPromise: Promise<void> | null = null;

    constructor() {
        // Initialize with default model (Qwen) which worked previously
        this.cactus = new CactusLM();
    }

    async initialize() {
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
                        await new Promise(resolve => setTimeout(resolve, 1000));
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

    async generateEmbedding(text: string): Promise<number[]> {
        if (!this.isModelLoaded) await this.initialize();

        // Note: In the real SDK, we would use a specific embedding model
        // For this hackathon version, we are using the main model for embeddings if supported
        // or relying on the library's default behavior.
        const result = await this.cactus.embed({ text });
        return result.embedding;
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

        const result = await this.cactus.complete({ messages: finalMessages });
        return result.response;
    }
}

export const cactusService = new CactusService();
