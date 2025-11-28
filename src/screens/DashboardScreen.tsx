import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    StatusBar,
    Dimensions
} from 'react-native';
import { useSilentObserver } from '../hooks/useSilentObserver';
import { cactusService } from '../services/CactusService';
import { memoryService } from '../services/MemoryService';
// import Icon from 'react-native-vector-icons/MaterialCommunityIcons'; // Commented out until linked properly

const { width } = Dimensions.get('window');

const THEME = {
    background: '#09090b', // Zinc-950
    primary: '#10b981',    // Emerald-500
    danger: '#f43f5e',     // Rose-500
    magic: '#a855f7',      // Purple-500
    text: '#e4e4e7',       // Zinc-200
    card: '#18181b',       // Zinc-900
};

export const DashboardScreen = () => {
    const { isServiceEnabled, openSettings, lastObservation } = useSilentObserver();
    const [isChecking, setIsChecking] = useState(false);
    const [vibeResult, setVibeResult] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        if (lastObservation) {
            setLogs(prev => [`[OBSERVED] ${lastObservation.substring(0, 40)}...`, ...prev].slice(0, 10));
        }
    }, [lastObservation]);

    const handleVibeCheck = async () => {
        setIsChecking(true);
        setVibeResult(null);
        try {
            // 1. Get context (RAG)
            // We create a dummy query vector for "general personality" or just fetch recent
            // For this hackathon, we'll just fetch recent raw text to summarize
            const recentObs = await memoryService.getRecentObservations(20);
            const context = recentObs.map(o => `[${o.packageName}] ${o.text}`).join('\n');

            if (!context) {
                setVibeResult("No data yet. Go doomscroll for a bit!");
                setIsChecking(false);
                return;
            }

            // 2. Ask Oracle
            console.log('--- CONTEXT SENT TO AI ---');
            console.log(context);
            console.log('--------------------------');
            const response = await cactusService.chat([
                { role: 'user', content: 'Who am I based on this?' }
            ], context);

            setVibeResult(response);
        } catch (e) {
            console.error(e);
            setVibeResult("Error connecting to the Oracle.");
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={THEME.background} />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>VIBE CHECK</Text>
                <View style={[styles.badge, { backgroundColor: isServiceEnabled ? THEME.primary : THEME.danger }]}>
                    <Text style={styles.badgeText}>{isServiceEnabled ? 'ONLINE' : 'OFFLINE'}</Text>
                </View>
            </View>

            {!isServiceEnabled && (
                <TouchableOpacity style={styles.warningBanner} onPress={openSettings}>
                    <Text style={styles.warningText}>⚠️ Enable Silent Observer Service</Text>
                </TouchableOpacity>
            )}

            {/* Terminal / Logs */}
            <View style={styles.terminal}>
                <Text style={styles.terminalHeader}>// SYSTEM_LOGS</Text>
                <ScrollView style={styles.logsScroll}>
                    {logs.length === 0 ? (
                        <Text style={styles.logText}>Waiting for input...</Text>
                    ) : (
                        logs.map((log, i) => (
                            <Text key={i} style={styles.logText}>{log}</Text>
                        ))
                    )}
                </ScrollView>
            </View>

            {/* Result Card */}
            {vibeResult && (
                <View style={styles.resultCard}>
                    <Text style={styles.resultTitle}>ANALYSIS COMPLETE</Text>
                    <ScrollView>
                        <Text style={styles.resultText}>{vibeResult}</Text>
                    </ScrollView>
                </View>
            )}

            {/* Main Action */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.checkButton, isChecking && styles.checkButtonDisabled]}
                    onPress={handleVibeCheck}
                    disabled={isChecking}
                >
                    {isChecking ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.checkButtonText}>CHECK MY VIBE</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.background,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 40,
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: THEME.magic,
        letterSpacing: 2,
        fontFamily: 'monospace', // Fallback
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 4,
    },
    badgeText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 12,
    },
    warningBanner: {
        backgroundColor: 'rgba(244, 63, 94, 0.2)',
        borderWidth: 1,
        borderColor: THEME.danger,
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
        alignItems: 'center',
    },
    warningText: {
        color: THEME.danger,
        fontWeight: 'bold',
    },
    terminal: {
        backgroundColor: '#000',
        borderRadius: 8,
        padding: 16,
        height: 200,
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 20,
    },
    terminalHeader: {
        color: '#666',
        fontSize: 12,
        marginBottom: 8,
        fontFamily: 'monospace',
    },
    logsScroll: {
        flex: 1,
    },
    logText: {
        color: THEME.primary,
        fontFamily: 'monospace',
        fontSize: 12,
        marginBottom: 4,
    },
    resultCard: {
        flex: 1,
        backgroundColor: THEME.card,
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: THEME.magic,
    },
    resultTitle: {
        color: THEME.magic,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 12,
        letterSpacing: 1,
    },
    resultText: {
        color: THEME.text,
        fontSize: 16,
        lineHeight: 24,
    },
    footer: {
        marginBottom: 20,
    },
    checkButton: {
        backgroundColor: THEME.magic,
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: THEME.magic,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    checkButtonDisabled: {
        opacity: 0.7,
    },
    checkButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 1,
    },
});
