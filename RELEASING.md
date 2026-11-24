# Hanuman Run: Release & Versioning Spec

This spec defines how every change to Hanuman Run is versioned and published for testing.

## 1. The rule: every change gets a new version

**Any change that goes into a build, however small (code, game assets, graphics, text or config), must update the release version before it is built for testing.**

Google Play rejects an upload whose `versionCode` was already used, and testers need to know which build they have.

## 2. Where the version lives

One place only: `app/build.gradle.kts`, in `defaultConfig`:

```kotlin
versionCode = 2          // whole number, +1 for EVERY build you upload. Never reuse, never go down.
versionName = "1.1.0"    // what testers see: MAJOR.MINOR.PATCH
```

The game shows the installed version in **Settings** (e.g. `Hanuman Run · v1.1.0 (2)`), so testers can report it with bugs.

## 3. How to bump

| Kind of change | Example | versionName | versionCode |
|---|---|---|---|
| Bug fix, tuning, small visual tweak | coins too dark, jump height | `1.1.0` to `1.1.1` | +1 |
| New feature or content | new power-up, new biome, new hero model | `1.1.1` to `1.2.0` | +1 |
| Big redesign / incompatible save data | new game mode, reset progress | `1.2.0` to `2.0.0` | +1 |
| Re-upload of the same code (e.g. a failed upload) | | unchanged | +1 |

`versionCode` always goes up by exactly 1, whatever kind of change it is.

## 4. Checklist for every change

1. Make the change.
2. Bump `versionCode` (+1) and `versionName` (per the table) in `app/build.gradle.kts`.
3. Add an entry at the top of [`CHANGELOG.md`](CHANGELOG.md): version, date, and what changed, written for testers.
4. Build and test on a phone (debug build).
5. Build the release bundle (section 6) and upload it to the testing track.
6. Paste the changelog entry into the release notes ("What to test").

## 5. One-time setup: release signing key

Play needs every release signed with the **same** key. Create it once:

```bash
keytool -genkeypair -v -keystore hanuman-release.jks -alias hanuman -keyalg RSA -keysize 2048 -validity 10000
```

Put `hanuman-release.jks` in the project root, then create `keystore.properties` next to it:

```properties
storeFile=hanuman-release.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=hanuman
keyPassword=YOUR_KEY_PASSWORD
```

Both files are in `.gitignore`. **Back up the .jks file and the passwords somewhere safe.** If you lose them, you can't update the app
(with Play App Signing, Google can reset an upload key, but it takes time).

## 6. Building a release

```bash
./gradlew bundleRelease      # app/build/outputs/bundle/release/app-release.aab  -> Google Play
./gradlew assembleRelease    # app/build/outputs/apk/release/app-release.apk     -> direct install / Firebase
```

In Android Studio, use **Build > Generate Signed App Bundle / APK** instead.

## 7. Publishing for testing

**Google Play internal testing** (recommended; testers install from the Play Store):
1. Play Console > create app "Hanuman Run" (once) > Testing > **Internal testing** > Create new release.
2. Upload `app-release.aab`, paste the changelog entry into release notes, then Save and Roll out.
3. Testers tab: add tester emails (up to 100) and share the opt-in link.

**Firebase App Distribution** (no Play review; testers get an email):
```bash
firebase appdistribution:distribute app/build/outputs/apk/release/app-release.apk --app <FIREBASE_APP_ID> --release-notes "1.1.0 (2): ..." --testers "a@example.com"
```

## 8. Before each upload

- [ ] `versionCode` is higher than the last uploaded build
- [ ] `versionName` matches the new CHANGELOG entry
- [ ] Played one full run on a real phone: menu, run, turn, smash, power-up, death, revive, game over
- [ ] Settings shows the new version number
