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

// Inject global modern minimalist scrollbar stylesheet for web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'fastart-global-scrollbars';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Universal sleek dark scrollbars */
      * {
        scrollbar-width: thin !important;
        scrollbar-color: rgba(255, 255, 255, 0.18) transparent !important;
      }

      /* Webkit scrollbar sizing (4px width / height) */
      ::-webkit-scrollbar {
        width: 4px !important;
        height: 4px !important;
      }

      ::-webkit-scrollbar-track,
      ::-webkit-scrollbar-track-piece {
        background: transparent !important;
      }

      ::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.18) !important;
        border-radius: 9999px !important;
      }

      ::-webkit-scrollbar-thumb:hover {
        background: #00F2FE !important;
      }

      ::-webkit-scrollbar-corner {
        background: transparent !important;
      }

      ::-webkit-scrollbar-button {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }

      /* Hide scrollbars completely where indicator is suppressed or scrollbar-width is none */
      [style*="scrollbar-width: none"]::-webkit-scrollbar,
      [style*="scrollbar-width:none"]::-webkit-scrollbar,
      [data-no-scrollbar]::-webkit-scrollbar,
      .no-scrollbar::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
      }

      /* Horizontal scrollbars in tab rows and toolbars: sleek zero-height */
      [style*="flex-direction: row"][style*="overflow-x: scroll"]::-webkit-scrollbar,
      [style*="flex-direction: row"][style*="overflow-x: auto"]::-webkit-scrollbar {
        display: none !important;
        height: 0 !important;
      }

      /* Seamless, jitter-free modal & panel transitions */
      @keyframes fastartFadeIn {
        from {
          opacity: 0.75;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes fastartPanelIn {
        from {
          opacity: 0.8;
        }
        to {
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

