# EAS Build & Deploy Guide

Руководство по созданию production билдов с автоматической отправкой в сторы и Sentry.

## 🎯 Что настроено

### ✅ Sentry Sourcemaps

- **Автоматическая загрузка**: Sourcemaps загружаются автоматически при каждом production билде
- **Конфигурация**: `@sentry/react-native/expo` плагин в `app.json`
- **Auth token**: Настроен в `.sentryclirc` (не коммитится в git)

### ✅ Auto-Submit в сторы

- **iOS**: Автоматическая отправка в TestFlight для internal testing
- **Android**: Отправка в Google Play Internal Testing (draft)
- **Конфигурация**: Настроена в `eas.json` → `submit.production`

## 📱 Команды для билдов

### Production билд с автоматической отправкой

**iOS (TestFlight):**

```bash
eas build --platform ios --profile production --auto-submit
```

**Android (Google Play Internal):**

```bash
eas build --platform android --profile production --auto-submit
```

**Оба сразу:**

```bash
eas build --platform all --profile production --auto-submit
```

### Production билд БЕЗ автоматической отправки

Если нужно сначала проверить билд локально:

```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

Потом можно submit вручную:

```bash
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

## 🔍 Проверка Sourcemaps в Sentry

После билда проверь что sourcemaps загрузились:

1. Открой Sentry: https://sentry.io/organizations/oldrefery/projects/dutch-learning-app/
2. Перейди в **Settings** → **Source Maps**
3. Найди release с версией приложения (например, `com.oldrefery.dutch-learning-app@1.4.0+39`)
4. Убедись что есть файлы `.map` для iOS и Android

## 📦 Что происходит при билде с `--auto-submit`

### iOS:

1. ✅ Создается production билд
2. ✅ Sourcemaps загружаются в Sentry
3. ✅ Билд отправляется в TestFlight (Internal Testing)
4. ⚠️ **Вручную**: Нужно продвинуть билд на External Testing или в App Store

### Android:

1. ✅ Создается app bundle
2. ✅ Sourcemaps загружаются в Sentry
3. ✅ Билд отправляется в Google Play (Internal Testing, draft)
4. ⚠️ **Вручную**: Нужно изменить статус с draft на active в Google Play Console

## 🛠️ Настройки в eas.json

### Production Build Profile

```json
"production": {
  "autoIncrement": false,
  "ios": {
    "simulator": false
  },
  "android": {
    "buildType": "app-bundle"
  }
}
```

### Submit Profile

```json
"submit": {
  "production": {
    "ios": {
      "appleTeamId": "7FQ395U52U",
      "ascAppId": "6738736062"
    },
    "android": {
      "track": "internal",
      "releaseStatus": "draft"
    }
  }
}
```

## 📝 Checklist перед билдом

- [ ] Обновлена версия в `app.json` (`version`)
- [ ] Обновлен build number в `app.json` (`ios.buildNumber`, `android.versionCode`)
- [ ] Обновлен CHANGELOG.md с изменениями
- [ ] Все коммиты запушены в git
- [ ] Проверено что `.sentryclirc` существует локально

## 🔐 Требования

### Sentry

- Auth token настроен в `.sentryclirc`
- Проект: `dutch-learning-app`
- Organization: `oldrefery`

### iOS

- Apple Team ID: `7FQ395U52U`
- App Store Connect App ID: `6738736062`
- Bundle ID: `com.oldrefery.dutch-learning-app`

### Android

- Package: `com.oldrefery.dutchlearningapp`
- Track: `internal` (для initial testing)
- Release status: `draft` (требует ручной активации)

## 🚀 Полный процесс релиза

1. **Подготовка**:

   ```bash
   # Обновить версию и build number
   # Обновить CHANGELOG.md
   git add .
   git commit -m "chore: bump version to 1.4.0 build 40"
   git push
   ```

2. **Билд и отправка**:

   ```bash
   eas build --platform all --profile production --auto-submit
   ```

3. **Проверка Sentry**:
   - Проверить что sourcemaps загрузились
   - Проверить что release создан

4. **iOS - TestFlight**:
   - Дождаться обработки билда в TestFlight (~10-30 минут)
   - Добавить release notes
   - Отправить на External Testing или Submit for Review

5. **Android - Google Play**:
   - Открыть Google Play Console
   - Перейти в Internal Testing
   - Изменить статус с draft на active
   - Опционально: продвинуть на Closed Testing или Production

## 📚 Полезные ссылки

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Automate Submissions](https://docs.expo.dev/build/automate-submissions/)
- [Sentry Sourcemaps for Expo](https://docs.sentry.io/platforms/react-native/sourcemaps/uploading/expo/)
- [App Store Connect](https://appstoreconnect.apple.com/)
- [Google Play Console](https://play.google.com/console/)
