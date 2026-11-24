'use strict';
/* World: endless track with 90-degree turns (Temple Run style), four story biomes,
   procedural decor, obstacles, coins, power-ups, sky, water and particles. */

const TRACK_W = 9, HALF_W = 4.5, LANE_W = 2.6;
const BIOME_LEN = 900, LANKA_DIST = 1800;
const DIRV = [], RIGHTV = [];
for (let d = 0; d < 4; d++) {
  const th = -d * Math.PI / 2;
  DIRV.push(new THREE.Vector3(Math.round(-Math.sin(th)), 0, Math.round(-Math.cos(th))));
  RIGHTV.push(new THREE.Vector3(Math.round(Math.cos(th)), 0, Math.round(-Math.sin(th))));
}
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function segPoint(seg, s, x, y, out) {
  return out.copy(seg.start).addScaledVector(DIRV[seg.dir], s).addScaledVector(RIGHTV[seg.dir], x).setY(seg.start.y + y);
}

const BIOMES = {
  forest: {
    name: 'Kishkindha Forest', sub: 'The search for Sita begins',
    skyTop: 0x3f86d8, skyBot: 0xcfe9d6, sun: 0xfff1c8, fog: 0xa8d0b8, fogNear: 30, fogFar: 165,
    hemiSky: 0xe4fff0, hemiGround: 0x46553a, hemiI: 0.85, dirC: 0xfff0d8, dirI: 2.1, sunDir: [0.4, 0.75, 0.35],
    water: 0x274d2c, waterEm: 0x000000, waterY: -9, stars: 0, curb: 0x777a63, exposure: 1.0,
  },
  ocean: {
    name: 'Leap across the Ocean', sub: 'Ram Setu — stones that float',
    skyTop: 0x2f6fd0, skyBot: 0xffdcae, sun: 0xffe2a8, fog: 0xb5d7ea, fogNear: 40, fogFar: 200,
    hemiSky: 0xdff3ff, hemiGround: 0x3a6a80, hemiI: 0.95, dirC: 0xffe8c8, dirI: 2.2, sunDir: [-0.3, 0.45, -0.6],
    water: 0x1a74b0, waterEm: 0x000000, waterY: -2.2, stars: 0, curb: 0x9a8f78, exposure: 1.0,
  },
  lanka: {
    name: 'Golden Lanka', sub: 'Ravana’s city of gold',
    skyTop: 0x1d1546, skyBot: 0xe2783e, sun: 0xffa060, fog: 0x77405a, fogNear: 22, fogFar: 140,
    hemiSky: 0xffcfa0, hemiGround: 0x40203a, hemiI: 0.8, dirC: 0xffb478, dirI: 1.9, sunDir: [0.5, 0.3, -0.5],
    water: 0x2a1832, waterEm: 0x000000, waterY: -7, stars: 0.7, curb: 0xc0902e, exposure: 1.1,
  },
  dahan: {
    name: 'Lanka Dahan', sub: 'His burning tail sets Lanka ablaze!',
    skyTop: 0x1c0606, skyBot: 0xff6a24, sun: 0xff7a30, fog: 0x5c2214, fogNear: 18, fogFar: 125,
    hemiSky: 0xffa070, hemiGround: 0x401010, hemiI: 0.75, dirC: 0xff9050, dirI: 1.7, sunDir: [-0.4, 0.35, 0.5],
    water: 0xff5a10, waterEm: 0xff3a00, waterY: -5, stars: 0.25, curb: 0x3c2c24, exposure: 1.05,
  },
};
const BIOME_ORDER = ['forest', 'ocean', 'lanka', 'dahan'];
function biomeAt(d) { return BIOME_ORDER[Math.floor(d / BIOME_LEN) % BIOME_ORDER.length]; }

// ------------------------------------------------------------ geometry merging
const BASEG = (() => {
  const T = THREE;
  const g = {
    box: new T.BoxGeometry(1, 1, 1), cyl: new T.CylinderGeometry(0.5, 0.5, 1, 10), cyl6: new T.CylinderGeometry(0.5, 0.5, 1, 6),
    cone: new T.ConeGeometry(0.5, 1, 10), cone4: new T.ConeGeometry(0.5, 1, 4), ico: new T.IcosahedronGeometry(1, 0),
    ico1: new T.IcosahedronGeometry(1, 1), sph: new T.SphereGeometry(1, 12, 8), hemi: new T.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    dode: new T.DodecahedronGeometry(1, 0), tor: new T.TorusGeometry(1, 0.18, 6, 14), onion: null,
  };
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new T.Vector2(Math.sin(t * Math.PI) * (1 + 0.35 * Math.sin(t * Math.PI * 0.9)) * (1 - t * 0.35), t * 2)); }
  pts[12].x = 0;
  g.onion = new T.LatheGeometry(pts, 10);
  for (const k in g) g[k] = g[k].index ? g[k].toNonIndexed() : g[k];
  return g;
})();

class Merger {
  constructor() { this.ch = {}; }
  add(ch, geo, color, px, py, pz, sx, sy, sz, rx, ry, rz) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
    m.compose(new THREE.Vector3(px, py, pz), q, new THREE.Vector3(sx, sy == null ? sx : sy, sz == null ? sx : sz));
    (this.ch[ch] || (this.ch[ch] = [])).push({ g: BASEG[geo] || geo, m, c: color instanceof THREE.Color ? color : new THREE.Color(color) });
  }
  build(mats, opts) {
    const out = [];
    const v = new THREE.Vector3(), n3 = new THREE.Matrix3();
    for (const ch in this.ch) {
      const list = this.ch[ch];
      let n = 0;
      for (const p of list) n += p.g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
      let o = 0;
      for (const p of list) {
        const pa = p.g.attributes.position, na = p.g.attributes.normal;
        n3.getNormalMatrix(p.m);
        for (let i = 0; i < pa.count; i++, o += 3) {
          v.fromBufferAttribute(pa, i).applyMatrix4(p.m); pos[o] = v.x; pos[o + 1] = v.y; pos[o + 2] = v.z;
          v.fromBufferAttribute(na, i).applyMatrix3(n3).normalize(); nor[o] = v.x; nor[o + 1] = v.y; nor[o + 2] = v.z;
          col[o] = p.c.r; col[o + 1] = p.c.g; col[o + 2] = p.c.b;
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, mats[ch]);
      mesh.receiveShadow = !(opts && opts.noReceive);
      mesh.castShadow = !!(opts && opts.cast);
      mesh.userData.own = true;
      out.push(mesh);
    }
    return out;
  }
}
const _col = new THREE.Color();
function vary(hex, amt) {
  _col.set(hex);
  const hsl = {}; _col.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h + rnd(-0.02, 0.02) * amt, clamp(hsl.s + rnd(-0.1, 0.1) * amt, 0, 1), clamp(hsl.l + rnd(-0.08, 0.08) * amt, 0, 1));
}

// ------------------------------------------------------------ textures
function canvasTex(size, draw, srgb) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb !== false) t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 4;
  return t;
}
function speckle(g, s, n, colors, rmax) {
  for (let i = 0; i < n; i++) { g.fillStyle = pick(colors); g.globalAlpha = rnd(0.05, 0.25); g.beginPath(); g.arc(rnd(0, s), rnd(0, s), rnd(0.5, rmax), 0, 7); g.fill(); }
  g.globalAlpha = 1;
}
const TEX = {};
function makeTextures() {
  TEX.stone = canvasTex(512, (g, s) => {
    g.fillStyle = '#3d3d34'; g.fillRect(0, 0, s, s);
    const rows = 4, cols = 2;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const off = (r % 2) * s / cols / 2;
      const x = c * s / cols + off, y = r * s / rows;
      const l = rnd(38, 52);
      g.fillStyle = `hsl(${rnd(60, 90)},${rnd(6, 14)}%,${l}%)`;
      for (const dx of [0, -s]) g.fillRect(x + dx + 5, y + 5, s / cols - 10, s / rows - 10);
    }
    speckle(g, s, 2500, ['#222', '#777', '#5a5a45'], 3);
    for (let i = 0; i < 40; i++) { g.fillStyle = '#4c7a2e'; g.globalAlpha = rnd(0.15, 0.4); g.beginPath(); g.arc(rnd(0, s), rnd(0, s), rnd(4, 22), 0, 7); g.fill(); }
    g.globalAlpha = 1;
  });
  TEX.setu = canvasTex(512, (g, s) => {
    g.fillStyle = '#4c443a'; g.fillRect(0, 0, s, s);
    const n = 3;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const cx = (c + 0.5) * s / n + rnd(-8, 8), cy = (r + 0.5) * s / n + rnd(-8, 8), rr = s / n / 2 - 6;
      g.fillStyle = `hsl(${rnd(30, 45)},${rnd(18, 30)}%,${rnd(55, 66)}%)`;
      g.beginPath(); g.ellipse(cx, cy, rr, rr * rnd(0.8, 0.95), rnd(0, 3), 0, 7); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.15)'; g.beginPath(); g.ellipse(cx + 4, cy + 6, rr * 0.9, rr * 0.75, 0, 0, 7); g.fill();
      g.fillStyle = `hsl(${rnd(30, 45)},25%,${rnd(62, 70)}%)`; g.beginPath(); g.ellipse(cx - 2, cy - 3, rr * 0.88, rr * 0.72, 0, 0, 7); g.fill();
      if ((r + c) % 2 === 0) {
        g.save(); g.translate(cx, cy); g.rotate(rnd(-0.3, 0.3));
        g.fillStyle = '#c0391e'; g.font = 'bold 52px "Noto Sans Devanagari", "Mangal", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('राम', 0, 0); g.restore();
      }
    }
    speckle(g, s, 1500, ['#3a3128', '#a89a80'], 2.5);
  });
  TEX.gold = canvasTex(512, (g, s) => {
    const n = 2;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const x = c * s / n, y = r * s / n, w = s / n;
      const gr = g.createLinearGradient(x, y, x + w, y + w);
      gr.addColorStop(0, '#f6cf6a'); gr.addColorStop(0.5, '#d29a2c'); gr.addColorStop(1, '#b07818');
      g.fillStyle = gr; g.fillRect(x, y, w, w);
      g.strokeStyle = '#7a4c0c'; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, w - 6, w - 6);
      g.strokeStyle = 'rgba(122,76,12,0.8)'; g.lineWidth = 3;
      const cx = x + w / 2, cy = y + w / 2;
      for (let i = 0; i < 8; i++) {  // lotus
        g.save(); g.translate(cx, cy); g.rotate(i * Math.PI / 4);
        g.beginPath(); g.ellipse(0, -w * 0.18, w * 0.07, w * 0.18, 0, 0, 7); g.stroke(); g.restore();
      }
      g.beginPath(); g.arc(cx, cy, w * 0.06, 0, 7); g.stroke();
      g.beginPath(); g.arc(cx, cy, w * 0.42, 0, 7); g.stroke();
    }
    speckle(g, s, 800, ['#fff3c0', '#6a4008'], 2);
  });
  TEX.charred = canvasTex(512, (g, s) => {
    g.fillStyle = '#ff6a10'; g.fillRect(0, 0, s, s);
    const n = 2;
    for (let r = 0; r < n * 2; r++) for (let c = 0; c < n; c++) {
      const off = (r % 2) * s / n / 2, x = c * s / n + off, y = r * s / n / 2;
      g.fillStyle = `hsl(${rnd(10, 25)},${rnd(10, 20)}%,${rnd(12, 20)}%)`;
      for (const dx of [0, -s]) g.fillRect(x + dx + 4, y + 4, s / n - 8, s / n / 2 - 8);
    }
    g.strokeStyle = '#ff8a20'; g.lineWidth = 2;
    for (let i = 0; i < 26; i++) { g.beginPath(); let x = rnd(0, s), y = rnd(0, s); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += rnd(-30, 30); y += rnd(-30, 30); g.lineTo(x, y); } g.stroke(); }
    speckle(g, s, 1500, ['#000', '#552211'], 3);
  });
  TEX.dot = canvasTex(64, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }, false);
  TEX.flame = canvasTex(128, (g, s) => {
    const gr = g.createRadialGradient(s / 2, s * 0.62, 2, s / 2, s * 0.55, s * 0.48);
    gr.addColorStop(0, 'rgba(255,250,210,1)'); gr.addColorStop(0.25, 'rgba(255,200,60,0.95)'); gr.addColorStop(0.6, 'rgba(255,90,10,0.55)'); gr.addColorStop(1, 'rgba(160,20,0,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(s / 2, 2);
    g.bezierCurveTo(s * 0.9, s * 0.45, s * 0.95, s * 0.95, s / 2, s * 0.98);
    g.bezierCurveTo(s * 0.05, s * 0.95, s * 0.1, s * 0.45, s / 2, 2); g.fill();
  }, false);
  for (const k of ['stone', 'setu', 'gold', 'charred']) TEX[k].anisotropy = 8;
}

// ------------------------------------------------------------ particles
class Particles {
  constructor(max, additive) {
    this.max = max; this.n = 0; this.i = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4); this.base = new Float32Array(max * 4);
    this.size = new Float32Array(max); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.size0 = new Float32Array(max); this.grow = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3); this.aCol = new THREE.BufferAttribute(this.col, 4); this.aSize = new THREE.BufferAttribute(this.size, 1);
    this.aPos.setUsage(THREE.DynamicDrawUsage); this.aCol.setUsage(THREE.DynamicDrawUsage); this.aSize.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('pcolor', this.aCol); g.setAttribute('psize', this.aSize);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: TEX.dot }, uScale: { value: 400 } },
      vertexShader: `attribute vec4 pcolor; attribute float psize; uniform float uScale; varying vec4 vC;
        void main(){ vC = pcolor; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = psize*uScale/max(0.1,-mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vC;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a*t.a); if (gl_FragColor.a < 0.01) discard;
        #include <encodings_fragment>
        }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }
  spawn(x, y, z, vx, vy, vz, color, size, life, grav, drag, alpha, grow) {
    const i = this.i; this.i = (this.i + 1) % this.max; if (this.n < this.max) this.n++;
    const i3 = i * 3, i4 = i * 4;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    _col.set(color);
    this.base[i4] = _col.r; this.base[i4 + 1] = _col.g; this.base[i4 + 2] = _col.b; this.base[i4 + 3] = alpha == null ? 1 : alpha;
    this.size0[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav || 0; this.drag[i] = drag || 0; this.grow[i] = grow || 0;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      const i3 = i * 3, i4 = i * 4;
      if (this.life[i] <= 0) { this.col[i4 + 3] = 0; this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= d; this.vel[i3 + 1] = this.vel[i3 + 1] * d - this.grav[i] * dt; this.vel[i3 + 2] *= d;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const f = Math.max(0, this.life[i] / this.maxLife[i]);
      this.col[i4] = this.base[i4]; this.col[i4 + 1] = this.base[i4 + 1]; this.col[i4 + 2] = this.base[i4 + 2];
      this.col[i4 + 3] = this.base[i4 + 3] * Math.min(1, f * 2.5);
      this.size[i] = this.size0[i] * (1 + this.grow[i] * (1 - f));
    }
    this.points.geometry.setDrawRange(0, this.n);
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSize.needsUpdate = true;
  }
  clear() { this.life.fill(0); this.n = 0; }
}

// ------------------------------------------------------------ world
const World = {
  scene: null, segments: [], retired: [], nextPower: 0, nextGem: 0, time: 0,

  init(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    makeTextures();
    const T = THREE;
    this.mats = {
      matte: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }),
      metal: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.85, flatShading: true }),
      glow: new T.MeshBasicMaterial({ vertexColors: true }),
      smooth: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }),
    };
    this.floorMats = {
      forest: new T.MeshStandardMaterial({ map: TEX.stone, roughness: 0.9 }),
      ocean: new T.MeshStandardMaterial({ map: TEX.setu, roughness: 0.85 }),
      lanka: new T.MeshStandardMaterial({ map: TEX.gold, roughness: 0.38, metalness: 0.7 }),
      dahan: new T.MeshStandardMaterial({ map: TEX.charred, roughness: 0.9, emissive: 0xffffff, emissiveMap: TEX.charred, emissiveIntensity: 0.0 }),
    };
    this.floorMats.dahan.onBeforeCompile = sh => {   // only the bright cracks glow
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>',
        `vec4 emc = texture2D( emissiveMap, vUv ); totalEmissiveRadiance = vec3(1.0,0.35,0.05) * smoothstep(0.35,0.6,emc.r - emc.b) * 1.6;`);
    };
    this.flameMat = new T.SpriteMaterial({ map: TEX.flame, blending: T.AdditiveBlending, depthWrite: false, transparent: true });
    this.glowMats = {};

    // coins / gems
    this.coinGeo = new T.CylinderGeometry(0.38, 0.38, 0.09, 22); this.coinGeo.rotateX(Math.PI / 2);
    this.coinMat = new T.MeshStandardMaterial({ color: 0xffd04a, metalness: 0.8, roughness: 0.25, emissive: 0xd08a00, emissiveIntensity: 0.75 });
    this.coinRimGeo = new T.TorusGeometry(0.33, 0.03, 6, 22);
    this.coinRimMat = new T.MeshStandardMaterial({ color: 0xfff0a0, metalness: 1, roughness: 0.2, emissive: 0x6a4000, emissiveIntensity: 0.5 });
    this.gemGeo = new T.OctahedronGeometry(0.42); this.gemGeo.scale(1, 1.4, 1);
    this.gemMat = new T.MeshStandardMaterial({ color: 0xff2d6a, metalness: 0.3, roughness: 0.08, emissive: 0xc0104a, emissiveIntensity: 0.8 });

    // lights
    this.hemi = new T.HemisphereLight(0xffffff, 0x445533, 0.85); scene.add(this.hemi);
    this.sun = new T.DirectionalLight(0xffffff, 2.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera; sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 90;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun); scene.add(this.sun.target);

    // sky dome
    this.skyMat = new T.ShaderMaterial({
      uniforms: { top: { value: new T.Color() }, bot: { value: new T.Color() }, sunCol: { value: new T.Color() }, sunDir: { value: new T.Vector3(0, 1, 0) } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bot; uniform vec3 sunCol; uniform vec3 sunDir; varying vec3 vP;
        void main(){ float h = clamp(vP.y*1.5+0.12, 0.0, 1.0); vec3 c = mix(bot, top, pow(h, 0.75));
          float s = max(dot(vP, normalize(sunDir)), 0.0); c += sunCol*(pow(s, 900.0)*3.0 + pow(s, 12.0)*0.35 + pow(s,3.0)*0.08);
          gl_FragColor = vec4(c, 1.0);
          #include <encodings_fragment>
        }`,
      side: T.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new T.Mesh(new T.SphereGeometry(500, 32, 16), this.skyMat);
    this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    scene.add(this.sky);

    // stars
    const sp = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const u = Math.random() * Math.PI * 2, v = Math.acos(rnd(0.05, 1));
      sp[i * 3] = Math.sin(v) * Math.cos(u) * 450; sp[i * 3 + 1] = Math.cos(v) * 450; sp[i * 3 + 2] = Math.sin(v) * Math.sin(u) * 450;
    }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3));
    this.starMat = new T.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new T.Points(sg, this.starMat); this.stars.frustumCulled = false; this.stars.renderOrder = -9;
    scene.add(this.stars);

    // water / ground plane (follows the player in steps, waves in world space)
    const wg = new T.PlaneGeometry(520, 520, 70, 70); wg.rotateX(-Math.PI / 2);
    this.waterGeo = wg;
    this.waterMat = new T.MeshStandardMaterial({ color: 0x1a74b0, roughness: 0.18, metalness: 0.35, flatShading: true, emissive: 0x000000 });
    this.water = new T.Mesh(wg, this.waterMat); this.water.receiveShadow = false;
    scene.add(this.water);

    this.glowFx = new Particles(900, true); scene.add(this.glowFx.points);
    this.dustFx = new Particles(500, false); scene.add(this.dustFx.points);

    // biome blending state
    this.cur = {}; this.target = null;
    this.setBiome('forest', true);
  },

  setBiome(key, instant) {
    const B = BIOMES[key]; this.biome = key; this.target = B;
    const C = this.cur;
    const cols = ['skyTop', 'skyBot', 'sun', 'fog', 'hemiSky', 'hemiGround', 'dirC', 'water', 'waterEm'];
    if (instant || !C.skyTop) {
      for (const c of cols) C[c] = new THREE.Color(B[c]);
      for (const n of ['fogNear', 'fogFar', 'hemiI', 'dirI', 'waterY', 'stars', 'exposure']) C[n] = B[n];
      C.sunDir = new THREE.Vector3().fromArray(B.sunDir).normalize();
    }
    this._tc = cols.reduce((o, c) => (o[c] = new THREE.Color(B[c]), o), {});
    this._sd = new THREE.Vector3().fromArray(B.sunDir).normalize();
    this.envDirty = true;
  },

  applyBiome(dt) {
    const k = 1 - Math.exp(-dt * 0.9), C = this.cur, B = this.target;
    for (const c in this._tc) C[c].lerp(this._tc[c], k);
    for (const n of ['fogNear', 'fogFar', 'hemiI', 'dirI', 'waterY', 'stars', 'exposure']) C[n] = lerp(C[n], B[n], k);
    C.sunDir.lerp(this._sd, k).normalize();
    const u = this.skyMat.uniforms;
    u.top.value.copy(C.skyTop); u.bot.value.copy(C.skyBot); u.sunCol.value.copy(C.sun); u.sunDir.value.copy(C.sunDir);
    this.scene.fog.color.copy(C.fog); this.scene.fog.near = C.fogNear; this.scene.fog.far = C.fogFar;
    this.hemi.color.copy(C.hemiSky); this.hemi.groundColor.copy(C.hemiGround); this.hemi.intensity = C.hemiI;
    this.sun.color.copy(C.dirC); this.sun.intensity = C.dirI;
    this.waterMat.color.copy(C.water); this.waterMat.emissive.copy(C.waterEm);
    this.starMat.opacity = C.stars;
    this.renderer.toneMappingExposure = C.exposure;
  },

  // Environment map from the current sky, so gold & coins reflect the biome.
  refreshEnv() {
    if (!this.pmrem) this.pmrem = new THREE.PMREMGenerator(this.renderer);
    const s = new THREE.Scene();
    const m = new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), this.skyMat);
    s.add(m);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 16), new THREE.MeshBasicMaterial({ color: this.cur.hemiGround.clone().multiplyScalar(0.6) }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -4; s.add(ground);
    const rt = this.pmrem.fromScene(s, 0.04);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
    m.geometry.dispose(); ground.geometry.dispose(); ground.material.dispose();
  },

  // ---------------------------------------------------------- segments
  reset() {
    for (const s of this.segments) this.dispose(s);
    this.segments = []; this.retired = [];
    this.nextPower = 260; this.nextGem = 420;
    this.glowFx.clear(); this.dustFx.clear();
    this.setBiome('forest', true);
    this.root = this.createSegment(null, 0, []);
    return this.root;
  },

  createSegment(parent, side, hist) {
    let start, dir, distStart, first = false;
    if (!parent) { start = new THREE.Vector3(0, 0, 0); dir = 0; distStart = 0; first = true; }
    else {
      start = parent.start.clone().addScaledVector(DIRV[parent.dir], parent.len + HALF_W);
      dir = (parent.dir + (side > 0 ? 1 : 3)) % 4;
      distStart = parent.distStart + parent.len + HALF_W;
    }
    const seg = { start, dir, distStart, first, len: first ? 150 : rint(80, 135), hist: hist.slice(-2) };
    seg.biome = biomeAt(distStart + 10);
    // never three turns in the same direction (the path would loop onto itself)
    let opts = [['L', 0.38], ['R', 0.38], ['T', 0.24]];
    const h = seg.hist;
    if (h.length >= 2 && h[0] === h[1]) opts = opts.filter(o => o[0] !== (h[1] < 0 ? 'L' : 'R') && o[0] !== 'T');
    let r = Math.random() * opts.reduce((a, o) => a + o[1], 0);
    seg.turn = opts[opts.length - 1][0];
    for (const o of opts) { if ((r -= o[1]) <= 0) { seg.turn = o[0]; break; } }
    seg.hasL = seg.turn !== 'R'; seg.hasR = seg.turn !== 'L';
    seg.childL = seg.childR = null;
    seg.flames = [];
    this.generate(seg);
    this.build(seg);
    this.segments.push(seg);
    return seg;
  },

  ensureAhead(cur, s) {
    let seg = cur, ahead = cur.len - s;
    for (let i = 0; i < 8; i++) {
      if (!seg.childL && !seg.childR) {
        // create one level per frame to spread the work
        if (seg.hasL) seg.childL = this.createSegment(seg, -1, seg.hist.concat(-1));
        if (seg.hasR) seg.childR = this.createSegment(seg, 1, seg.hist.concat(1));
        return;
      }
      if (seg.childL && seg.childR) return;          // T junction: wait for the player's choice
      seg = seg.childL || seg.childR;
      ahead += seg.len + HALF_W;
      if (ahead > 280) return;
    }
  },

  retire(seg, delay) { if (seg && !seg.retiring) { seg.retiring = true; this.retired.push({ seg, t: delay }); } },

  dispose(seg) {
    if (!seg.group) return;
    this.scene.remove(seg.group);
    seg.group.traverse(o => { if (o.userData.own && o.geometry) o.geometry.dispose(); });
    seg.group = null;
    const i = this.segments.indexOf(seg);
    if (i >= 0) this.segments.splice(i, 1);
  },

  // ---------------------------------------------------------- content generation
  generate(seg) {
    seg.obstacles = []; seg.coins = []; seg.items = []; seg.gaps = [];
    const d = clamp(seg.distStart / 4500, 0, 1);
    let s = seg.first ? 60 : 26;
    const end = seg.len - 14;
    let lastFree = [0];
    while (s < end) {
      const pat = this.choosePattern(seg.biome, d, seg.distStart + s);
      const info = this.placePattern(seg, pat, s, d);
      const gap = lerp(34, 18, d) + rnd(0, 10);
      const a = s + (info.after || 3), b = Math.min(s + gap - 6, end + 6);
      lastFree = info.free || [rint(-1, 1)];
      this.fillBetween(seg, a, b, lastFree);
      s += gap;
    }
    if (seg.first) this.coinLine(seg, 0, 18, 50, 1);
  },

  choosePattern(biome, d, wd) {
    const fiery = biome === 'lanka' || biome === 'dahan';
    const P = [
      ['lowFull', 2.0], ['highFull', 2.0], ['blocks', 2.6], ['lowLanes', 1.4],
      ['gap', wd > 150 ? 1.2 : 0], ['rakshasa', wd > 120 ? (fiery ? 2.6 : 1.6) : 0],
      ['mixed', d > 0.15 ? 1.4 : 0], ['double', d > 0.3 ? 1.2 : 0], ['fire', fiery ? 1.6 : 0],
    ];
    let r = Math.random() * P.reduce((a, p) => a + p[1], 0);
    for (const p of P) if ((r -= p[1]) <= 0) return p[0];
    return 'blocks';
  },

  addObs(seg, type, s, l0, l1, extra) {
    const full = l0 === -2;
    const x0 = full ? -HALF_W : l0 * LANE_W - LANE_W / 2 + 0.15;
    const x1 = full ? HALF_W : l1 * LANE_W + LANE_W / 2 - 0.15;
    const D = {
      low: [0, 0.9, 0.45, false, 'stumble'], high: [1.2, 4.5, 0.35, false, 'crash'], block: [0, 8, 1.0, false, 'crash'],
      barricade: [0, 2.0, 0.45, true, 'crash'], fire: [0, 0.9, 0.6, false, 'stumble'], rakshasa: [0, 2.6, 0.5, true, 'crash'],
    }[type];
    const o = { type, s, x0, x1, cx: (x0 + x1) / 2, w: x1 - x0, y0: D[0], y1: D[1], hd: D[2], breakable: D[3], kind: D[4], alive: true, full, lanes: [l0, l1] };
    if (type === 'rakshasa') { o.x0 = o.cx - 0.75; o.x1 = o.cx + 0.75; o.baseX = o.cx; o.ph = Math.random() * 6; }
    Object.assign(o, extra || {});
    seg.obstacles.push(o);
    return o;
  },

  placePattern(seg, pat, s, d) {
    const lanes = [-1, 0, 1].sort(() => Math.random() - 0.5);
    const B = seg.biome;
    switch (pat) {
      case 'lowFull': {
        this.addObs(seg, B === 'dahan' ? 'fire' : 'low', s, -2, -2);
        this.coinArc(seg, pick([-1, 0, 1]), s, 5.5, 2.1);
        return { after: 7, free: [lanes[0]] };
      }
      case 'highFull': {
        this.addObs(seg, 'high', s, -2, -2);
        this.coinLine(seg, lanes[0], s - 5, s + 5, 0.55);
        return { after: 7, free: [lanes[0]] };
      }
      case 'gap': {
        const L = rnd(3.2, 4.2);
        seg.gaps.push({ s0: s - L / 2, s1: s + L / 2 });
        this.coinArc(seg, lanes[0], s, 6, 2.2);
        return { after: 7, free: lanes.slice(0, 1) };
      }
      case 'blocks': {
        const k = Math.random() < lerp(0.75, 0.35, d) ? 1 : 2;
        for (let i = 0; i < k; i++) {
          const t = pick(['block', 'block', 'barricade', seg.distStart + s > 120 ? 'rakshasa' : 'barricade']);
          this.addObs(seg, t, s, lanes[i], lanes[i], t === 'rakshasa' ? this.rkBehaviour(d) : null);
        }
        const free = lanes.slice(k);
        this.coinLine(seg, free[0], s - 10, s + 3, 1);
        return { after: 4, free };
      }
      case 'lowLanes': {
        this.addObs(seg, 'low', s, lanes[0], lanes[0]);
        this.addObs(seg, Math.random() < 0.5 ? 'low' : 'high', s, lanes[1], lanes[1]);
        this.coinArc(seg, lanes[0], s, 5, 2.0);
        return { after: 6, free: [lanes[2]] };
      }
      case 'fire': {
        const k = Math.random() < 0.5 ? 1 : 2;
        for (let i = 0; i < k; i++) this.addObs(seg, 'fire', s, lanes[i], lanes[i]);
        this.coinArc(seg, lanes[0], s, 5, 2.1);
        return { after: 6, free: lanes.slice(k) };
      }
      case 'rakshasa': {
        const k = Math.random() < lerp(0.7, 0.3, d) ? 1 : 2;
        for (let i = 0; i < k; i++) this.addObs(seg, 'rakshasa', s + i * 3, lanes[i], lanes[i], this.rkBehaviour(d));
        this.coinLine(seg, lanes[k], s - 8, s + 4, 1);
        return { after: 6, free: lanes.slice(k) };
      }
      case 'mixed': {
        this.addObs(seg, 'low', s, lanes[0], lanes[0]);
        this.addObs(seg, 'high', s, lanes[1], lanes[1]);
        this.addObs(seg, Math.random() < 0.5 ? 'block' : 'barricade', s, lanes[2], lanes[2]);
        this.coinArc(seg, lanes[0], s, 5, 2.0);
        return { after: 6, free: [lanes[0], lanes[1]] };
      }
      case 'double': {
        this.addObs(seg, 'block', s, lanes[0], lanes[0]);
        this.addObs(seg, 'block', s, lanes[1], lanes[1]);
        const s2 = s + rnd(9, 12);
        const l2 = [-1, 0, 1].filter(l => l !== lanes[2]);
        this.addObs(seg, pick(['block', 'barricade', 'rakshasa']), s2, lanes[2], lanes[2], this.rkBehaviour(0));
        this.coinLine(seg, lanes[2], s - 6, s + 4, 1);
        this.coinLine(seg, pick(l2), s2 - 3, s2 + 3, 1);
        return { after: s2 - s + 4, free: l2 };
      }
    }
    return { after: 3, free: [0] };
  },

  rkBehaviour(d) {
    const r = Math.random();
    if (r < 0.25 + d * 0.2) return { mover: 'walker' };
    if (r < 0.4 + d * 0.3) return { mover: 'swayer' };
    return { mover: 'stand' };
  },

  fillBetween(seg, a, b, free) {
    if (b - a < 4) return;
    const mid = (a + b) / 2, wd = seg.distStart + mid;
    const lane = pick(free);
    if (wd >= this.nextPower) {
      this.nextPower = wd + rnd(280, 430);
      const type = pickWeighted([['magnet', 0.26], ['boost', 0.2], ['shield', 0.2], ['double', 0.18], ['giant', 0.16]]);
      seg.items.push({ kind: 'power', type, s: mid, x: lane * LANE_W, y: 1.2, taken: false });
      this.coinLine(seg, lane, a, mid - 3, 1);
      return;
    }
    if (wd >= this.nextGem) {
      this.nextGem = wd + rnd(500, 900);
      seg.items.push({ kind: 'gem', s: mid, x: lane * LANE_W, y: 1.1, taken: false });
      return;
    }
    if (Math.random() < 0.75) {
      if (Math.random() < 0.3 && free.length > 1) {   // lane-switch coin snake
        const l2 = free.find(l => l !== lane);
        this.coinLine(seg, lane, a, mid - 1, 1);
        this.coinLine(seg, l2, mid + 1, b, 1);
      } else this.coinLine(seg, lane, a, b, 1);
    }
  },

  coinLine(seg, lane, a, b, y) { for (let s = a; s <= b; s += 2.1) seg.coins.push({ s, x: lane * LANE_W, y, taken: false }); },
  coinArc(seg, lane, c, half, h) {
    for (let s = c - half; s <= c + half + 0.01; s += 1.6) {
      const t = (s - c) / half;
      seg.coins.push({ s, x: lane * LANE_W, y: 0.9 + h * (1 - t * t), taken: false });
    }
  },

  // ---------------------------------------------------------- visual build
  build(seg) {
    const g = new THREE.Group();
    g.position.copy(seg.start); g.rotation.y = -seg.dir * Math.PI / 2;
    this.scene.add(g); seg.group = g;
    const B = BIOMES[seg.biome];
    const mg = new Merger();

    // floor pieces between gaps
    const s0 = seg.first ? -40 : HALF_W, s1 = seg.len + TRACK_W;
    const cuts = seg.gaps.slice().sort((a, b) => a.s0 - b.s0);
    let a = s0;
    const pieces = [];
    for (const c of cuts) { pieces.push([a, c.s0]); a = c.s1; }
    pieces.push([a, s1]);
    const fm = this.floorMats[seg.biome];
    for (const [p0, p1] of pieces) {
      const L = p1 - p0; if (L <= 0.05) continue;
      const geo = new THREE.BoxGeometry(TRACK_W, 1.2, L);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * TRACK_W / 4.5, uv.getY(i) * L / 4.5 + p0 / 4.5);
      const m = new THREE.Mesh(geo, fm);
      m.position.set(0, -0.6, -(p0 + p1) / 2); m.receiveShadow = true; m.userData.own = true;
      g.add(m);
      // curbs (open on the junction sides that branch)
      const lenStraight = Math.min(p1, seg.len) - p0;
      for (const side of [-1, 1]) {
        const open = side < 0 ? seg.hasL : seg.hasR;
        const cEnd = open ? Math.min(p1, seg.len) : p1;
        const cl = cEnd - p0;
        if (cl > 0.1) mg.add('matte', 'box', vary(B.curb, 0.5), side * (HALF_W + 0.25), 0.12, -(p0 + cEnd) / 2, 0.5, 0.5, cl);
      }
      if (lenStraight > 0 && seg.biome !== 'ocean') {
        // edge trims below the floor give the path some thickness
        for (const side of [-1, 1]) mg.add('matte', 'box', vary(B.curb, 0.3), side * (HALF_W - 0.1), -1.6, -(p0 + p1) / 2, 0.4, 1.0, L);
      }
    }
    mg.add('matte', 'box', vary(B.curb, 0.4), 0, 0.12, -(seg.len + TRACK_W + 0.25), TRACK_W + 1, 0.5, 0.5);
    // gap edges glow a little so players can read them
    for (const c of cuts) for (const e of [c.s0, c.s1]) mg.add('matte', 'box', 0x2a1a10, 0, -0.05, -e, TRACK_W, 0.12, 0.25);

    this.decorate(seg, mg, B);

    for (const m of mg.build(this.mats)) g.add(m);

    // obstacles
    for (const o of seg.obstacles) {
      if (o.type === 'rakshasa') {
        const R = MODELS.buildRakshasa();
        o.model = R; o.group = R.root;
        R.root.rotation.y = Math.PI;
        R.root.position.set(o.cx, 0, -o.s);
      } else {
        o.group = this.obstacleMesh(o, seg);
        o.group.position.set(o.cx, 0, -o.s);
      }
      g.add(o.group);
    }
    // coins & items
    for (const c of seg.coins) {
      const m = new THREE.Mesh(this.coinGeo, this.coinMat);
      const rim = new THREE.Mesh(this.coinRimGeo, this.coinRimMat); m.add(rim);
      m.position.set(c.x, c.y, -c.s); m.castShadow = true;
      c.mesh = m; g.add(m);
    }
    for (const it of seg.items) {
      it.mesh = it.kind === 'gem' ? this.gemMesh() : this.powerMesh(it.type);
      it.mesh.position.set(it.x, it.y, -it.s);
      g.add(it.mesh);
    }
  },

  addFlame(seg, parent, x, y, z, size) {
    const sp = new THREE.Sprite(this.flameMat);
    sp.position.set(x, y + size * 0.55, z); sp.scale.set(size, size * 1.4, 1);
    sp.userData.base = size; sp.userData.ph = Math.random() * 10;
    parent.add(sp); seg.flames.push(sp);
    return sp;
  },

  decorate(seg, mg, B) {
    const key = seg.biome;
    const sideRange = side => {
      const open = side < 0 ? seg.hasL : seg.hasR;
      return [seg.first ? -40 : TRACK_W, seg.len - (open ? 12 : 1)];
    };
    const jz = -(seg.len + HALF_W);   // junction centre z
    const frontZ = -(seg.len + TRACK_W + 2.5);

    if (key === 'forest') {
      const tree = (x, z, big) => {
        const h = rnd(11, 17) * (big ? 1.3 : 1), base = -10, r = rnd(0.45, 0.8) * (big ? 1.5 : 1);
        mg.add('matte', 'cyl6', vary(0x5b3d26, 0.6), x, base + h / 2, z, r * 2, h, r * 2, rnd(-0.05, 0.05), 0, rnd(-0.05, 0.05));
        const greens = [0x2f6b2a, 0x3d8a35, 0x4f9a3a, 0x2a5a2a, 0x5aa040];
        const n = rint(2, 4);
        for (let i = 0; i < n; i++) {
          const cr = rnd(2.2, 3.6) * (big ? 1.4 : 1);
          mg.add('matte', 'ico', vary(pick(greens), 1), x + rnd(-1.4, 1.4), base + h + rnd(-1.5, 1.8), z + rnd(-1.4, 1.4), cr, cr * rnd(0.75, 1), cr);
        }
        if (Math.random() < 0.4) mg.add('matte', 'cyl6', 0x3f6a2a, x - Math.sign(x) * 0.8, base + h - 2.6, z, 0.08, 5, 0.08);
      };
      for (const side of [-1, 1]) {
        const [a, b] = sideRange(side);
        for (let s = a; s < b; s += rnd(4.5, 8)) {
          const r = Math.random();
          const z = -s;
          if (r < 0.62) tree(side * (HALF_W + rnd(2.4, 10)), z);
          else if (r < 0.82) {   // ruined temple pillar
            const h = rnd(3, 6.5), x = side * (HALF_W + rnd(1.2, 2.2));
            mg.add('matte', 'box', vary(0x8f8a70, 0.5), x, -1 + h / 2, z, 1.1, h + 2, 1.1);
            mg.add('matte', 'box', vary(0x9a9478, 0.5), x, h - 0.6, z, 1.5, 0.45, 1.5);
            if (Math.random() < 0.5) mg.add('matte', 'ico', vary(0x3d7a30, 1), x, h - 0.2, z, 0.8, 0.5, 0.8);
          } else {
            const rr = rnd(0.8, 2.2);
            mg.add('matte', 'dode', vary(0x7a7a6a, 0.8), side * (HALF_W + rnd(1.5, 6)), rr * 0.3, z, rr, rr * 0.7, rr, rnd(0, 3), rnd(0, 3), 0);
          }
        }
      }
      // overhead ruined arches (decor only, high above the player)
      for (let s = 40; s < seg.len - 20; s += rnd(45, 80)) {
        if (Math.random() < 0.6) continue;
        for (const side of [-1, 1]) mg.add('matte', 'box', vary(0x8f8a70, 0.4), side * (HALF_W + 0.9), 2.5, -s, 1.0, 9, 1.0);
        mg.add('matte', 'box', vary(0x9a9478, 0.4), 0, 7.4, -s, TRACK_W + 3.2, 1.0, 1.3);
        mg.add('matte', 'cone4', vary(0x9a9478, 0.4), 0, 8.4, -s, 1.6, 1.2, 1.0, 0, Math.PI / 4, 0);
        for (let i = 0; i < 5; i++) mg.add('matte', 'cyl6', 0x3f7a2a, rnd(-3.5, 3.5), 6.2, -s + rnd(-0.4, 0.4), 0.07, rnd(1.2, 2.4), 0.07);
      }
      // support pillars
      for (let s = seg.first ? -30 : 10; s < seg.len; s += 18) for (const side of [-1, 1]) mg.add('matte', 'cyl6', 0x6a6a58, side * (HALF_W - 1.2), -12, -s, 1.6, 22, 1.6);
      // junction: big temple wall ahead
      mg.add('matte', 'box', vary(0x8a8268, 0.3), 0, 3, frontZ - 1, TRACK_W + 10, 14, 2);
      for (let i = -3; i <= 3; i++) mg.add('matte', 'box', vary(0x9a9278, 0.3), i * 2.2, 10.5, frontZ - 1, 1.2, 1.2, 2.2);
      mg.add('matte', 'cone4', 0xa09878, 0, 13, frontZ - 1, 5, 6, 2, 0, Math.PI / 4, 0);
      tree(-9, frontZ - 6, true); tree(9, frontZ - 6, true);
      for (const side of [-1, 1]) {
        const open = side < 0 ? seg.hasL : seg.hasR;
        if (!open) { mg.add('matte', 'box', vary(0x8a8268, 0.3), side * (HALF_W + 10), 2, jz, 2, 8, TRACK_W + 6); tree(side * (HALF_W + 13), jz, true); }
      }
    } else if (key === 'ocean') {
      for (const side of [-1, 1]) {
        const [a, b] = sideRange(side);
        for (let s = a; s < b; s += rnd(3, 6)) {
          const rr = rnd(0.5, 1.6);
          mg.add('matte', 'dode', vary(0xb8a888, 0.8), side * (HALF_W + rnd(0.8, 14)), -2.2 + rnd(-0.2, 0.5), -s, rr, rr * 0.55, rr, rnd(0, 3), rnd(0, 3), 0);
        }
        for (let s = a + 4; s < b; s += 16) {         // saffron flags along the setu
          const x = side * (HALF_W + 0.25);
          mg.add('matte', 'cyl6', 0x6a4a2a, x, 2.0, -s, 0.14, 4.4, 0.14);
          mg.add('smooth', 'box', vary(0xf07a1a, 0.4), x + side * 0.55, 3.7, -s, 1.0, 0.65, 0.05, 0, 0, side * -0.1);
          mg.add('smooth', 'sph', 0xffd060, x, 4.25, -s, 0.12);
        }
        for (let s = a; s < b; s += rnd(30, 55)) {   // distant islands with palms
          const x = side * rnd(26, 60), z = -s, R = rnd(4, 9);
          mg.add('matte', 'dode', vary(0x9a8a62, 0.6), x, -3.5, z, R, R * 0.45, R);
          mg.add('matte', 'ico', vary(0x4a8a3a, 0.6), x, -1.4, z, R * 0.8, R * 0.25, R * 0.8);
          for (let p = 0; p < 2; p++) {
            const px = x + rnd(-2, 2), pz = z + rnd(-2, 2), ph = rnd(4, 7);
            mg.add('matte', 'cyl6', 0x7a5a36, px, -1 + ph / 2, pz, 0.35, ph, 0.35, 0, 0, rnd(-0.2, 0.2));
            for (let l = 0; l < 5; l++) mg.add('matte', 'cone4', vary(0x3d8a35, 0.5), px + Math.cos(l * 1.25) * 1.2, -1 + ph, pz + Math.sin(l * 1.25) * 1.2, 0.6, 2.6, 0.2, Math.sin(l * 1.25) * 1.3, 0, -Math.cos(l * 1.25) * 1.3);
          }
        }
      }
      for (let s = seg.first ? -30 : 8; s < seg.len; s += 9) for (const side of [-1, 1]) mg.add('matte', 'dode', vary(0x9a8a70, 0.5), side * (HALF_W - 1.5), -1.9, -s, 1.4, 0.9, 1.4);
      // junction: rock formation ahead
      for (let i = 0; i < 6; i++) { const R = rnd(2, 4.5); mg.add('matte', 'dode', vary(0x8a7a62, 0.6), rnd(-6, 6), R * 0.5 - 1.5, frontZ - rnd(1, 6), R, R * 1.3, R, rnd(0, 3), rnd(0, 3), 0); }
      for (const side of [-1, 1]) { const open = side < 0 ? seg.hasL : seg.hasR; if (!open) { const R = 3; mg.add('matte', 'dode', vary(0x8a7a62, 0.6), side * (HALF_W + 11), 0.5, jz, R, R, R); } }
    } else {
      // Lanka & burning Lanka
      const burning = key === 'dahan';
      const wallC = burning ? 0x4a3028 : 0xd6a246, trimC = burning ? 0x2a1a14 : 0xe8b440, domeC = burning ? 0x3a2418 : 0xf2c040;
      const ch = burning ? 'matte' : 'metal';
      for (const side of [-1, 1]) {
        const [a, b] = sideRange(side);
        const len = b - a; if (len <= 0) continue;
        const x = side * (HALF_W + 1.6);
        mg.add('matte', 'box', vary(wallC, 0.3), x, -1.0, -(a + b) / 2, 1.2, 12, len);
        mg.add(ch, 'box', trimC, x - side * 0.62, 3.6, -(a + b) / 2, 0.1, 0.35, len);
        for (let s = a + 1; s < b; s += 2.2) mg.add('matte', 'box', vary(wallC, 0.3), x, 5.4, -s, 1.2, 0.8, 1.1);
        for (let s = a + 8; s < b - 2; s += 24) {          // towers with golden domes
          const tx = side * (HALF_W + 2.4);
          mg.add('matte', 'cyl', vary(wallC, 0.3), tx, 2.5, -s, 3, 13, 3);
          mg.add(ch, 'tor', trimC, tx, 8.4, -s, 1.55, 1.55, 1.55, Math.PI / 2, 0, 0);
          mg.add(ch, 'onion', domeC, tx, 9, -s, 1.6, 1.4, 1.6);
          mg.add(ch, 'cone', trimC, tx, 12.2, -s, 0.25, 1.4, 0.25);
          if (burning) this.addFlame(seg, seg.group, tx, 9.5, -s, rnd(3, 5));
        }
        for (let s = a + 3; s < b; s += 12) {              // torches
          const tx = side * (HALF_W + 0.55);
          mg.add('matte', 'cyl6', 0x3a2a1a, tx, 0.9, -s, 0.14, 1.8, 0.14);
          mg.add(ch, 'cyl', trimC, tx, 1.85, -s, 0.36, 0.22, 0.36);
          this.addFlame(seg, seg.group, tx, 1.9, -s, 0.75);
        }
        if (burning) for (let s = a + 2; s < b; s += rnd(5, 9)) this.addFlame(seg, seg.group, x, 5.6, -s, rnd(1.6, 3.2));
        // palaces behind the walls
        for (let s = a; s < b; s += rnd(10, 18)) {
          const px = side * rnd(12, 30), w = rnd(4, 9), h = rnd(6, 18);
          mg.add('matte', 'box', vary(burning ? 0x3a2620 : 0xc89040, 0.4), px, -7 + h / 2 + 4, -s, w, h + 8, w);
          mg.add(ch, 'onion', domeC, px, h - 3 + 4, -s, w * 0.42, w * 0.38, w * 0.42);
          for (let wy = 1; wy < h - 2; wy += 3) mg.add('glow', 'box', burning ? 0xff5a10 : 0xffc870, px - side * w / 2, wy, -s + rnd(-1, 1), 0.1, 0.9, 0.6);
          if (burning && Math.random() < 0.6) this.addFlame(seg, seg.group, px, h + 2, -s, rnd(4, 8));
        }
      }
      // junction: closed palace gate ahead
      mg.add('matte', 'box', vary(wallC, 0.2), 0, 2, frontZ - 1, TRACK_W + 8, 12, 2);
      mg.add(ch, 'box', trimC, 0, 1.8, frontZ + 0.05, 4.4, 5.6, 0.3);
      mg.add('matte', 'box', burning ? 0x1a0e0a : 0x5a2a10, 0, 1.6, frontZ + 0.15, 3.6, 5, 0.3);
      mg.add(ch, 'onion', domeC, 0, 8, frontZ - 1, 3, 2.4, 3);
      for (const sx of [-1, 1]) this.addFlame(seg, seg.group, sx * 2.8, 1.5, frontZ + 0.6, 1.0);
      for (const side of [-1, 1]) {
        const open = side < 0 ? seg.hasL : seg.hasR;
        if (!open) mg.add('matte', 'box', vary(wallC, 0.2), side * (HALF_W + 10), -1, jz, 1.2, 12, TRACK_W + 8);
      }
    }
  },

  obstacleCache: {},
  obstacleMesh(o, seg) {
    const B = seg.biome, key = `${B}|${o.type}|${o.full ? 'f' : 'l'}`;
    const group = new THREE.Group();
    let cached = this.obstacleCache[key];
    if (!cached) {
      const mg = new Merger();
      const w = o.full ? TRACK_W : LANE_W - 0.3;
      this.obstacleShape(mg, o.type, B, w);
      cached = this.obstacleCache[key] = mg.build(this.mats, { cast: true }).map(m => { m.userData.own = false; return m.geometry; });
      cached.mats = Object.keys(mg.ch);
    }
    cached.forEach((geo, i) => {
      const m = new THREE.Mesh(geo, this.mats[cached.mats[i]]);
      m.castShadow = true; m.receiveShadow = true; group.add(m);
    });
    // flames are sprites (not merged)
    if (o.type === 'fire' || (B === 'dahan' && (o.type === 'low' || o.type === 'high'))) {
      const w = o.full ? TRACK_W : LANE_W - 0.3;
      const n = Math.max(1, Math.round(w / 1.6));
      for (let i = 0; i < n; i++) this.addFlame(seg, group, (i + 0.5) / n * w - w / 2, o.type === 'high' ? 1.9 : 0.25, 0, o.type === 'fire' ? 1.4 : 1.1);
    }
    return group;
  },

  obstacleShape(mg, type, B, w) {
    const hw = w / 2;
    const wood = B === 'dahan' ? 0x2a1810 : 0x6b4426, stone = B === 'ocean' ? 0xb0a080 : B === 'dahan' ? 0x3a2a24 : 0x7d7a6a;
    const goldy = B === 'lanka' || B === 'dahan';
    const ch = B === 'lanka' ? 'metal' : 'matte';
    switch (type) {
      case 'low':
        if (B === 'ocean') {
          mg.add('matte', 'box', vary(stone, 0.4), 0, 0.42, 0, w, 0.84, 0.9);
          for (let x = -hw + 0.6; x < hw; x += 1.2) mg.add('matte', 'dode', vary(stone, 0.6), x, 0.75, 0, 0.5, 0.35, 0.5);
        } else if (goldy) {
          for (let x = -hw + 0.2; x <= hw; x += Math.max(0.6, w / 6)) mg.add(ch, 'cyl6', 0xd8a030, x, 0.45, 0, 0.14, 0.9, 0.14);
          mg.add(ch, 'box', 0xe8b440, 0, 0.85, 0, w, 0.12, 0.16);
          mg.add(ch, 'box', 0xe8b440, 0, 0.45, 0, w, 0.08, 0.12);
          mg.add('matte', 'box', 0x5a1a1a, 0, 0.05, 0, w, 0.1, 0.5);
        } else {
          mg.add('matte', 'cyl', vary(wood, 0.3), 0, 0.45, 0, 0.9, w, 0.9, 0, 0, Math.PI / 2);
          for (const sx of [-1, 1]) mg.add('matte', 'cyl', 0xb08a5a, sx * hw, 0.45, 0, 0.75, 0.04, 0.75, 0, 0, Math.PI / 2);
          for (let x = -hw + 0.8; x < hw; x += rnd(1.2, 2)) mg.add('matte', 'ico', vary(0x3f8a30, 1), x, 0.85, 0, 0.35, 0.18, 0.35);
        }
        break;
      case 'high': {
        const pc = goldy ? 0xd8a030 : B === 'ocean' ? stone : wood;
        for (const sx of [-1, 1]) {
          mg.add(goldy ? ch : 'matte', 'cyl6', vary(pc, 0.2), sx * (hw - 0.2), 1.6, 0, 0.38, 3.2, 0.38);
        }
        if (goldy) {
          mg.add(ch, 'box', 0xe8b440, 0, 1.75, 0, w, 0.55, 0.45);
          mg.add('matte', 'box', 0x8a1a1a, 0, 2.15, 0, w * 0.9, 0.3, 0.5);
          for (let x = -hw + 0.6; x < hw - 0.3; x += 0.9) { mg.add(ch, 'cyl6', 0xc89028, x, 1.4, 0, 0.03, 0.2, 0.03); mg.add(ch, 'sph', 0xf0c040, x, 1.3, 0, 0.11); }
        } else if (B === 'ocean') {
          mg.add('matte', 'box', vary(stone, 0.3), 0, 1.85, 0, w + 0.4, 0.8, 0.8);
          mg.add('matte', 'box', vary(0xf07a1a, 0.2), 0, 1.4, 0, w * 0.8, 0.12, 0.05);
        } else {
          mg.add('matte', 'cyl', vary(wood, 0.3), 0, 1.75, 0, 0.6, w + 0.3, 0.6, 0, 0, Math.PI / 2);
          for (let x = -hw + 0.4; x < hw; x += 0.5) mg.add('matte', 'cyl6', vary(0x3f7a2a, 0.8), x, 1.45, 0, 0.06, rnd(0.25, 0.55), 0.06);
          for (let x = -hw + 0.5; x < hw; x += 1.3) mg.add('matte', 'ico', vary(0x3f8a30, 1), x, 2.05, 0, 0.45, 0.3, 0.45);
        }
        break;
      }
      case 'block':
        if (B === 'forest') {
          mg.add('matte', 'dode', vary(stone, 0.5), 0, 1.1, 0, 1.25, 1.2, 1.1, 0.4, 0.7, 0.1);
          mg.add('matte', 'dode', vary(stone, 0.5), 0.2, 2.3, 0.1, 0.8, 0.7, 0.8, 1, 0.2, 0);
          mg.add('matte', 'ico', 0x3f8a30, 0, 2.8, 0, 0.6, 0.3, 0.6);
        } else if (B === 'ocean') {
          mg.add('matte', 'dode', vary(stone, 0.5), 0, 1.0, 0, 1.2, 1.1, 1.0, 0.3, 0.2, 0);
          mg.add('matte', 'dode', vary(stone, 0.5), 0, 2.3, 0, 0.85, 0.8, 0.8, 0.9, 1, 0);
          mg.add('matte', 'dode', vary(stone, 0.5), 0, 3.2, 0, 0.5, 0.5, 0.5);
        } else {
          mg.add('matte', 'box', vary(B === 'dahan' ? 0x3a2a24 : 0xc89040, 0.2), 0, 0.3, 0, 2.1, 0.6, 1.8);
          mg.add('matte', 'cyl', vary(B === 'dahan' ? 0x3a2a24 : 0xd6a246, 0.2), 0, 2.4, 0, 1.3, 3.6, 1.3);
          mg.add(ch, 'tor', 0xe8b440, 0, 1.0, 0, 0.66, 0.66, 0.66, Math.PI / 2, 0, 0);
          mg.add(ch, 'tor', 0xe8b440, 0, 3.8, 0, 0.66, 0.66, 0.66, Math.PI / 2, 0, 0);
          mg.add(ch, 'box', 0xe8b440, 0, 4.4, 0, 1.8, 0.4, 1.8);
          mg.add(ch, 'onion', B === 'dahan' ? 0x3a2418 : 0xf2c040, 0, 4.6, 0, 0.7, 0.6, 0.7);
        }
        break;
      case 'barricade':
        if (goldy) {   // stacked kalash pots
          const pc = B === 'dahan' ? 0x6a3a20 : 0xe8b440;
          for (const [x, y, s] of [[-0.6, 0.45, 0.48], [0.6, 0.45, 0.48], [0, 0.45, 0.48], [-0.3, 1.25, 0.42], [0.3, 1.25, 0.42], [0, 1.95, 0.36]]) {
            mg.add(ch, 'sph', vary(pc, 0.3), x, y, 0, s, s * 0.9, s);
            mg.add(ch, 'cyl', vary(pc, 0.3), x, y + s * 0.85, 0, s * 0.6, s * 0.4, s * 0.6);
            mg.add('matte', 'tor', 0xb01818, x, y + 0.05, 0, s * 0.95, s * 0.95, s * 0.95, Math.PI / 2, 0, 0);
          }
        } else {
          const wc = B === 'ocean' ? 0x8a6a40 : wood;
          for (const r of [-0.65, 0.65]) mg.add('matte', 'box', vary(wc, 0.3), 0, 1.0, 0, 0.25, 2.5, 0.2, 0, 0, r);
          mg.add('matte', 'box', vary(wc, 0.3), 0, 1.4, 0.05, w - 0.1, 0.25, 0.2);
          mg.add('matte', 'box', vary(wc, 0.3), 0, 0.55, 0.05, w - 0.1, 0.25, 0.2);
          for (let x = -hw + 0.35; x < hw; x += 0.55) mg.add('matte', 'cone', 0xddd0b0, x, 2.0, 0, 0.1, 0.5, 0.1);
          mg.add('matte', 'box', vary(0x8a6038, 0.3), hw - 0.5, 0.4, 0.5, 0.8, 0.8, 0.8);
        }
        break;
      case 'fire':
        mg.add(B === 'lanka' ? 'metal' : 'matte', 'cyl', B === 'lanka' ? 0xc89028 : 0x2a1a14, 0, 0.25, 0, w * 0.95, 0.5, 1.1);
        mg.add('glow', 'cyl', 0xff6a10, 0, 0.51, 0, w * 0.85, 0.04, 0.95);
        for (let x = -hw + 0.4; x < hw; x += 0.7) mg.add('matte', 'dode', 0x1a0a06, x, 0.55, rnd(-0.2, 0.2), 0.22);
        break;
    }
  },

  gemMesh() {
    const m = new THREE.Mesh(this.gemGeo, this.gemMat);
    const glow = new THREE.Sprite(this.glowMat(0xff3a7a)); glow.scale.set(2, 2, 1); m.add(glow);
    return m;
  },
  glowMat(color) {
    return this.glowMats[color] || (this.glowMats[color] = new THREE.SpriteMaterial({ map: TEX.dot, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
  },
  iconTex: {},
  powerMesh(type) {
    const P = POWERS[type];
    if (!this.iconTex[type]) {
      this.iconTex[type] = canvasTex(128, (g, s) => {
        g.fillStyle = P.color; g.beginPath(); g.arc(s / 2, s / 2, s * 0.46, 0, 7); g.fill();
        g.strokeStyle = '#fff6d0'; g.lineWidth = 6; g.stroke();
        g.font = `${s * 0.5}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
        g.fillText(P.icon, s / 2, s / 2 + 4);
      });
    }
    const grp = new THREE.Group();
    const glow = new THREE.Sprite(this.glowMat(new THREE.Color(P.color).getHex())); glow.scale.set(2.6, 2.6, 1); grp.add(glow);
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.iconTex[type], depthWrite: false, transparent: true })); icon.scale.set(1.1, 1.1, 1); grp.add(icon);
    const ringG = this.ringGeo || (this.ringGeo = new THREE.TorusGeometry(0.75, 0.05, 8, 32));
    const ring = new THREE.Mesh(ringG, this.coinRimMat); grp.add(ring); grp.userData.ring = ring;
    return grp;
  },

  // ---------------------------------------------------------- per-frame
  update(dt, focus, camera) {
    this.time += dt;
    const t = this.time;
    this.applyBiome(dt);
    if (this.envDirty && this.envTimer === undefined) this.envTimer = 3.5;
    if (this.envTimer !== undefined) { this.envTimer -= dt; if (this.envTimer <= 0) { this.envTimer = undefined; this.envDirty = false; this.refreshEnv(); } }

    this.sky.position.copy(camera.position); this.stars.position.copy(camera.position);
    this.sun.position.copy(focus).addScaledVector(this.cur.sunDir, 40); this.sun.target.position.copy(focus);

    // water waves in world space
    const wx = Math.round(focus.x / 8) * 8, wz = Math.round(focus.z / 8) * 8;
    this.water.position.set(wx, this.cur.waterY, wz);
    const p = this.waterGeo.attributes.position;
    const lava = this.biome === 'dahan' ? 0.5 : 1;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + wx, z = p.getZ(i) + wz;
      p.setY(i, (Math.sin(x * 0.11 + t * 1.3 * lava) * 0.35 + Math.cos(z * 0.13 + t * 1.1 * lava) * 0.3 + Math.sin((x + z) * 0.05 + t * 0.6) * 0.4));
    }
    p.needsUpdate = true;   // flat shading derives normals in the shader

    // flames, coins, items
    for (const seg of this.segments) {
      for (const f of seg.flames) {
        const b = f.userData.base, ph = f.userData.ph;
        f.scale.set(b * (1 + 0.12 * Math.sin(t * 13 + ph)), b * 1.4 * (1 + 0.2 * Math.sin(t * 9.3 + ph * 1.7)), 1);
      }
      for (const c of seg.coins) if (!c.taken) c.mesh.rotation.y = t * 3.2 + c.s * 0.2;
      for (const it of seg.items) if (!it.taken) {
        it.mesh.position.y = it.y + Math.sin(t * 3 + it.s) * 0.18;
        if (it.kind === 'gem') it.mesh.rotation.y = t * 2.5;
        else it.mesh.userData.ring.rotation.set(t * 1.7, t * 2.3, 0);
      }
    }
    // embers in burning Lanka
    if (this.biome === 'dahan') {
      for (let i = 0; i < 3; i++) this.glowFx.spawn(focus.x + rnd(-25, 25), focus.y + rnd(-2, 6), focus.z + rnd(-25, 25), rnd(-1, 1), rnd(1.5, 4), rnd(-1, 1), pick([0xff8a20, 0xffc040, 0xff5010]), rnd(0.08, 0.18), rnd(1.5, 3), -0.3, 0.2, 1);
    }
    for (let i = this.retired.length - 1; i >= 0; i--) {
      const r = this.retired[i]; r.t -= dt;
      if (r.t <= 0) { this.dispose(r.seg); this.retired.splice(i, 1); }
    }
    this.glowFx.update(dt); this.dustFx.update(dt);
  },

  setParticleScale(h, fov) {
    const sc = h / (2 * Math.tan(fov * Math.PI / 360));
    this.glowFx.mat.uniforms.uScale.value = sc; this.dustFx.mat.uniforms.uScale.value = sc;
  },
};

const POWERS = {
  magnet: { name: 'Coin Magnet', icon: '🧲', color: '#d8323a', base: 10, desc: 'Pulls every nearby coin to you.' },
  boost: { name: 'Vayu Flight', icon: '🌪️', color: '#2aa8d8', base: 4.5, desc: 'Fly like the son of Vayu: fast & invincible.' },
  shield: { name: 'Ram Kavach', icon: '🛡️', color: '#3a6ae0', base: 12, desc: 'A divine shield that absorbs one crash.' },
  double: { name: 'Double Coins', icon: '✖2', color: '#e0a020', base: 12, desc: 'Every coin counts twice.' },
  giant: { name: 'Virat Roop', icon: '💪', color: '#d0601a', base: 6, desc: 'Grow giant and smash through everything.' },
};
function pickWeighted(list) {
  let r = Math.random() * list.reduce((a, p) => a + p[1], 0);
  for (const p of list) if ((r -= p[1]) <= 0) return p[0];
  return list[0][0];
}
