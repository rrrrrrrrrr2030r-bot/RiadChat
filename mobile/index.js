import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { AppRegistry, I18nManager } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Enforce Arabic RTL layout natively on first boot
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

AppRegistry.registerComponent(appName, () => App);
