'use strict';
/* Procedural 3D models: Hanuman (hero) and Rakshasas (enemies).
   Built from primitives so the game needs no external model files.
   Hero follows design/hanuman-character-spec.md (colours, crown, gada, tail). */
THREE.ColorManagement.legacyMode = false;

const MODELS = (() => {
  const T = THREE;
  const PI = Math.PI;

  function std(color, rough, metal, emissive, emissiveI) {
    const m = new T.MeshStandardMaterial({ color, roughness: rough == null ? 0.7 : rough, metalness: metal || 0 });
    if (emissive != null) { m.emissive = new T.Color(emissive); m.emissiveIntensity = emissiveI == null ? 1 : emissiveI; }
    return m;
  }
  function mesh(geo, mat, x, y, z, parent, shadow) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = shadow !== false;
    if (parent) parent.add(m);
    return m;
  }
  const cyl = (rt, rb, h, s, open) => new T.CylinderGeometry(rt, rb, h, s || 14, 1, !!open);
  const sph = (r, w, h) => new T.SphereGeometry(r, w || 16, h || 12);
  const tor = (r, t, rs, ts) => new T.TorusGeometry(r, t, rs || 6, ts || 18);
  const ring = (r, t) => { const g = tor(r, t); g.rotateX(PI / 2); return g; };

  function ribbedSphere(r, ribs, depth) {
    const g = new T.SphereGeometry(r, 28, 18);
    const p = g.attributes.position;
    const v = new T.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const phi = Math.atan2(v.z, v.x);
      const k = 1 + depth * Math.cos(ribs * phi) * Math.sqrt(Math.max(0, 1 - (v.y / r) * (v.y / r)));
      p.setXYZ(i, v.x * k, v.y * 1.08, v.z * k);
    }
    g.computeVertexNormals();
    return g;
  }

  // ---------------------------------------------------------------- HERO (Bal Hanuman)
  // Cute, chibi proportions: big round head (~1/3 of height), large eyes, peach-pink face,
  // big ears, tilak, tall gold crown with a red gem, yellow dhoti with a red sash.
  let heroMats = null;
  function skinMat(color, rough) {
    const m = std(color, rough == null ? 0.55 : rough);
    m.emissive = new T.Color(color); m.emissiveIntensity = 0.14;   // warm, soft "painted" look; shadows never go muddy
    return m;
  }
  function getHeroMats() {
    if (heroMats) return heroMats;
    heroMats = {
      skin: skinMat(0xF3A47E), skinLight: skinMat(0xF8C4A2), cheek: skinMat(0xF07D6E, 0.6),
      ear: skinMat(0xEE8C70), earIn: skinMat(0xF6B39A), nose: skinMat(0xE8705E, 0.4),
      hair: std(0x4E2814, 0.75), hairHi: std(0x6E3A1E, 0.7),
      gold: std(0xE8B030, 0.25, 0.95), goldLight: std(0xFFE08A, 0.2, 1), goldDark: std(0xA87418, 0.35, 0.9),
      dhoti: skinMat(0xF6A51E, 0.7), dhotiDark: skinMat(0xE08A10, 0.75), sash: skinMat(0xE5483A, 0.7),
      ruby: std(0xE0102A, 0.15, 0.3, 0xB00018, 0.6),
      eyeW: std(0xFFFFFF, 0.3), iris: std(0x7A4422, 0.25), pupil: std(0x1A0C06, 0.2), shine: new T.MeshBasicMaterial({ color: 0xffffff }),
      line: std(0x2A140A, 0.5), mouth: std(0x9A2A22, 0.5), tilakW: std(0xFFFFFF, 0.5), tilakR: std(0xE01818, 0.4),
    };
    return heroMats;
  }

  function buildHanuman() {
    const m = getHeroMats();
    const root = new T.Group();
    const body = new T.Group(); root.add(body);
    const PELVIS = 0.58;
    const pelvis = new T.Group(); pelvis.position.y = PELVIS; body.add(pelvis);
    const torso = new T.Group(); pelvis.add(torso);

    // --- chubby torso (front faces -Z)
    mesh(sph(0.2, 24, 18), m.skin, 0, 0.17, -0.01, torso).scale.set(1.05, 1.0, 0.92);     // belly
    mesh(sph(0.185, 24, 18), m.skin, 0, 0.33, 0, torso).scale.set(1.15, 0.85, 0.85);      // chest
    // gold belt with an ornament
    mesh(cyl(0.205, 0.215, 0.07, 24), m.gold, 0, 0.03, 0, torso).scale.set(1.05, 1, 0.95);
    mesh(new T.CylinderGeometry(0.055, 0.055, 0.03, 16), m.gold, 0, 0.03, -0.205, torso).rotation.x = PI / 2;
    mesh(new T.OctahedronGeometry(0.025), m.ruby, 0, 0.03, -0.225, torso);
    // necklaces (two strands + pendant)
    for (const [r, y, tilt] of [[0.13, 0.43, 0.45], [0.16, 0.4, 0.6]]) {
      const n = mesh(tor(r, 0.014, 8, 28), m.gold, 0, y, -0.03, torso); n.rotation.x = PI / 2 - tilt; n.scale.set(1.1, 1, 1);
    }
    mesh(sph(0.028, 10, 8), m.ruby, 0, 0.33, -0.17, torso);
    mesh(cyl(0.07, 0.08, 0.1), m.skin, 0, 0.47, 0, torso);                                   // neck

    // --- head
    const head = new T.Group(); head.position.set(0, 0.74, -0.02); torso.add(head);
    mesh(sph(0.3, 32, 24), m.skin, 0, 0, 0, head).scale.set(1, 0.96, 0.95);
    mesh(sph(0.14, 24, 18), m.skinLight, 0, -0.11, -0.2, head).scale.set(1.15, 0.62, 0.6); // light muzzle
    // hair: back cap, long locks to the shoulders, fringe under the crown
    mesh(sph(0.315, 28, 20), m.hair, 0, 0.0, 0.05, head).scale.set(1.04, 1.0, 0.95);
    for (const sx of [-1, 1]) {
      const lk = mesh(sph(0.12, 16, 12), m.hair, sx * 0.24, -0.2, 0.06, head); lk.scale.set(0.75, 1.5, 0.95); lk.rotation.z = sx * 0.25;
      const lk2 = mesh(sph(0.1, 14, 10), m.hairHi, sx * 0.2, -0.33, 0.12, head); lk2.scale.set(0.8, 1.2, 0.8); lk2.rotation.z = sx * 0.5;
      mesh(sph(0.09, 14, 10), m.hair, sx * 0.17, 0.15, -0.22, head).scale.set(1.2, 0.55, 0.6);   // fringe
    }
    mesh(sph(0.16, 20, 14), m.hair, 0, -0.18, 0.2, head).scale.set(1.5, 1.2, 0.8);           // back hair
    // big ears
    for (const sx of [-1, 1]) {
      const e = mesh(sph(0.1, 18, 14), m.ear, sx * 0.31, -0.02, 0.0, head); e.scale.set(0.45, 0.95, 0.85);
      const ei = mesh(sph(0.07, 16, 12), m.earIn, sx * 0.345, -0.02, -0.01, head); ei.scale.set(0.25, 0.85, 0.75);
      mesh(sph(0.025, 10, 8), m.gold, sx * 0.33, -0.12, -0.02, head);                       // earring
      mesh(sph(0.018, 8, 6), m.goldLight, sx * 0.33, -0.16, -0.02, head);
    }
    // big cartoon eyes
    for (const sx of [-1, 1]) {
      const ex = sx * 0.11;
      const w = mesh(sph(0.082, 24, 18), m.eyeW, ex, 0.02, -0.235, head); w.scale.set(0.85, 1.05, 0.5);
      const ir = mesh(sph(0.06, 20, 16), m.iris, ex + sx * 0.004, 0.0, -0.262, head); ir.scale.set(0.85, 1.05, 0.45);
      const pu = mesh(sph(0.032, 16, 12), m.pupil, ex + sx * 0.004, 0.0, -0.283, head); pu.scale.set(0.9, 1.05, 0.4);
      mesh(sph(0.016, 8, 6), m.shine, ex - 0.02, 0.03, -0.292, head, false);
      mesh(sph(0.008, 6, 4), m.shine, ex + 0.018, -0.022, -0.29, head, false);
      const lash = mesh(new T.TorusGeometry(0.07, 0.011, 6, 18, PI * 0.9), m.line, ex, 0.02, -0.258, head, false);
      lash.rotation.z = PI * 0.05; lash.scale.set(1.0, 1.1, 1);
      const brow = mesh(new T.TorusGeometry(0.06, 0.008, 6, 14, PI * 0.6), m.hair, ex, 0.12, -0.26, head, false);
      brow.rotation.z = PI * 0.2;
      const ck = mesh(sph(0.05, 14, 10), m.cheek, sx * 0.17, -0.1, -0.225, head); ck.scale.set(1.1, 0.7, 0.35);
    }
    mesh(sph(0.035, 14, 10), m.nose, 0, -0.08, -0.3, head).scale.set(1.3, 0.85, 0.8);      // small pink nose
    const smile = mesh(new T.TorusGeometry(0.05, 0.01, 6, 16, PI), m.mouth, 0, -0.14, -0.282, head, false);
    smile.rotation.z = PI; smile.rotation.x = -0.25;
    // tilak: white U with a red line
    for (const sx of [-1, 1]) { const tw = mesh(new T.BoxGeometry(0.014, 0.06, 0.01), m.tilakW, sx * 0.02, 0.135, -0.276, head, false); tw.rotation.set(-0.42, 0, sx * 0.25); }
    mesh(new T.BoxGeometry(0.045, 0.012, 0.01), m.tilakW, 0, 0.107, -0.284, head, false).rotation.x = -0.38;
    mesh(new T.BoxGeometry(0.013, 0.055, 0.01), m.tilakR, 0, 0.14, -0.28, head, false).rotation.x = -0.42;

    // --- crown (tall, ornate, red gem)
    const crown = new T.Group(); crown.position.y = 0.235; head.add(crown);
    mesh(cyl(0.25, 0.27, 0.1, 30), m.gold, 0, 0, 0, crown).scale.set(1, 1, 0.95);
    mesh(ring(0.265, 0.014), m.goldDark, 0, -0.045, 0, crown);
    mesh(ring(0.252, 0.012), m.goldLight, 0, 0.045, 0, crown);
    const crest = mesh(new T.CylinderGeometry(0.11, 0.11, 0.025, 6), m.gold, 0, 0.07, -0.25, crown); crest.rotation.x = PI / 2 - 0.15; crest.scale.set(0.9, 1, 1.3);
    mesh(new T.OctahedronGeometry(0.045), m.ruby, 0, 0.07, -0.275, crown).scale.set(0.8, 1.3, 0.6);
    for (const sx of [-1, 1]) {   // side swirls
      const sw = mesh(tor(0.04, 0.012, 6, 16), m.goldLight, sx * 0.17, 0.05, -0.19, crown); sw.rotation.y = sx * 0.6;
    }
    mesh(cyl(0.19, 0.24, 0.12, 30), m.gold, 0, 0.1, 0, crown);
    mesh(ring(0.19, 0.012), m.goldDark, 0, 0.16, 0, crown);
    mesh(cyl(0.13, 0.18, 0.12, 30), m.gold, 0, 0.21, 0, crown);
    mesh(ring(0.13, 0.011), m.goldLight, 0, 0.27, 0, crown);
    mesh(new T.ConeGeometry(0.12, 0.26, 30), m.gold, 0, 0.39, 0, crown);
    mesh(sph(0.035), m.goldLight, 0, 0.54, 0, crown);
    mesh(new T.ConeGeometry(0.018, 0.08, 10), m.goldLight, 0, 0.6, 0, crown);
    for (let i = 0; i < 10; i++) {   // petal rim
      const a = i / 10 * PI * 2;
      const p = mesh(new T.ConeGeometry(0.035, 0.09, 8), m.goldLight, Math.sin(a) * 0.235, 0.08, Math.cos(a) * 0.225, crown, false);
      p.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35);
    }

    // --- short chubby arms
    function arm(sx) {
      const sh = new T.Group(); sh.position.set(sx * 0.21, 0.38, 0); torso.add(sh);
      mesh(sph(0.075, 16, 12), m.skin, 0, 0, 0, sh);
      mesh(cyl(0.068, 0.06, 0.18, 16), m.skin, 0, -0.09, 0, sh);
      mesh(ring(0.066, 0.016), m.gold, 0, -0.07, 0, sh);
      const el = new T.Group(); el.position.y = -0.18; sh.add(el);
      mesh(sph(0.06, 14, 10), m.skin, 0, 0, 0, el);
      mesh(cyl(0.058, 0.05, 0.16, 16), m.skin, 0, -0.08, 0, el);
      mesh(ring(0.053, 0.016), m.gold, 0, -0.14, 0, el);
      mesh(sph(0.065, 16, 12), m.skin, 0, -0.2, 0, el).scale.set(1, 1.1, 0.9);
      return { sh, el };
    }
    const armL = arm(-1), armR = arm(1);

    // --- yellow dhoti (puffy) with a red sash panel
    mesh(sph(0.24, 24, 16), m.dhoti, 0, -0.07, 0, pelvis).scale.set(1.0, 0.7, 0.92);
    for (const z of [-1, 1]) {
      const sash = mesh(new T.BoxGeometry(0.12, 0.28, 0.03), m.sash, 0, -0.14, z * 0.215, pelvis); sash.rotation.x = z * -0.12;
      mesh(new T.BoxGeometry(0.13, 0.025, 0.035), m.gold, 0, -0.28, z * 0.235, pelvis);
    }
    function leg(sx) {
      const hip = new T.Group(); hip.position.set(sx * 0.11, -0.04, 0); pelvis.add(hip);
      mesh(cyl(0.12, 0.1, 0.27, 18), m.dhoti, 0, -0.13, 0, hip);
      const kn = new T.Group(); kn.position.y = -0.27; hip.add(kn);
      mesh(sph(0.1, 16, 12), m.dhoti, 0, 0, 0, kn);
      mesh(cyl(0.1, 0.075, 0.2, 18), m.dhotiDark, 0, -0.1, 0, kn);   // gathered pants
      mesh(ring(0.072, 0.02), m.gold, 0, -0.2, 0, kn);
      mesh(cyl(0.045, 0.045, 0.06, 12), m.skin, 0, -0.23, 0, kn);
      const ft = mesh(sph(0.065, 14, 10), m.skin, 0, -0.27, -0.04, kn); ft.scale.set(0.95, 0.5, 1.5);
      return { hip, kn };
    }
    const legL = leg(-1), legR = leg(1);

    // --- gada on the LEFT shoulder (hero's left is -X)
    const gadaPivot = new T.Group(); gadaPivot.position.set(-0.27, 0.4, 0.0); torso.add(gadaPivot);
    const gada = new T.Group(); gada.position.y = -0.03; gada.scale.setScalar(0.78); gadaPivot.add(gada);
    mesh(cyl(0.032, 0.034, 0.86, 12), m.gold, 0, 0.05, 0, gada);
    mesh(ring(0.04, 0.014), m.goldDark, 0, -0.2, 0, gada);
    mesh(ring(0.04, 0.014), m.goldDark, 0, 0.2, 0, gada);
    mesh(sph(0.048), m.gold, 0, -0.39, 0, gada);
    mesh(cyl(0.06, 0.095, 0.08, 14), m.goldDark, 0, 0.5, 0, gada);
    mesh(ribbedSphere(0.2, 12, 0.07), m.gold, 0, 0.68, 0, gada);
    mesh(ring(0.2, 0.018), m.goldDark, 0, 0.68, 0, gada);
    mesh(new T.ConeGeometry(0.04, 0.12, 10), m.goldLight, 0, 0.92, 0, gada);

    // --- tail: tapering chain ending in a curl with a dark tuft
    const tailRoot = new T.Group(); tailRoot.position.set(0, -0.05, 0.2); pelvis.add(tailRoot);
    const tail = [];
    const N = 15, L = 0.085;
    const base = [1.15, 0.2, 0.0, -0.08, -0.12, -0.15, -0.2, -0.24, -0.3, -0.36, -0.44, -0.52, -0.6, -0.66, -0.7];
    let parent = tailRoot;
    for (let i = 0; i < N; i++) {
      const r0 = 0.034 - i * 0.0012, r1 = r0 - 0.0012;
      const g = cyl(r1, r0, L + 0.01, 10);
      g.rotateX(PI / 2); g.translate(0, 0, L / 2);
      const seg = new T.Group();
      if (i > 0) seg.position.z = L;
      parent.add(seg);
      mesh(g, m.skin, 0, 0, 0, seg);
      tail.push(seg);
      parent = seg;
    }
    const tuft = mesh(sph(0.055, 14, 10), m.hair, 0, 0, L + 0.03, parent);
    tuft.scale.set(1, 1, 1.6);

    // --- effects (aura + shield bubble)
    const aura = new T.Mesh(new T.SphereGeometry(1, 24, 16), fresnelMat(0xffc040, 1.4));
    aura.scale.set(0.75, 1.1, 0.75); aura.position.y = 0.9; aura.visible = false; root.add(aura);
    const shield = new T.Mesh(new T.IcosahedronGeometry(1, 3), fresnelMat(0x6fd8ff, 1.0));
    shield.scale.setScalar(1.15); shield.position.y = 0.9; shield.visible = false; root.add(shield);

    root.traverse(o => { if (o.isMesh && o !== aura && o !== shield) o.castShadow = true; });

    const J = { root, body, pelvis, pelvisH: PELVIS, torso, head, armL, armR, legL, legR, gadaPivot, tail, tailBase: base, tuft, aura, shield };
    J.animate = (st, dt) => animateHero(J, st, dt);
    return J;
  }

  function fresnelMat(color, power) {
    return new T.ShaderMaterial({
      uniforms: { uColor: { value: new T.Color(color) }, uOpacity: { value: 0.8 }, uPow: { value: power || 1.5 }, uTime: { value: 0 } },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uOpacity; uniform float uPow; uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main(){ float f = pow(1.0-abs(dot(vN,vV)), uPow); float bands = 0.75+0.25*sin(vP.y*14.0 - uTime*6.0);
          gl_FragColor = vec4(uColor*(1.2+f), (f*0.9+0.06)*uOpacity*bands);
          #include <encodings_fragment>
        }`,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    });
  }

  // Smoothly approach target rotations so modes blend into each other.
  function ap(obj, axis, target, k) { obj.rotation[axis] += (target - obj.rotation[axis]) * k; }

  function animateHero(J, st, dt) {
    const k = 1 - Math.exp(-dt * 16);
    const t = st.t;
    const p = st.phase;
    const s = Math.sin(p), c = Math.cos(p);
    let tailAmp = 0.12, tailFreq = 3, tailCurl = 0;
    const tg = {
      bodyY: 0, bodyX: 0, bodyZ: st.lean || 0, pelvisY: J.pelvisH || 0.95,
      torsoX: 0, torsoY: 0, headX: 0,
      lShX: 0.42, lShZ: 0.3, lEl: 1.9, rShX: 0, rShZ: -0.1, rEl: 0.3,
      lHip: 0, lKn: 0, rHip: 0, rKn: 0, gadaX: 0.3, gadaZ: 0.42,
    };
    switch (st.mode) {
      case 'idle': {
        const b = Math.sin(t * 2);
        tg.bodyY = b * 0.008; tg.torsoX = b * 0.02; tg.rShX = 0.05 + b * 0.03; tg.rShZ = -0.15; tg.rEl = 0.25;
        tg.headX = Math.sin(t * 0.7) * 0.05; tailAmp = 0.18; tailFreq = 1.6;
        break;
      }
      case 'run': {
        tg.bodyY = Math.abs(c) * 0.07; tg.bodyX = -0.16; tg.torsoY = s * 0.14; tg.headX = 0.1;
        tg.lHip = s * 0.95; tg.rHip = -s * 0.95;
        tg.lKn = -0.2 - 1.25 * Math.max(0, c); tg.rKn = -0.2 - 1.25 * Math.max(0, -c);
        tg.rShX = s * 0.95 + 0.15; tg.rEl = 1.25 + s * 0.2; tg.rShZ = -0.12;
        tg.lShX = 0.42 - s * 0.08; tailAmp = 0.1; tailFreq = 8;
        break;
      }
      case 'jump': {
        tg.bodyX = -0.1; tg.lHip = 1.1; tg.rHip = 0.7; tg.lKn = -1.7; tg.rKn = -1.3;
        tg.rShX = 2.4; tg.rEl = 0.6; tg.rShZ = -0.3; tailCurl = -0.08; tailAmp = 0.05; tailFreq = 6;
        break;
      }
      case 'slide': {
        tg.pelvisY = (J.pelvisH || 0.95) * 0.5; tg.bodyX = 0.0; tg.torsoX = 0.75; tg.headX = -0.5;
        tg.lHip = 1.45; tg.rHip = 1.25; tg.lKn = -0.25; tg.rKn = -0.6;
        tg.rShX = -0.6; tg.rShZ = -0.5; tg.rEl = 0.4; tg.lShX = 1.1; tg.lEl = 1.2; tg.gadaX = 1.45; tg.gadaZ = 1.1;
        tailAmp = 0.04; tailFreq = 10;
        break;
      }
      case 'fly': {
        tg.bodyY = 1.0 + Math.sin(t * 5) * 0.05; tg.bodyX = -1.3; tg.headX = -0.9;
        tg.rShX = 2.95; tg.rEl = 0.05; tg.rShZ = 0.05; tg.lShX = 0.35; tg.lEl = 1.6;
        tg.lHip = -0.15; tg.rHip = 0.05 + Math.sin(t * 6) * 0.1; tg.lKn = -0.35; tg.rKn = -0.7;
        tailCurl = 0.03; tailAmp = 0.08; tailFreq = 10;
        break;
      }
      case 'crash': {
        tg.bodyY = 0.2; tg.bodyX = 1.45; tg.headX = 0.3; tg.rShX = 2.4; tg.rShZ = -1.0; tg.lShX = 2.2; tg.lShZ = 1.0;
        tg.lEl = 0.3; tg.rEl = 0.3; tg.lHip = 0.5; tg.rHip = 0.2; tg.lKn = -0.6; tg.rKn = -0.2; tg.gadaX = -1.6; tg.gadaZ = 0.8;
        tailAmp = 0.02; tailFreq = 1;
        break;
      }
      case 'fall': {
        const f = Math.sin(t * 14);
        tg.bodyX = 0.3; tg.rShX = 2.8 + f * 0.3; tg.lShX = 2.6 - f * 0.3; tg.lShZ = 0.4; tg.rShZ = -0.4;
        tg.lEl = 0.3; tg.rEl = 0.3; tg.lHip = 0.4 + f * 0.4; tg.rHip = 0.4 - f * 0.4; tg.lKn = -0.8; tg.rKn = -0.8;
        tailAmp = 0.3; tailFreq = 12;
        break;
      }
    }
    // gada smash (two-handed overhead swing) overrides arms
    if (st.smash >= 0) {
      const q = st.smash;
      let g;
      if (q < 0.3) g = q / 0.3; else if (q < 0.55) g = 1 - (q - 0.3) / 0.25 * 2.4; else g = -1.4 + (q - 0.55) / 0.45 * 1.4;
      // g: 0 rest -> 1 wind up -> -1.4 strike -> 0
      tg.gadaX = 0.42 + g * 0.9 + (g < 0 ? g * 0.75 : 0); tg.gadaZ = 0.18 * (1 - Math.abs(g));
      tg.lShX = 0.42 + Math.max(0, g) * 2.7 + Math.max(0, -g) * 0.6; tg.lEl = 1.9 - Math.max(0, g) * 1.5 - Math.max(0, -g) * 1.4;
      tg.rShX = Math.max(0, g) * 2.9 + Math.max(0, -g) * 1.4; tg.rShZ = 0.35; tg.rEl = 0.3;
      tg.torsoX = (g < 0 ? -g * 0.35 : -g * 0.12);
      const kk = 1 - Math.exp(-dt * 40);
      ap(J.gadaPivot, 'x', tg.gadaX, kk); ap(J.gadaPivot, 'z', tg.gadaZ, kk);
      ap(J.armL.sh, 'x', tg.lShX, kk); ap(J.armL.el, 'x', tg.lEl, kk);
      ap(J.armR.sh, 'x', tg.rShX, kk); ap(J.armR.sh, 'z', tg.rShZ, kk); ap(J.armR.el, 'x', tg.rEl, kk);
    }

    J.body.position.y += (tg.bodyY - J.body.position.y) * k;
    ap(J.body, 'x', tg.bodyX, k); ap(J.body, 'z', tg.bodyZ, k);
    J.pelvis.position.y += (tg.pelvisY - J.pelvis.position.y) * k;
    ap(J.torso, 'x', tg.torsoX, k); ap(J.torso, 'y', tg.torsoY, k); ap(J.head, 'x', tg.headX, k);
    ap(J.armL.sh, 'x', tg.lShX, k); ap(J.armL.sh, 'z', tg.lShZ, k); ap(J.armL.el, 'x', tg.lEl, k);
    ap(J.armR.sh, 'x', tg.rShX, k); ap(J.armR.sh, 'z', tg.rShZ, k); ap(J.armR.el, 'x', tg.rEl, k);
    ap(J.legL.hip, 'x', tg.lHip, k); ap(J.legL.kn, 'x', tg.lKn, k);
    ap(J.legR.hip, 'x', tg.rHip, k); ap(J.legR.kn, 'x', tg.rKn, k);
    ap(J.gadaPivot, 'x', tg.gadaX, k); ap(J.gadaPivot, 'z', tg.gadaZ, k);

    for (let i = 0; i < J.tail.length; i++) {
      const seg = J.tail[i];
      const w = t * tailFreq - i * 0.45;
      seg.rotation.x = J.tailBase[i] + tailCurl * i + Math.sin(w) * tailAmp * 0.6;
      seg.rotation.y = Math.sin(w * 0.8 + 1.3) * tailAmp * (0.4 + i * 0.05) + (st.tailSwing || 0) * (i < 4 ? 0.3 : 0);
    }

    J.aura.material.uniforms.uTime.value = t;
    J.shield.material.uniforms.uTime.value = t;
    J.shield.rotation.y = t * 0.6;
  }

  // ---------------------------------------------------------------- RAKSHASA
  let rkGeo = null;
  const rkSkinMats = {};
  let rkMats = null;
  function getRk() {
    if (rkGeo) return;
    rkGeo = {
      leg: cyl(0.17, 0.13, 0.85, 10), foot: new T.BoxGeometry(0.26, 0.14, 0.42),
      loin: cyl(0.44, 0.54, 0.45, 14, true), belly: sph(0.5, 16, 12), chest: sph(0.52, 16, 12),
      head: sph(0.27, 16, 12), jaw: new T.BoxGeometry(0.32, 0.14, 0.24),
      horn: new T.ConeGeometry(0.07, 0.42, 8), tusk: new T.ConeGeometry(0.03, 0.12, 6),
      eye: sph(0.055, 8, 6), brow: new T.BoxGeometry(0.16, 0.05, 0.06),
      upper: cyl(0.14, 0.12, 0.5, 10), fore: cyl(0.12, 0.1, 0.46, 10), fist: sph(0.14, 10, 8),
      pad: new T.SphereGeometry(0.2, 12, 8, 0, PI * 2, 0, PI / 2), spike: new T.ConeGeometry(0.05, 0.22, 6),
      club: cyl(0.14, 0.06, 1.15, 10), clubSpike: new T.ConeGeometry(0.035, 0.12, 5), band: ring(0.135, 0.03),
      hair: new T.ConeGeometry(0.09, 0.3, 6),
    };
    rkMats = {
      bone: std(0xEDE3C8, 0.5), eye: std(0xffd000, 0.3, 0, 0xffb000, 2.2), dark: std(0x1a1010, 0.9),
      loin: std(0x5a0e14, 0.85), metal: std(0x5a5560, 0.4, 0.8), gold: std(0xD9A02A, 0.3, 0.9), wood: std(0x4a2e1a, 0.9),
    };
  }
  const RK_SKINS = [0x3f6b3a, 0x34508f, 0x6a2d6a, 0x7a2f2f, 0x2f6a6a];
  function rkSkin(c) { return rkSkinMats[c] || (rkSkinMats[c] = std(c, 0.75)); }

  function buildRakshasa(skinColor) {
    getRk();
    const G = rkGeo, M = rkMats;
    const skin = rkSkin(skinColor == null ? RK_SKINS[Math.floor(Math.random() * RK_SKINS.length)] : skinColor);
    const root = new T.Group();
    const body = new T.Group(); root.add(body);
    const legs = [];
    for (const sx of [-1, 1]) {
      const hip = new T.Group(); hip.position.set(sx * 0.24, 1.0, 0); body.add(hip);
      mesh(G.leg, skin, 0, -0.42, 0, hip);
      mesh(G.foot, M.dark, 0, -0.9, -0.08, hip, false);
      legs.push(hip);
    }
    mesh(G.loin, M.loin, 0, 0.98, 0, body);
    mesh(G.band, M.gold, 0, 1.18, 0, body, false).scale.set(3.4, 3.4, 3.0);
    const upper = new T.Group(); upper.position.y = 1.2; body.add(upper);
    mesh(G.belly, skin, 0, 0.12, -0.02, upper).scale.set(1, 0.85, 0.85);
    mesh(G.chest, skin, 0, 0.55, 0, upper).scale.set(1.2, 0.75, 0.8);
    const head = new T.Group(); head.position.set(0, 1.05, -0.05); upper.add(head);
    mesh(G.head, skin, 0, 0, 0, head);
    mesh(G.jaw, skin, 0, -0.17, -0.1, head, false);
    for (const sx of [-1, 1]) {
      const h = mesh(G.horn, M.bone, sx * 0.17, 0.22, 0, head, false); h.rotation.z = -sx * 0.55; h.rotation.x = 0.2;
      const tk = mesh(G.tusk, M.bone, sx * 0.1, -0.13, -0.22, head, false); tk.rotation.x = -0.2;
      mesh(G.eye, M.eye, sx * 0.09, 0.05, -0.23, head, false);
      const b = mesh(G.brow, M.dark, sx * 0.09, 0.12, -0.22, head, false); b.rotation.z = sx * 0.4;
    }
    for (let i = 0; i < 4; i++) {
      const hr = mesh(G.hair, M.dark, (i - 1.5) * 0.09, 0.2, 0.14, head, false); hr.rotation.x = 0.9;
    }
    const arms = [];
    for (const sx of [-1, 1]) {
      const sh = new T.Group(); sh.position.set(sx * 0.62, 0.68, 0); upper.add(sh);
      mesh(G.pad, M.metal, 0, 0.02, 0, sh, false).scale.set(1.1, 0.9, 1.1);
      const sp = mesh(G.spike, M.bone, 0, 0.22, 0, sh, false); sp.rotation.z = -sx * 0.3;
      mesh(G.upper, skin, 0, -0.25, 0, sh);
      const el = new T.Group(); el.position.y = -0.5; sh.add(el);
      mesh(G.fore, skin, 0, -0.22, 0, el);
      mesh(G.band, M.gold, 0, -0.3, 0, el, false).scale.setScalar(0.85);
      mesh(G.fist, skin, 0, -0.48, 0, el);
      arms.push({ sh, el });
    }
    // club in right hand
    const club = new T.Group(); club.position.y = -0.5; arms[1].el.add(club);
    mesh(G.club, M.wood, 0, 0.35, -0.1, club).rotation.x = -0.3;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * PI * 2;
      const s = mesh(G.clubSpike, M.metal, Math.sin(a) * 0.12, 0.72, -0.2 + Math.cos(a) * 0.12, club, false);
      s.rotation.set(Math.cos(a) * 1.3, 0, -Math.sin(a) * 1.3);
    }
    const R = { root, body, upper, head, legs, arms, ph: Math.random() * 10 };
    return R;
  }

  function animateRakshasa(R, t, mode, dt) {
    const k = 1 - Math.exp(-dt * 10);
    const tt = t + R.ph;
    let lHip = 0, rHip = 0, lSh = 0.2, rSh = 0.3, rEl = 1.2, lEl = 0.4, upX = 0, bodyY = 0, headY = 0;
    if (mode === 'idle') {
      upX = Math.sin(tt * 1.5) * 0.05; lSh = 0.2 + Math.sin(tt * 1.5) * 0.1; headY = Math.sin(tt * 0.8) * 0.3;
    } else if (mode === 'alert') {
      // roars and raises the club
      upX = -0.15 + Math.sin(tt * 6) * 0.05; rSh = 2.6 + Math.sin(tt * 8) * 0.2; rEl = 0.6; lSh = 0.9; lEl = 0.2;
      bodyY = Math.abs(Math.sin(tt * 5)) * 0.08;
    } else if (mode === 'walk' || mode === 'run') {
      const f = mode === 'run' ? 11 : 6;
      const s = Math.sin(tt * f);
      lHip = s * 0.8; rHip = -s * 0.8; bodyY = Math.abs(Math.cos(tt * f)) * 0.12; upX = mode === 'run' ? -0.3 : -0.1;
      lSh = -s * 0.8; rSh = mode === 'run' ? 2.2 + s * 0.3 : s * 0.8; rEl = 1.0;
    }
    R.legs[0].rotation.x += (lHip - R.legs[0].rotation.x) * k;
    R.legs[1].rotation.x += (rHip - R.legs[1].rotation.x) * k;
    R.arms[0].sh.rotation.x += (lSh - R.arms[0].sh.rotation.x) * k;
    R.arms[1].sh.rotation.x += (rSh - R.arms[1].sh.rotation.x) * k;
    R.arms[0].el.rotation.x += (lEl - R.arms[0].el.rotation.x) * k;
    R.arms[1].el.rotation.x += (rEl - R.arms[1].el.rotation.x) * k;
    R.arms[0].sh.rotation.z = 0.25; R.arms[1].sh.rotation.z = -0.25;
    R.upper.rotation.x += (upX - R.upper.rotation.x) * k;
    R.head.rotation.y += (headY - R.head.rotation.y) * k;
    R.body.position.y = bodyY;
  }

  return { buildHanuman, buildRakshasa, animateRakshasa, fresnelMat, std };
})();
