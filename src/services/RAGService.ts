import RNFS from 'react-native-fs';
import { type Message } from 'cactus-react-native';
import { ReelData } from '../types';
import { cactusService } from './CactusService';

const CORPUS_DIR = `${RNFS.DocumentDirectoryPath}/corpus`;

export const RAGService = {
    /**
     * Saves reel data as a text file in the corpus directory for RAG.
     */
    saveReelData: async (data: ReelData): Promise<void> => {
        try {
            // Ensure corpus directory exists
            const exists = await RNFS.exists(CORPUS_DIR);
            if (!exists) {
                await RNFS.mkdir(CORPUS_DIR);
            }

            // Create a unique filename based on account and timestamp
            const filename = `${data.accountname}_${Date.now()}.txt`;
            const filePath = `${CORPUS_DIR}/${filename}`;

            // Format the content into a natural language description
            const content = `
User ${data.accountname} posted a reel.
Caption: "${data.caption}"
Visual Description: ${data.Imagedescription}
The user watched this content for ${data.timedelta} milliseconds.
      `.trim();

            // Write the file
            await RNFS.writeFile(filePath, content, 'utf8');
            console.log(`[RAGService] Saved reel data to ${filePath}`);
        } catch (error) {
            console.error('[RAGService] Error saving reel data:', error);
            throw error;
        }
    },

    /**
     * Clears all data from the corpus directory.
     */
    clearCorpus: async (): Promise<void> => {
        try {
            const exists = await RNFS.exists(CORPUS_DIR);
            if (exists) {
                await RNFS.unlink(CORPUS_DIR);
                await RNFS.mkdir(CORPUS_DIR);
                console.log('[RAGService] Corpus cleared');
            }
        } catch (error) {
            console.error('[RAGService] Error clearing corpus:', error);
            throw error;
        }
    },

    /**
     * Queries the RAG corpus using a Hybrid approach:
     * 1. Built-in RAG (Vector Search) via corpusDir configuration.
     * 2. Manual Context Injection (Long-Context) for immediate consistency.
     */
    queryRAG: async (query: string): Promise<string> => {
        try {
            // 1. Attempt to refresh the session (Layer 3: Force Refresh)
            await cactusService.refreshSession();

            // 2. Read files for Manual Context Injection (Layer 2: Working Memory)
            const exists = await RNFS.exists(CORPUS_DIR);
            let context = "";

            if (exists) {
                const files = await RNFS.readDir(CORPUS_DIR);
                console.log(`[RAGService] Found ${files.length} files in corpus.`);

                for (const file of files) {
                    if (file.isFile() && file.name.endsWith('.txt')) {
                        const content = await RNFS.readFile(file.path, 'utf8');
                        context += `\n---\n${content}\n---\n`;
                    }
                }
            }

            if (!context) {
                console.warn('[RAGService] No context found in corpus!');
                context = "No video history available.";
            }

            console.log('[RAGService] Context constructed (first 100 chars):', context.substring(0, 100));

            // 3. Construct the prompt with explicit context
            // This ensures the model sees the data even if the vector index is stale.
            const systemPrompt = `You are "Vibe Check", an AI analyst.
            
            HERE IS THE USER'S VIEWING HISTORY LOGS (Text Descriptions):
            ${context}
            
            INSTRUCTIONS:
            - Analyze the history above.
            - Answer the user's question based ONLY on this history.
            - If the history shows extreme sports, say they like extreme sports.
            - If it shows food, say they like food.
            - Do NOT say "I don't have access". The history is RIGHT HERE.
            `;

            const fullMessages: Message[] = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: query }
            ];

            // 4. Send to model (Layer 1: The Archive)
            // The model is configured with corpusDir, so it technically has access to the vector index too.
            return await cactusService.performRawQuery(fullMessages);
        } catch (error) {
            console.error('[RAGService] Error querying RAG:', error);
            throw error;
        }
    }
};
