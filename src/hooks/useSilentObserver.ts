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
            console.log('New Observation:', text.substring(0, 100) + '...');
            setLastObservation(text);

            // Debounce AI processing
            if (debounceTimeout.current) {
                clearTimeout(debounceTimeout.current);
            }

            debounceTimeout.current = setTimeout(async () => {
                try {
                    console.log('Processing observation (Debounced)...');
                    // 1. Generate Embedding
                    const embedding = await cactusService.generateEmbedding(text);

                    // 2. Save to Memory
                    await memoryService.saveObservation(text, embedding, packageName);
                } catch (e) {
                    console.error('Failed to process observation', e);
                }
            }, 3000); // Wait 3 seconds after last scroll event
        });

        return () => {
            subscription.remove();
            if (debounceTimeout.current) {
                clearTimeout(debounceTimeout.current);
            }
        };
    }, []);

    return {
        isServiceEnabled,
        openSettings,
        lastObservation
    };
};
