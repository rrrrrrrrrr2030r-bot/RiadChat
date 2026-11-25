#!/usr/bin/env bash
set -euo pipefail

echo "=== 1/4: Installing matched React Native 0.76.6 dependencies ==="
npm install --legacy-peer-deps=false

echo "=== 2/4: Verifying native autolinking configuration ==="
npx react-native config > /dev/null
echo "Native autolinking config verified successfully."

if [ -d "ios" ] && command -v pod >/dev/null 2>&1; then
  echo "=== 3/4: Linking iOS native pods (CocoaPods) ==="
  (cd ios && pod install --repo-update)
else
  echo "=== 3/4: Skipping CocoaPods (run on macOS inside ios/ directory) ==="
fi

if [ -d "android" ] && [ -x "android/gradlew" ]; then
  echo "=== 4/4: Syncing Android Gradle native modules ==="
  (cd android && ./gradlew clean --no-daemon)
else
  echo "=== 4/4: Skipping Android Gradle clean (initialize native folders via react-native init if needed) ==="
fi

echo "=== Native module linking check complete! ==="
