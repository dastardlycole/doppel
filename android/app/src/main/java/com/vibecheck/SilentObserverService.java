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
    private static final long THROTTLE_MS = 500;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null)
            return;

        // Only care about scroll or content changes that might indicate a new post
        int eventType = event.getEventType();
        if (eventType != AccessibilityEvent.TYPE_VIEW_SCROLLED &&
                eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED &&
                eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            return;
        }

        long currentTime = System.currentTimeMillis();
        if (currentTime - lastEventTime < THROTTLE_MS)
            return;

        // Get the root of the active window to see EVERYTHING
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null)
            return;

        String packageName = root.getPackageName() != null ? root.getPackageName().toString() : "unknown";

        // Filter out system UI and sensitive apps (basic list)
        if (isSafeApp(packageName)) {
            StringBuilder screenText = new StringBuilder();
            traverseNode(root, screenText);

            String content = screenText.toString().trim();

            // Filter duplicates and empty content
            if (content.length() > 0 && !content.equals(lastContent)) {
                Log.d(TAG, "Observed Screen (" + content.length() + " chars) in " + packageName);
                sendEventToRN(content, packageName);
                lastEventTime = currentTime;
                lastContent = content;
            }
        }

        // Always recycle the root node to avoid leaks
        root.recycle();
    }

    private void traverseNode(AccessibilityNodeInfo node, StringBuilder sb) {
        if (node == null)
            return;

        // Skip invisible nodes
        if (!node.isVisibleToUser()) {
            return;
        }

        // Append text if this node has it
        if (node.getText() != null && node.getText().length() > 0) {
            sb.append(node.getText()).append("\n");
        }

        // Also capture content description (vital for image-based buttons/usernames)
        if (node.getContentDescription() != null && node.getContentDescription().length() > 0) {
            // Avoid duplicates if text and contentDescription are identical
            CharSequence text = node.getText();
            CharSequence desc = node.getContentDescription();
            if (text == null || !text.toString().equals(desc.toString())) {
                sb.append(desc).append("\n");
            }
        }

        // Recursively visit children
        int childCount = node.getChildCount();
        for (int i = 0; i < childCount; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                traverseNode(child, sb);
                child.recycle(); // Recycle child after use
            }
        }
    }

    private boolean isSafeApp(String packageName) {
        // Allow social media, disallow banking/system
        // This is a hackathon whitelist approach for safety
        return packageName.contains("instagram"); // Focused on Instagram as per plan
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
