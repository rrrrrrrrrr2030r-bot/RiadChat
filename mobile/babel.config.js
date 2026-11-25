module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Must stay last for react-native-reanimated native worklet compilation
    'react-native-reanimated/plugin',
  ],
};
