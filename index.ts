import { LogBox, Platform } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';

// Suppress benign non-critical warnings from react-native-web internal components
LogBox.ignoreLogs([
  "Animated: `useNativeDriver` is not supported",
  "Cannot record touch end without a touch start",
]);

if (Platform.OS === 'web' && typeof console !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Cannot record touch end without a touch start')) {
      return;
    }
    originalWarn.apply(console, args);
  };
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

