# Hanuman Run: project instructions

Android app (`com.satya.hanuman`): a 3D endless runner. The game is Three.js r149 (classic scripts) in
`app/src/main/assets/game/`, hosted by a full-screen WebView in `app/src/main/java/com/satya/hanuman/MainActivity.kt`.

## Release version: update it on EVERY change
Every change that ends up in a build (code, assets, graphics, text, config) must also, in the same piece of work:
1. Bump `versionCode` by 1 and `versionName` (patch for fixes/tweaks, minor for features, major for redesigns) in `app/build.gradle.kts`.
2. Add a tester-facing entry at the top of `CHANGELOG.md`: `## versionName (versionCode): YYYY-MM-DD`.
One bump per round of changes the user will test, not one per file edit. Full rules: `RELEASING.md`.
Never commit `keystore.properties` or `*.jks`.

## Design
- Hero look: Bal Hanuman, per `design/hanuman-character-spec.md` (style update at the top).
- Optional real model: `app/src/main/assets/game/models/hanuman.glb`, see `design/3d-model-guide.md`.

## Testing
The local emulator renders WebGL at ~1 fps, so it's useless for visual checks. Smoke-test in headless Chrome (puppeteer-core,
`--use-angle=swiftshader`) against `assets/game/index.html`. Use `window.__game.simulate(seconds)` to fast-forward and
`window.__game.P` / `.run` to inspect state. Then build with `./gradlew assembleDebug`.
