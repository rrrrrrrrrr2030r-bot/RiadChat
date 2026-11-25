# تطبيق رياض شات الأصلي (React Native 0.76.6)

نسخة أصلية (Native iOS & Android) مبنية بـ **React Native 0.76.6** مع مطابقة كاملة لإصدارات المكتبات الأصلية وربط برمجي مباشر بغرف الدردشة الصوتية، ألعاب الحظ، وروابط الدعوة العميقة (`riyadhchat://`).

## الحزم الأصلية المدمجة وإصداراتها المتوافقة
- `react@18.3.1` + `react-native@0.76.6`
- `react-native-webrtc@124.0.4` (البث الصوتي وإدارة الميكروفون)
- `react-native-gesture-handler@2.20.2` + `react-native-reanimated@3.16.6` + `react-native-screens@4.4.0`
- `@react-navigation/native@7.0.14` + `native-stack@7.2.0` + `bottom-tabs@7.2.0`
- `react-native-share@12.0.3` + `react-native-haptic-feedback@2.3.3` + `@react-native-async-storage/async-storage@2.1.0`

## أوامر التثبيت والربط البرمجي (Autolinking)
```bash
cd mobile
npm run link:native
npm run doctor
npm run android   # لتشغيل نسخة Android
npm run ios       # لتشغيل نسخة iOS (على macOS)
```
