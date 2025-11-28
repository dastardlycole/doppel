import { NativeModules } from 'react-native';

interface SilentObserverInterface {
    openAccessibilitySettings(): void;
    isServiceEnabled(): Promise<boolean>;
}

const { SilentObserver } = NativeModules;

export default SilentObserver as SilentObserverInterface;
