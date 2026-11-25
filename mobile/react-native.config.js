module.exports = {
  project: {
    ios: {
      automaticPodsInstallation: true,
    },
    android: {
      packageName: 'com.riyadhchat.app',
    },
  },
  dependencies: {
    'react-native-vector-icons': {
      platforms: {
        ios: null,
      },
    },
  },
  assets: ['./src/assets/fonts/'],
};
