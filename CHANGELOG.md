# Changelog

Newest first. Every build sent to testers gets an entry (see [RELEASING.md](RELEASING.md)).
Format: `## versionName (versionCode): date`.

## 1.1.2 (4): 2026-11-23
- New hand-drawn Bal Hanuman cartoon illustration for the app icon and the Play Store feature graphic.

## 1.1.1 (3): 2026-11-23
- New app icon: Bal Hanuman with his crown and gada on a saffron background (replaces the default Android icon).
- Menu camera frames Hanuman a little higher so the buttons don't cover him.
- Game files are always loaded fresh after an update (no stale cached version).
- Store listing assets added in `store/` (icon, feature graphic, screenshots, descriptions).

## 1.1.0 (2): 2026-11-23
- New hero look: **Bal Hanuman** with a big head and eyes, peach face, tilak, tall gold crown with a red gem, yellow dhoti with a red sash, and gold jewellery.
- The game can now load a real 3D hero model (`models/hanuman.glb`) with animations. See `design/3d-model-guide.md`.
- Game camera and chasing rakshasa adjusted to the smaller hero.
- Settings now shows the app version, so testers can report it with bugs.
- Release signing setup for publishing test builds.

## 1.0.0 (1): 2026-11-22
- First version of Hanuman Run: 3D endless runner from Kishkindha to Lanka, played from behind the hero.
- Lanes, 90° turns, jump, slide, gada smash; rakshasa enemies and a chasing demon.
- Four areas: Kishkindha Forest, Ram Setu across the ocean, Golden Lanka, Lanka Dahan.
- Coins, gems, five power-ups, shop upgrades, missions, score multiplier, revive.
- Synthesised music and sound, vibration, automatic graphics quality for slower phones.
