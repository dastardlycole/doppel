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
import { RAGService } from '../services/RAGService';
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
    const [posts, setPosts] = useState<any[]>([]); // Use any to avoid import cycle for now, or import Post

    useEffect(() => {
        if (lastObservation) {
            setLogs(prev => [`[OBSERVED] (${lastObservation.length} chars) ${lastObservation.substring(0, 150)}...`, ...prev].slice(0, 10));

            // Refresh posts when new observation comes in
            loadPosts();
        }
    }, [lastObservation]);

    useEffect(() => {
        loadPosts();
    }, []);

    const loadPosts = async () => {
        const recent = await memoryService.getRecentPosts(10);
        setPosts(recent);
    };

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

    const handleTestRAG = async () => {
        setIsChecking(true);
        setLogs(prev => ["[TEST] Starting RAG Test...", ...prev]);
        try {
            // Check available models
            const models = await cactusService.getAvailableModels();
            console.log('Available Models:', JSON.stringify(models, null, 2));
            setLogs(prev => [`[TEST] Models checked (see logs)`, ...prev]);

            // Clear old data first
            await RAGService.clearCorpus();
            setLogs(prev => [`[TEST] Cleared old corpus data`, ...prev]);

            // 1. Ingest Fake Data (Extreme Sports) - 10 entries
            const fakeReels = [
                {
                    accountname: "redbull_cliffdiving",
                    caption: "Insane jump from 27m!",
                    Imagedescription: "A diver jumping off a cliff into the ocean",
                    timedelta: 12000
                },
                {
                    accountname: "snowboarding_daily",
                    caption: "Fresh powder in the Alps",
                    Imagedescription: "Snowboarder carving down a snowy mountain",
                    timedelta: 8000
                },
                {
                    accountname: "skydiving_extreme",
                    caption: "Wingsuit flying through the mountains",
                    Imagedescription: "Person in wingsuit gliding between mountain peaks",
                    timedelta: 15000
                },
                {
                    accountname: "surfing_bigwaves",
                    caption: "Riding a 20ft wave in Hawaii",
                    Imagedescription: "Surfer on a massive wave barrel",
                    timedelta: 10000
                },
                {
                    accountname: "mountainbiking_pro",
                    caption: "Downhill at 60mph!",
                    Imagedescription: "Mountain biker racing down a steep trail",
                    timedelta: 9000
                },
                {
                    accountname: "rockclimbing_daily",
                    caption: "Free solo El Capitan",
                    Imagedescription: "Climber scaling a vertical rock face without ropes",
                    timedelta: 11000
                },
                {
                    accountname: "bmx_tricks",
                    caption: "Backflip over the mega ramp",
                    Imagedescription: "BMX rider doing a backflip in mid-air",
                    timedelta: 7000
                },
                {
                    accountname: "skateboarding_legends",
                    caption: "Kickflip down the 20 stair",
                    Imagedescription: "Skateboarder performing a kickflip on stairs",
                    timedelta: 6000
                },
                {
                    accountname: "parkour_masters",
                    caption: "Rooftop jumping in Dubai",
                    Imagedescription: "Parkour athlete jumping between skyscrapers",
                    timedelta: 13000
                },
                {
                    accountname: "motocross_madness",
                    caption: "Whip it over the triple jump",
                    Imagedescription: "Motocross rider doing a whip trick in the air",
                    timedelta: 14000
                }
            ];

            for (const reel of fakeReels) {
                await RAGService.saveReelData(reel);
                setLogs(prev => [`[TEST] Saved reel from ${reel.accountname}`, ...prev]);
            }

            // 2. Query RAG
            setLogs(prev => ["[TEST] Querying: 'What are my hobbies?'", ...prev]);
            const answer = await RAGService.queryRAG("What are my hobbies based on the videos I watched?");

            setLogs(prev => [`[TEST] Answer: ${answer}`, ...prev]);
            setVibeResult(`RAG TEST RESULT:\n${answer}`);

        } catch (error) {
            console.error(error);
            setLogs(prev => ["[TEST] Error: " + error, ...prev]);
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

            {/* Recent Posts Debug View */}
            <View style={styles.postsContainer}>
                <Text style={styles.sectionTitle}>CAPTURED POSTS</Text>
                <ScrollView style={styles.postsScroll}>
                    {posts.map((post) => (
                        <View key={post.id} style={styles.postCard}>
                            <Text style={styles.postHeader}>
                                <Text style={styles.platformTag}>[{post.platform}]</Text> {post.accountName || 'Unknown'}
                            </Text>
                            <Text style={styles.postCaption} numberOfLines={2}>{post.caption || 'No caption'}</Text>
                            <Text style={styles.postMeta}>
                                ❤️ {post.likes || '0'} • {new Date(post.timestamp).toLocaleTimeString()}
                            </Text>
                            <Text style={styles.debugText}>Type: {post.screenType}</Text>
                        </View>
                    ))}
                    {posts.length === 0 && <Text style={styles.emptyText}>No posts captured yet.</Text>}
                </ScrollView>
            </View>

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

                <TouchableOpacity
                    style={[styles.checkButton, { marginTop: 10, backgroundColor: '#333' }]}
                    onPress={handleTestRAG}
                    disabled={isChecking}
                >
                    <Text style={styles.checkButtonText}>TEST RAG (FAKE DATA)</Text>
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
    postsContainer: {
        marginTop: 20,
        height: 250,
    },
    sectionTitle: {
        color: '#666',
        fontSize: 12,
        marginBottom: 8,
        fontFamily: 'monospace',
        fontWeight: 'bold',
    },
    postsScroll: {
        flex: 1,
        backgroundColor: '#000',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
        padding: 10,
    },
    postCard: {
        backgroundColor: '#18181b',
        borderRadius: 8,
        padding: 10,
        marginBottom: 10,
        borderLeftWidth: 3,
        borderLeftColor: THEME.primary,
    },
    postHeader: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
        marginBottom: 4,
    },
    platformTag: {
        color: THEME.magic,
    },
    postCaption: {
        color: '#ccc',
        fontSize: 12,
        marginBottom: 6,
    },
    postMeta: {
        color: '#666',
        fontSize: 10,
    },
    debugText: {
        color: '#444',
        fontSize: 10,
        marginTop: 4,
        fontFamily: 'monospace',
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        marginTop: 20,
    },
});
