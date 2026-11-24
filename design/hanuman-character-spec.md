# Hanuman: Character Spec (Hanuman Run)

> **Style update (Nov 2026): the game hero is now Bal Hanuman (cute, chibi).** This replaces the adult look described
> below wherever they differ: big round head (about 1/3 of total height), large eyes with highlights, peach-pink face
> (`#F3A47E`) with a lighter muzzle and pink cheeks, big ears, long dark-brown hair, white-and-red tilak, a tall gold crown
> with a **red** gem, gold necklaces and jewellery, a **yellow** dhoti (`#F6A51E`) with a red sash (`#E5483A`), bare feet,
> curled tail with a dark tuft, gold gada on the left shoulder. The built-in model is in
> `app/src/main/assets/game/js/models.js`; see [`3d-model-guide.md`](3d-model-guide.md) to replace it with a real 3D model.

Reference image: [`reference/hanuman-reference.png`](reference/hanuman-reference.png)

This is the master description of the hero for **Hanuman Run**. Every sprite, 3D model, icon and AI-generated image should match it. If anything here conflicts with the earlier animated concept (`hanuman-run-character.html`), this spec wins.

---

## 1. Overview

| | |
|---|---|
| Name | Hanuman (Pawan Putra, Bajrang Bali) |
| Role | Player hero, endless runner |
| Personality | Calm, fearless, devoted, quietly confident; a gentle smile, never angry |
| Art style | Clean 2D cartoon in the style of Indian animated mythology films: smooth cel shading, soft gradients, a thin dark-brown outline (not black) |
| Body type | Heroic and muscular, about 7.5 heads tall, broad shoulders, narrow waist, strong legs |
| Default pose | Standing in 3/4 view facing the viewer's left, gada resting on his left shoulder, weight on both feet |

---

## 2. Color palette

| Token | Hex | Used for |
|---|---|---|
| `skin` | `#C8875A` | body skin, a warm tan-brown |
| `skin_shadow` | `#9E6440` | muscle shading, under the arms, under the chest |
| `skin_highlight` | `#E0A97C` | shoulders, chest and shin highlights |
| `face` | `#E8B98E` | lighter muzzle and inner face |
| `hair` | `#4A2A18` | beard, sideburns, hair framing the face, tail tuft |
| `gold` | `#E2A92B` | crown, gada, all jewellery |
| `gold_light` | `#FFE08A` | metal highlights |
| `gold_dark` | `#9C6A14` | metal shadows and engraving lines |
| `dhoti` | `#8B2E1E` | dhoti cloth, a deep maroon red-brown |
| `dhoti_shadow` | `#5E1C12` | folds |
| `jewel` | `#2FA39A` | teal gem on the crown |
| `eye` | `#2A160C` | pupils |
| `outline` | `#3A2214` | line art |

```json
{
  "skin": "#C8875A", "skin_shadow": "#9E6440", "skin_highlight": "#E0A97C",
  "face": "#E8B98E", "hair": "#4A2A18",
  "gold": "#E2A92B", "gold_light": "#FFE08A", "gold_dark": "#9C6A14",
  "dhoti": "#8B2E1E", "dhoti_shadow": "#5E1C12",
  "jewel": "#2FA39A", "eye": "#2A160C", "outline": "#3A2214"
}
```

---

## 3. Head and face

- **Face shape:** mostly human, with a slightly monkey-like muzzle. It is not a full monkey snout.
- **Muzzle:** a lighter `face`-coloured area around the mouth and nose. The mouth is set a little forward.
- **Beard and hair:** a thick dark-brown (`hair`) beard and sideburns that frame the whole face from the temples to the chin, like a mane. The chin is covered.
- **Eyes:** large, almond-shaped, dark-brown pupils, a kind expression. The eyebrows are thick and dark.
- **Nose:** small, broad, slightly flat.
- **Expression:** a soft, confident closed-mouth smile.
- **Ears:** small, mostly hidden by the hair.

## 4. Crown (mukut)

- A tall, conical, gold crown with several tiers that rises to a pointed tip with a small finial.
- A band across the forehead with engraved patterns.
- **One teal gem (`jewel`)** in the centre of the front of the band.
- It covers the top of the head; a little hair shows below it at the sides.

## 5. Gada (mace)

- The signature weapon, always gold.
- **Head:** a large round or oval head made of vertical ribbed segments (like a melon), with a small spike or finial on top and a decorative collar where it meets the shaft.
- **Shaft:** a thick gold shaft with ring bands and a small round pommel at the bottom.
- **Size:** the head is about 1.3 times the width of his head. The total length runs from his shoulder down to about mid-thigh.
- **Default carry:** rested on his **left shoulder**, held by his left hand at chest height, with the head of the gada behind and above that shoulder.

## 6. Body and clothing

- **Torso:** bare chest, well-defined pecs and abs, shaded with `skin_shadow`.
- **Necklace:** a simple gold chain or torc at the base of the neck.
- **Armbands (bajuband):** a thick gold band on each upper arm.
- **Bracelets (kada):** a thick gold band on each wrist.
- **Waist:** a gold belt or sash band.
- **Dhoti:** a maroon (`dhoti`) wrap that ends above the knee, with a **gold border** along the hem. A front panel of cloth hangs down between the legs, slightly longer than the sides, also trimmed in gold.
- **Anklets:** a thick gold band on each ankle.
- **Feet:** bare.

## 7. Tail

- Long: about as long as his own height.
- It starts at the lower back and hangs down behind the legs, then sweeps out to one side.
- **It ends in a big curl** (an S-curve or hook) with a **dark-brown tuft** (`hair`) at the tip.
- The tail is `skin` coloured, as thick as a wrist at the base and tapering towards the tip.

---

## 8. Proportions (unit = 1 head height)

| Part | Size |
|---|---|
| Total height | 7.5 heads (8.3 heads to the top of the crown) |
| Crown height above the head | 0.8 heads |
| Shoulder width | 2.4 heads |
| Waist width | 1.3 heads |
| Hip to floor | 3.8 heads |
| Gada head diameter | 1.3 heads |
| Tail length | about 7 heads |

---

## 9. Turnaround checklist

For model sheets or 3D, provide: **front, 3/4 front, side, 3/4 back, back**. Check:
- the teal gem shows only from the front and 3/4 views
- the tail comes from the middle of the lower back
- the dhoti hem's gold border goes all the way around
- the gada stays on the left shoulder in every view

---

## 10. Game animation set (Hanuman Run)

| Animation | Frames (12 fps) | Notes |
|---|---|---|
| Idle | 8 | breathing, tail sways gently, gada stays on shoulder |
| Run | 8 (loop) | leans forward about 10°, free arm pumps, gada stays on shoulder, tail streams behind |
| Jump | 6 | knees tucked, tail curls up |
| Slide | 4 + hold | low crouch, gada held flat across the body |
| Turn L/R | 4 | leans into the turn, tail swings out the opposite way |
| Gada smash | 6 | two-handed overhead swing that breaks obstacles |
| Vayu boost (fly) | 6 (loop) | body horizontal, right fist forward, gada in the left hand, golden aura |
| Fall / fail | 8 | stumbles, gada drops, sits up dazed |

The camera for the runner is behind the character, so the **back view and 3/4 back view matter most**. The crown silhouette, the gada over the shoulder and the curled tail must still read clearly from behind.

### Sprite and asset sizes
- Master art: 1024 × 1536 px, transparent PNG, or vector (SVG)
- In-game sprite: 256 × 384 px at xxhdpi; scale the rest from that
- App icon: head and crown only, gada in the background, on a saffron-to-maroon circle

---

## 11. Do / Don't

**Do**
- keep his expression calm and kind
- keep all metal gold and all cloth maroon
- keep the outline dark brown and consistent in thickness

**Don't**
- give him bright-orange or red skin; the skin is tan-brown
- show anger, teeth or fangs
- give him shoes, a shirt or any modern items
- make the gada silver or black
- remove the beard or the tail curl

---

## 12. AI image-generation prompt

> Full-body 2D cartoon illustration of Lord Hanuman, Indian animated mythology film style, clean cel shading, thin dark-brown outlines. Muscular heroic build, warm tan-brown skin, kind almond eyes, gentle closed-mouth smile, a slightly monkey-like light muzzle, and a thick dark-brown beard and sideburns framing the face. A tall conical gold crown with a teal gem at the centre of the forehead band. A large ribbed gold gada (mace) rests on his left shoulder, held in his left hand. Bare chest with a gold necklace, gold armbands, gold wrist bracelets and gold anklets. A short maroon dhoti with a gold border and a front cloth panel, and a gold waist belt. Bare feet. A long tail curling at the end with a dark-brown tuft. 3/4 standing pose, plain background.

**Negative prompt:** realistic photo, 3D render, angry, fangs, shoes, shirt, armour, silver weapon, bright orange skin, extra limbs, cropped feet, text, watermark.

For a specific view, add one of these to the prompt: "back view, running away from camera", "side view, mid-jump" or "flying horizontally, golden aura".
