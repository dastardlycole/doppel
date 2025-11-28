package com.vibecheck;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.util.Log;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.ReactApplication;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;

public class SilentObserverService extends AccessibilityService {
    private static final String TAG = "SilentObserver";

    private long lastEventTime = 0;
    private String lastContent = "";
    private static final long THROTTLE_MS = 2000;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null)
            return;

        long currentTime = System.currentTimeMillis();
        if (currentTime - lastEventTime < THROTTLE_MS)
            return;

        AccessibilityNodeInfo source = event.getSource();
        if (source == null)
            return;

        // Simple text extraction
        // In a real app, we would traverse the tree recursively
        CharSequence text = source.getText();
        if (text != null && text.length() > 0) {
            String content = text.toString();

            // Filter duplicates
            if (content.equals(lastContent))
                return;

            String packageName = event.getPackageName() != null ? event.getPackageName().toString() : "unknown";

            // Filter out system UI and sensitive apps (basic list)
            if (isSafeApp(packageName)) {
                Log.d(TAG, "Observed: " + content + " in " + packageName);
                sendEventToRN(content, packageName);
                lastEventTime = currentTime;
                lastContent = content;
            }
        }
    }

    private boolean isSafeApp(String packageName) {
        // Allow social media, disallow banking/system
        // This is a hackathon whitelist approach for safety
        return packageName.contains("instagram") ||
                packageName.contains("tiktok") ||
                packageName.contains("youtube") ||
                packageName.contains("twitter") ||
                packageName.contains("reddit");
    }

    private void sendEventToRN(String text, String packageName) {
        try {
            ReactContext reactContext = null;
            if (getApplication() instanceof ReactApplication) {
                ReactApplication reactApp = (ReactApplication) getApplication();
                // Use ReactHost for New Architecture
                if (reactApp.getReactHost() != null) {
                    reactContext = reactApp.getReactHost().getCurrentReactContext();
                }
            }

            if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
                WritableMap params = Arguments.createMap();
                params.putString("text", text);
                params.putString("package", packageName);
                params.putDouble("timestamp", System.currentTimeMillis());

                reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                        .emit("SilentObserverEvent", params);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error sending event to RN", e);
        }
    }

    @Override
    public void onInterrupt() {
        Log.d(TAG, "SilentObserver interrupted");
    }
}
