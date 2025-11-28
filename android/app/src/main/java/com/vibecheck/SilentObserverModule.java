package com.vibecheck;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import android.provider.Settings;
import android.content.Intent;
import android.text.TextUtils;
import android.content.Context;

public class SilentObserverModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    SilentObserverModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() {
        return "SilentObserver";
    }

    @ReactMethod
    public void openAccessibilitySettings() {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        reactContext.startActivity(intent);
    }

    @ReactMethod
    public void isServiceEnabled(Promise promise) {
        int accessibilityEnabled = 0;
        final String service = reactContext.getPackageName() + "/" + SilentObserverService.class.getCanonicalName();
        try {
            accessibilityEnabled = Settings.Secure.getInt(
                    reactContext.getApplicationContext().getContentResolver(),
                    android.provider.Settings.Secure.ACCESSIBILITY_ENABLED);
        } catch (Settings.SettingNotFoundException e) {
            // Error finding setting, default to not enabled
        }
        
        TextUtils.SimpleStringSplitter mStringColonSplitter = new TextUtils.SimpleStringSplitter(':');

        if (accessibilityEnabled == 1) {
            String settingValue = Settings.Secure.getString(
                    reactContext.getApplicationContext().getContentResolver(),
                    Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            if (settingValue != null) {
                mStringColonSplitter.setString(settingValue);
                while (mStringColonSplitter.hasNext()) {
                    String accessibilityService = mStringColonSplitter.next();
                    if (accessibilityService.equalsIgnoreCase(service)) {
                        promise.resolve(true);
                        return;
                    }
                }
            }
        }
        promise.resolve(false);
    }
}
