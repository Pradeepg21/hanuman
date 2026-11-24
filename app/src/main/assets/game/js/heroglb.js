'use strict';
/* Optional real 3D hero model.
   Drop a rigged, animated glTF binary at  assets/game/models/hanuman.glb  and the game uses it
   instead of the built-in procedural Bal Hanuman. Animation clips are matched by name
   (case-insensitive, partial match), e.g. "Idle", "Run", "Jump", "Slide", "Fly", "Attack", "Death".
   Missing clips fall back gracefully (e.g. no "Fly" clip: the run clip is played with the body tilted). */
const HERO_GLB = {
  url: 'models/hanuman.glb',
  height: 1.9,          // model is scaled so its total height is this many metres
  rotateY: Math.PI,     // glTF models usually face +Z; the hero must face -Z (away from the camera)
  clips: {
    idle: ['idle', 'stand', 'breath', 'pray', 'namaste'],
    run: ['run', 'sprint', 'jog', 'walk'],
    jump: ['jump', 'leap', 'hop'],
    slide: ['slide', 'roll', 'crouch', 'duck'],
    fly: ['fly', 'flying', 'superman', 'float'],
    smash: ['attack', 'smash', 'swing', 'punch', 'strike', 'hit'],
    crash: ['death', 'die', 'dying', 'knock', 'fall'],
    fall: ['fall', 'falling', 'death', 'die'],
  },
};

function loadHeroGLB(onLoaded) {
  if (!THREE.GLTFLoader) return;
  new THREE.GLTFLoader().load(HERO_GLB.url, gltf => {
    try { onLoaded(wrapHeroGLB(gltf)); } catch (e) { console.warn('hanuman.glb could not be used:', e); }
  }, undefined, () => { /* no custom model: keep the built-in hero */ });
}

function wrapHeroGLB(gltf) {
  const T = THREE;
  const root = new T.Group();
  const body = new T.Group(); root.add(body);
  const model = gltf.scene;
  model.rotation.y = HERO_GLB.rotateY;
  body.add(model);

  // normalise size and put the feet on the ground, centred
  model.updateMatrixWorld(true);
  let box = new T.Box3().setFromObject(model);
  const h = Math.max(0.001, box.max.y - box.min.y);
  model.scale.multiplyScalar(HERO_GLB.height / h);
  model.updateMatrixWorld(true);
  box = new T.Box3().setFromObject(model);
  const c = box.getCenter(new T.Vector3());
  model.position.x -= c.x; model.position.z -= c.z; model.position.y -= box.min.y;

  let tailTip = null;
  model.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; }
    if (!tailTip && /tail/i.test(o.name)) tailTip = o;
  });
  // where the burning-tail fire comes from (a "tail" bone if the model has one)
  const tuft = new T.Object3D();
  if (tailTip) { let last = tailTip; while (last.children && last.children.find(k => /tail/i.test(k.name))) last = last.children.find(k => /tail/i.test(k.name)); last.add(tuft); }
  else { tuft.position.set(0, HERO_GLB.height * 0.35, 0.35); body.add(tuft); }

  const mixer = new T.AnimationMixer(model);
  const findClip = keys => {
    for (const k of keys) {
      const clip = gltf.animations.find(a => a.name.toLowerCase().includes(k));
      if (clip) return clip;
    }
    return null;
  };
  const clips = {};
  for (const mode in HERO_GLB.clips) clips[mode] = findClip(HERO_GLB.clips[mode]);
  const fallback = clips.run || clips.idle || gltf.animations[0] || null;
  const actions = {};
  const actionFor = clip => {
    if (!clip) return null;
    if (!actions[clip.uuid]) actions[clip.uuid] = mixer.clipAction(clip);
    return actions[clip.uuid];
  };
  const once = ['jump', 'smash', 'crash', 'fall'];
  let current = null, currentKey = '';

  function play(mode) {
    const clip = clips[mode] || (mode === 'fly' || mode === 'slide' || mode === 'jump' ? clips.run : null) || (mode === 'idle' ? clips.idle : null) || fallback;
    const key = mode + ':' + (clip ? clip.uuid : '');
    if (key === currentKey) return;
    currentKey = key;
    const next = actionFor(clip);
    if (!next) return;
    next.reset();
    const playOnce = once.includes(mode) && clips[mode] === clip;
    next.setLoop(playOnce ? T.LoopOnce : T.LoopRepeat, Infinity);
    next.clampWhenFinished = playOnce;
    next.enabled = true;
    if (current && current !== next) { next.play(); current.crossFadeTo(next, 0.15, false); }
    else next.play();
    current = next;
  }

  const aura = new T.Mesh(new T.SphereGeometry(1, 24, 16), MODELS.fresnelMat(0xffc040, 1.4));
  aura.scale.set(0.75, 1.15, 0.75); aura.position.y = 0.95; aura.visible = false; root.add(aura);
  const shield = new T.Mesh(new T.IcosahedronGeometry(1, 3), MODELS.fresnelMat(0x6fd8ff, 1.0));
  shield.scale.setScalar(1.2); shield.position.y = 0.95; shield.visible = false; root.add(shield);

  const J = { root, body, tuft, aura, shield, isGLB: true };
  J.animate = (st, dt) => {
    let mode = st.mode;
    if (st.smash >= 0 && clips.smash && (mode === 'run' || mode === 'idle')) mode = 'smash';
    play(mode);
    if (current) current.timeScale = mode === 'run' ? 1.25 : 1;
    // poses the clips can't express get a body tilt instead
    const k = 1 - Math.exp(-dt * 12);
    const tiltX = mode === 'fly' && !clips.fly ? -1.25 : mode === 'slide' && !clips.slide ? 0.6 : 0;
    const liftY = mode === 'fly' && !clips.fly ? 1.0 : mode === 'slide' && !clips.slide ? -0.35 : 0;
    const sy = mode === 'slide' && !clips.slide ? 0.6 : 1;
    body.rotation.x += (tiltX - body.rotation.x) * k;
    body.rotation.z += ((st.lean || 0) - body.rotation.z) * k;
    body.position.y += (liftY - body.position.y) * k;
    body.scale.y += (sy - body.scale.y) * k;
    aura.material.uniforms.uTime.value = st.t; shield.material.uniforms.uTime.value = st.t; shield.rotation.y = st.t * 0.6;
    mixer.update(dt);
  };
  J.animate({ mode: 'idle', t: 0, smash: -1 }, 0);
  return J;
}
