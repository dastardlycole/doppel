import { useEffect, useState, useRef } from 'react';
import { DeviceEventEmitter, AppState, AppStateStatus } from 'react-native';
import SilentObserver from '../native/SilentObserver';
import { memoryService } from '../services/MemoryService';
import { cactusService } from '../services/CactusService';

export const useSilentObserver = () => {
    const [isServiceEnabled, setIsServiceEnabled] = useState(false);
    const [lastObservation, setLastObservation] = useState<string | null>(null);
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

    const checkServiceStatus = async () => {
        const enabled = await SilentObserver.isServiceEnabled();
        setIsServiceEnabled(enabled);
    };

    const openSettings = () => {
        SilentObserver.openAccessibilitySettings();
    };

    useEffect(() => {
        checkServiceStatus();

        // Re-check when app comes to foreground
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                checkServiceStatus();
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    useEffect(() => {
        const subscription = DeviceEventEmitter.addListener('SilentObserverEvent', async (event) => {
            const { text, package: packageName } = event;
            console.log(`New Screen Capture (Length: ${text.length})`);
            setLastObservation(text);

            // Debounce AI processing
            if (debounceTimeout.current) {
                clearTimeout(debounceTimeout.current);
            }

            debounceTimeout.current = setTimeout(async () => {
                try {
                    console.log('Processing screen capture (Debounced)...');

                    // 1. Extract Data using AI
                    const postData = await cactusService.extractPostData(text);

                    if (postData) {
                        console.log('AI Extracted:', JSON.stringify(postData, null, 2));

                        // 2. Generate ID (Simple hash for deduplication)
                        // ID = hash(accountName + caption)
                        const uniqueString = `${postData.accountName || ''}_${postData.caption || ''}`;
                        const id = simpleHash(uniqueString);

                        // 3. Save to Memory
                        await memoryService.savePost({
                            ...postData,
                            id,
                            timestamp: Date.now(),
                            rawScreenText: text
                        });
                    } else {
                        console.log('AI failed to extract structured data');
                    }

                    // Legacy: Also save as raw observation for the "Vibe Check" summary
                    // We might want to deprecate this later, but keeping for compatibility
                    const embedding = await cactusService.generateEmbedding(text);
                    await memoryService.saveObservation(text, embedding, packageName);

                } catch (e) {
                    console.error('Failed to process observation', e);
                }
            }, 3000); // Wait 3 seconds after last scroll event (Aggressive Debounce)
        });

        return () => {
            subscription.remove();
            if (debounceTimeout.current) {
                clearTimeout(debounceTimeout.current);
            }
        };
    }, []);

    // Simple hash function for ID generation
    const simpleHash = (str: string): string => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    };

    return {
        isServiceEnabled,
        openSettings,
        lastObservation
    };
};
