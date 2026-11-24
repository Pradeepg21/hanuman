# Getting a real 3D Bal Hanuman into the game

The game ships with a built-in Bal Hanuman made from simple 3D shapes (`app/src/main/assets/game/js/models.js`).
For a smooth, detailed, properly animated hero, add a real model. **No code changes are needed**.

## 1. Make a reference image
Use an image you own or generate one, for example with an AI image tool. Don't use someone else's artwork (Pinterest, etc.) in the game.
Good prompt: *"Cute chibi Bal Hanuman, full body, T-pose, front view, big head, big eyes, peach face,
tilak, tall gold crown with red gem, yellow dhoti with red sash, gold jewellery, curled tail, plain white background, 3D render"*.
A **T-pose** (arms straight out) makes the next steps much easier.

## 2. Turn the image into a 3D model
Image-to-3D tools: **Meshy** (meshy.ai), **Tripo3D** (tripo3d.ai), or a 3D artist (Fiverr / Blender).
Export as **FBX** or **GLB**. Keep it light for phones: under ~30k triangles, textures 1024–2048 px.

## 3. Rig and animate it (free)
Upload the model to **Mixamo** (mixamo.com) and let it auto-rig. Download these animations
(FBX, "With Skin" for the first one, then "Without Skin" for the rest, 30 fps):

| Name the clip | Mixamo search |
|---|---|
| `Idle` | "Happy Idle" or "Breathing Idle" |
| `Run` | "Fast Run" |
| `Jump` | "Jump" (in place) |
| `Slide` | "Running Slide" |
| `Fly` | "Flying" |
| `Attack` | "Standing Melee Attack" or "Sword Slash" |
| `Death` | "Falling Back Death" |

Combine them into one **.glb** in Blender (File > Import FBX for each, then File > Export > glTF Binary,
with "Animation" checked and NLA tracks named as above). Names only need to *contain* those words.

## 4. Drop it in
Save it as:

```
app/src/main/assets/game/models/hanuman.glb
```

Rebuild the app. The game automatically uses it instead of the built-in hero, scales it to the right height and plays the
matching animations. Any animation that's missing is faked (e.g. no `Fly` clip: it tilts the run animation).

## Troubleshooting
- **Runs backwards / faces the camera:** in `app/src/main/assets/game/js/heroglb.js` change `rotateY: Math.PI` to `rotateY: 0`.
- **Too big / small:** change `height: 1.9` in the same file.
- **Burning tail in Lanka Dahan comes from the wrong place:** name the tail bones `Tail...` in Blender.
- **Model doesn't appear:** check the file name is exactly `hanuman.glb` and that it's a binary glTF (.glb), not .gltf + .bin.
