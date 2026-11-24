# Google Play store listing: Hanuman Run

Everything needed for **Main store listing** in Play Console (closed testing uses the same listing).

## App name (max 30): 26 characters
```
Hanuman Run: Leap to Lanka
```

## Short description (max 80): 73 characters
```
Run, jump and smash rakshasas as Bal Hanuman on an epic 3D leap to Lanka!
```

## Full description (max 4000)
```
Jai Shri Ram! Join Bal Hanuman on his legendary leap from Kishkindha to Lanka in this colourful 3D endless runner.

Run through the jungle, cross the ocean on the floating stones of Ram Setu, race through the golden streets of Lanka and set it ablaze. A giant rakshasa is chasing you the whole way. Don't let him catch you!

HOW TO PLAY
• Swipe left or right to switch lanes, and to turn at every junction
• Swipe up to jump over logs, fire and gaps
• Swipe down to slide under branches and arches
• Tap to swing your golden gada and smash rakshasas out of your way

FOUR WORLDS
• Kishkindha Forest: ancient temples and jungle paths
• Ram Setu: stones marked with "राम" floating across the sea
• Golden Lanka: Ravana's city of gold, guarded by rakshasas
• Lanka Dahan: Hanuman's burning tail sets the city on fire!

DIVINE POWER-UPS
• Vayu Flight: soar above the path like the son of the wind god
• Virat Roop: grow giant and crush everything in your way
• Ram Kavach: a divine shield that protects you from one crash
• Coin Magnet and Double Coins to fill your treasury

MORE TO DO
• Collect coins and rare gems
• Upgrade every power-up in the shop
• Complete missions to raise your score multiplier
• Use gems to revive and keep running
• Beat your best score and see how far you can go

Bright 3D graphics, a tabla and flute soundtrack, and simple swipe controls make it fun for the whole family. Plays fully offline, with no ads and no in-app purchases.

Jai Hanuman! How far can you run?
```

## Category and tags
- **App category:** Game > Arcade (alternative: Action)
- **Tags:** Endless runner, Arcade, Casual, Offline

## Graphics (files in this `store/` folder)
| Asset | File | Play requirement |
|---|---|---|
| App icon | `icon-512.png` | 512 × 512 PNG |
| Feature graphic | `feature-graphic.png` | 1024 × 500 PNG |
| Character art (source) | `art/bal-hanuman.svg` | Vector, reuse for banners and social posts |
| Phone screenshots (6) | `screenshots/1-menu.png` … `6-lanka-dahan.png` | 2–8 images, 1080 × 1920 |

Upload the screenshots in numbered order; the first two show in search results.

## Other Play Console sections needed before closed testing
- **Privacy policy URL:** required for every app. The policy is `docs/privacy-policy.md` in the GitHub repo.
  Enable GitHub Pages (Settings > Pages > branch `develop`, folder `/docs`) and use
  `https://pradeepg21.github.io/hanuman/privacy-policy` (the repo must be public for Pages on a free account).
- **Data safety:** "No data collected" and "No data shared".
- **Ads:** "No, my app does not contain ads".
- **Content rating:** fill in the IARC questionnaire. Cartoon fantasy violence (smashing demons) usually rates PEGI 7 / Everyone 10+.
- **Target audience:** choosing ages **13+** keeps setup simple. Choosing under-13 brings in the Families policy and extra review.
- **App access:** "All functionality is available without special access".
- **Closed testing:** Testing > Closed testing > create a track, add testers by email list, upload `app-release.aab` (see `RELEASING.md`).
