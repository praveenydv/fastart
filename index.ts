import { LogBox } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';

// Suppress benign non-critical warning from react-native-web internal components (TouchableOpacity, DevLoadingView)
LogBox.ignoreLogs([
  "Animated: `useNativeDriver` is not supported",
]);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

