'use strict';
(() => {
  const T = THREE, PI = Math.PI;
  const START_SPEED = 13, MAX_SPEED = 31, SPEED_GAIN = 0.0042;
  const GRAV = 32, JUMP_V = 11.5, BOOST_Y = 4.2, SLIDE_T = 0.75;
  const UPGRADE_COST = [400, 1000, 2200, 4500, 8000];
  const HEADSTART_COST = 1500, GEM_COST = 2500;
  const $ = id => document.getElementById(id);

  // ================================================================ save data
  const SAVE_KEY = 'hanumanRun.v1';
  const DEFAULT = {
    coins: 0, gems: 3, best: 0, bestDist: 0, reachedLanka: false, runs: 0,
    upgrades: { magnet: 0, boost: 0, shield: 0, double: 0, giant: 0 }, headStarts: 0,
    missionsDone: 0, missions: null, sound: true, music: true, vibrate: true, totalSmash: 0, quality: 0,
  };
  const MT = {
    coins: { stat: 'coins', base: 120, step: 90, text: n => `Collect ${n} coins in one run` },
    dist: { stat: 'dist', base: 700, step: 450, text: n => `Run ${n} m in one run` },
    smash: { stat: 'smash', base: 3, step: 3, text: n => `Smash ${n} rakshasas with your gada` },
    powers: { stat: 'powers', base: 2, step: 1, text: n => `Collect ${n} power-ups in one run` },
    jumps: { stat: 'jumps', base: 20, step: 10, text: n => `Jump ${n} times in one run` },
    slides: { stat: 'slides', base: 12, step: 8, text: n => `Slide ${n} times in one run` },
    score: { stat: 'score', base: 2500, step: 2500, text: n => `Score ${n} points in one run` },
  };
  let Save;
  function newMission(type, level) { const m = MT[type]; return { type, target: Math.round(m.base + m.step * level) }; }
  function loadSave() {
    let d = {};
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') || {}; } catch (e) { d = {}; }
    Save = Object.assign(JSON.parse(JSON.stringify(DEFAULT)), d);
    Save.upgrades = Object.assign({}, DEFAULT.upgrades, d.upgrades || {});
    if (!Array.isArray(Save.missions) || Save.missions.length !== 3 || Save.missions.some(m => !MT[m.type])) {
      Save.missions = [newMission('coins', 0), newMission('dist', 0), newMission('smash', 0)];
    }
  }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(Save)); } catch (e) { /* storage unavailable */ } }
  function replaceMission(i) {
    const used = Save.missions.map(m => m.type);
    const types = Object.keys(MT).filter(t => !used.includes(t));
    Save.missions[i] = newMission(pick(types), Math.floor(Save.missionsDone / 2));
  }
  const mult = () => 1 + Math.floor(Save.missionsDone / 3);
  const powerDur = k => POWERS[k].base * (1 + 0.22 * Save.upgrades[k]);

  // ================================================================ renderer
  const canvas = $('c');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  scene.fog = new T.Fog(0xa8d0b8, 30, 165);
  const camera = new T.PerspectiveCamera(62, 1, 0.1, 800);
  let baseFov = 62;

  World.init(scene, renderer);
  World.applyBiome(0);
  World.refreshEnv();

  let hero = MODELS.buildHanuman();
  scene.add(hero.root);
  // A real artist-made model (models/hanuman.glb), if present, replaces the built-in one.
  loadHeroGLB(h => {
    h.root.position.copy(hero.root.position); h.root.rotation.copy(hero.root.rotation);
    scene.remove(hero.root); hero = h; scene.add(hero.root);
  });
  const chaser = MODELS.buildRakshasa(0x5a1e3a);
  chaser.root.scale.setScalar(0.85);
  chaser.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(chaser.root);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    baseFov = w / h < 0.7 ? 70 : 60;
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
    World.setParticleScale(h * renderer.getPixelRatio(), camera.fov);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- adaptive quality: lower resolution / shadows when the device can't hold ~40 fps
  const QUALITY = [1.75, 1.3, 1.0, 0.75, 0.55];
  let qLevel = 0, fpsFrames = 0, fpsTime = 0, fpsWarm = 1.5, qRaised = false;
  function applyQuality(level) {
    qLevel = clamp(level | 0, 0, QUALITY.length - 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY[qLevel]));
    const shadows = qLevel < 2;
    if (renderer.shadowMap.enabled !== shadows) {
      renderer.shadowMap.enabled = shadows; World.sun.castShadow = shadows;
      scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); });
    }
    resize();
  }
  function trackFps(rawDt) {
    if (NO_AUTO_QUALITY) return;
    if (fpsWarm > 0) { fpsWarm -= rawDt; return; }
    fpsFrames++; fpsTime += rawDt;
    if (fpsTime < 2.5) return;
    const fps = fpsFrames / fpsTime;
    fpsFrames = 0; fpsTime = 0;
    if (fps < 38 && qLevel < QUALITY.length - 1) {
      applyQuality(qLevel + 1); fpsWarm = 1.0;
      Save.quality = qLevel; persist();
    } else if (fps > 58 && qLevel > 0 && !qRaised) {   // a past hitch shouldn't lock quality low forever
      qRaised = true; applyQuality(qLevel - 1); fpsWarm = 1.0;
      Save.quality = qLevel; persist();
    }
  }

  // ================================================================ state
  let state = 'menu';
  const P = { vis: new T.Vector3(), power: { magnet: 0, boost: 0, shield: 0, double: 0, giant: 0 }, powerMax: {} };
  let run = {};
  let needsReset = false, gt = 0, phase = 0, shakeAmt = 0, camYaw = 0, chaserDist = 30, chaseK = 0, camRate = 8;
  let reviveT = 0, lastCoinSfx = 0;
  const heroPos = new T.Vector3(), camLook = new T.Vector3(), camOff = new T.Vector3(0, 1.3, -3.3), lookOff = new T.Vector3(0, 1.02, 0), desired = new T.Vector3(), lookDesired = new T.Vector3();
  const _v1 = new T.Vector3(), _v2 = new T.Vector3(), _v3 = new T.Vector3(), _v4 = new T.Vector3();

  const segYaw = seg => -seg.dir * PI / 2;
  function angLerp(a, b, t) { let d = ((b - a + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI; return a + d * t; }
  const baseSpeed = () => Math.min(MAX_SPEED, START_SPEED + run.dist * SPEED_GAIN);

  function newRun() {
    const root = World.reset();
    Object.assign(P, {
      seg: root, s: 4, x: 0, y: 0, vy: 0, lane: 0, prevLane: 0, grounded: true, slide: 0, speed: 0,
      smashT: -1, smashCD: 0, yaw: 0, invuln: 0, chaser: 0, stumbleSlow: 0, alive: true, deathT: 0, deathType: '',
      slideOnLand: false, giantScale: 1, queuedTurn: 0,
    });
    P.vis.set(0, 0, 0);
    for (const k in P.power) P.power[k] = 0;
    run = { score: 0, dist: 0, coins: 0, gems: 0, smash: 0, powers: 0, jumps: 0, slides: 0, revives: 0, time: 0, biome: 'forest', lanka: false };
    for (let i = 0; i < 4; i++) World.ensureAhead(root, P.s);
    camYaw = 0; chaserDist = 30;
    clearPowerBars();
  }

  // ================================================================ input
  function input(a) {
    if (state !== 'playing') return;
    if (a === 'left' || a === 'right') {
      const side = a === 'left' ? -1 : 1, seg = P.seg;
      const has = side < 0 ? seg.hasL : seg.hasR;
      if (has && P.s >= seg.len - 16) {
        if (P.s >= seg.len - 5) { if (tryTurn(side)) return; }
        else { P.queuedTurn = side; return; }
      }
      changeLane(side);
    } else if (a === 'up') jump();
    else if (a === 'down') slide();
    else if (a === 'tap') smash();
  }
  let ptr = null;
  const swipePx = () => Math.max(22, Math.min(44, window.innerWidth * 0.06));
  window.addEventListener('pointerdown', e => {
    if (e.target.closest && e.target.closest('button, .panel')) return;
    ptr = { x: e.clientX, y: e.clientY, t: performance.now(), done: false, id: e.pointerId };
  });
  window.addEventListener('pointermove', e => {
    if (!ptr || ptr.done || e.pointerId !== ptr.id) return;
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
    if (Math.hypot(dx, dy) > swipePx()) {
      ptr.done = true;
      if (Math.abs(dx) > Math.abs(dy)) input(dx > 0 ? 'right' : 'left'); else input(dy < 0 ? 'up' : 'down');
    }
  });
  window.addEventListener('pointerup', e => {
    if (!ptr || e.pointerId !== ptr.id) return;
    if (!ptr.done && performance.now() - ptr.t < 350) input('tap');
    ptr = null;
  });
  window.addEventListener('pointercancel', () => { ptr = null; });
  window.addEventListener('keydown', e => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') input('left');
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') input('right');
    else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') input('up');
    else if (k === 'ArrowDown' || k === 's' || k === 'S') input('down');
    else if (k === 'f' || k === 'F' || k === 'Enter' || k === 'x' || k === 'X') input('tap');
    else if (k === 'Escape' || k === 'p' || k === 'P') { if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame(); }
    else return;
    e.preventDefault();
  });

  // ================================================================ actions
  function changeLane(side) {
    const nl = clamp(P.lane + side, -1, 1);
    if (nl === P.lane) { shake(0.08); return; }
    P.prevLane = P.lane; P.lane = nl;
    SFX.play('lane');
  }
  function jump() {
    if (P.power.boost > 0 || !P.grounded) return;
    P.vy = JUMP_V; P.grounded = false; P.slide = 0; run.jumps++;
    SFX.play('jump');
  }
  function slide() {
    if (P.power.boost > 0) return;
    if (P.grounded) { if (P.slide <= 0) { run.slides++; SFX.play('slide'); } P.slide = SLIDE_T; }
    else { P.vy = Math.min(P.vy, -24); P.slideOnLand = true; }
  }
  function smash() {
    if (P.smashCD > 0 || P.power.boost > 0) return;
    P.smashT = 0; P.smashCD = 0.48;
    SFX.play('smashSwing');
  }

  function tryTurn(side, force) {
    const seg = P.seg;
    const child = side < 0 ? seg.childL : seg.childR;
    if (!child) return false;
    if (!force && !(P.s >= seg.len - 5 && P.s <= seg.len + TRACK_W)) return false;
    const wp = segPoint(seg, P.s, P.x, 0, _v1);
    const rel = _v2.copy(wp).sub(child.start);
    const ns = Math.max(rel.dot(DIRV[child.dir]), -HALF_W + 0.5);
    const nx = clamp(rel.dot(RIGHTV[child.dir]), -LANE_W, LANE_W);
    const after = segPoint(child, ns, nx, 0, _v3);
    P.vis.add(_v4.copy(wp).sub(after));          // hide the snap: rendered position eases over
    P.seg = child; P.s = ns; P.x = nx;
    P.lane = Math.round(nx / LANE_W); P.prevLane = P.lane; P.queuedTurn = 0;
    const other = side < 0 ? seg.childR : seg.childL;
    World.retire(seg, 1.5);
    if (other) World.retire(other, 0.8);
    SFX.play('turn');
    return true;
  }
  function autoTurn() {
    const seg = P.seg;
    let side = P.queuedTurn;
    if (!side || !(side < 0 ? seg.childL : seg.childR)) side = seg.childL && seg.childR ? (Math.random() < 0.5 ? -1 : 1) : (seg.childL ? -1 : 1);
    tryTurn(side, true);
  }
  function overGap() {
    if (P.power.giant > 0) return false;
    for (const g of P.seg.gaps) if (P.s > g.s0 + 0.35 && P.s < g.s1 - 0.35) return true;
    return false;
  }

  function addScore(n) { run.score += n * mult(); }

  function activatePower(k, dur, silent) {
    const d = dur || powerDur(k);
    P.power[k] = Math.max(P.power[k], d); P.powerMax[k] = Math.max(d, P.power[k]);
    if (k === 'boost') { P.grounded = false; P.slide = 0; SFX.play('boost'); }
    if (k === 'giant') { burst(heroPos, 0xffa040, 40, 6, true); shake(0.4); }
    if (!silent) { SFX.play('power'); toast(`${POWERS[k].icon} ${POWERS[k].name}!`); }
    ensurePowerBar(k);
  }
  function onPowerEnd(k) {
    if (k === 'boost') { P.invuln = Math.max(P.invuln, 1.3); P.vy = 0; }
    removePowerBar(k);
  }

  function stumble() {
    if (P.chaser > 0.3 && run.time > 4) { die('caught'); return; }
    P.chaser = 7; P.stumbleSlow = 1.2; P.invuln = Math.max(P.invuln, 0.5);
    SFX.play('stumble'); SFX.play('roar'); vibrate(80); shake(0.35);
  }
  function hit(o) {
    if (P.power.giant > 0) { breakObs(o, 'giant'); return; }
    if (P.invuln > 0) return;
    if (P.power.shield > 0) {
      P.power.shield = 0; onPowerEnd('shield'); breakObs(o, 'shield'); P.invuln = 1.0;
      SFX.play('shieldPop'); flash('#7fd8ff'); vibrate(60); return;
    }
    const target = P.lane * LANE_W;
    const moving = Math.abs(P.x - target) > 0.35 && P.prevLane !== P.lane;
    const prevX = P.prevLane * LANE_W;
    if (moving && !(o.x0 < prevX && prevX < o.x1)) {   // clipped it while switching lanes: bounce back
      P.lane = P.prevLane; P.invuln = 0.45; stumble(); return;
    }
    if (o.kind === 'stumble') { o.alive = false; stumble(); return; }
    die(o.type === 'rakshasa' ? 'rakshasa' : 'crash');
  }
  function breakObs(o, how) {
    o.alive = false;
    const wp = segPoint(P.seg, o.s, o.cx, 1.2, new T.Vector3());
    if (o.type === 'rakshasa') {
      o.dying = { t: 0, vy: 9, vs: 14 + P.speed * 0.5, spin: rnd(-7, 7), y: 0 };
      run.smash++; Save.totalSmash++; addScore(150);
      burst(wp, 0xb070ff, 26, 6, true); burst(wp, 0xffd060, 16, 5, true);
      floatText('+150');
    } else {
      o.group.visible = false;
      burst(wp, 0x8a6a40, 26, 6, false); burst(wp, 0xffd060, 14, 5, true);
      addScore(how === 'smash' ? 50 : 20);
    }
    SFX.play('smash'); shake(how === 'giant' ? 0.25 : 0.3); vibrate(40);
  }
  function die(type) {
    if (state !== 'playing') return;
    state = 'dying'; P.alive = false; P.deathType = type; P.deathT = 0;
    if (type === 'edge' || type === 'gap') { SFX.play('fall'); P.vy = Math.min(P.vy, 2); }
    else { SFX.play('crash'); shake(0.8); flash('#ff4020'); }
    if (type === 'caught' || type === 'rakshasa') SFX.play('roar');
    vibrate(type === 'caught' ? 400 : 250);
    SFX.setIntensity(0);
    hideHints();
  }

  // ================================================================ per-frame game update
  function updatePlaying(dt) {
    run.time += dt;
    const pw = P.power;
    for (const k in pw) if (pw[k] > 0) { pw[k] -= dt; if (pw[k] <= 0) { pw[k] = 0; onPowerEnd(k); } }
    P.invuln = Math.max(0, P.invuln - dt); P.smashCD -= dt; P.chaser = Math.max(0, P.chaser - dt);
    P.stumbleSlow = Math.max(0, P.stumbleSlow - dt);

    // speed & distance
    let target = baseSpeed();
    if (pw.boost > 0) target *= 1.8;
    if (P.stumbleSlow > 0) target *= 0.72;
    P.speed += (target - P.speed) * Math.min(1, dt * (pw.boost > 0 ? 2 : 2.5));
    const ds = P.speed * dt;
    P.s += ds; run.dist += ds; addScore(ds);
    SFX.setIntensity((P.speed - START_SPEED) / (MAX_SPEED - START_SPEED));

    // lateral & vertical motion
    P.x += (P.lane * LANE_W - P.x) * Math.min(1, dt * 13);
    if (pw.boost > 0) { P.y += (BOOST_Y - P.y) * Math.min(1, dt * 4); P.vy = 0; P.grounded = false; }
    else if (!P.grounded) {
      P.vy -= GRAV * dt; P.y += P.vy * dt;
      if (P.y <= 0) {
        if (overGap()) { if (P.y < -0.6) { die('gap'); return; } }
        else {
          P.y = 0; P.vy = 0; P.grounded = true;
          if (P.slideOnLand) { P.slideOnLand = false; P.slide = SLIDE_T; run.slides++; SFX.play('slide'); }
        }
      }
    } else if (overGap()) { P.grounded = false; P.vy = 0; }
    if (P.slide > 0) P.slide -= dt;

    // smash swing
    if (P.smashT >= 0) {
      P.smashT += dt / 0.42;
      if (P.smashT >= 0.28 && P.smashT <= 0.75) smashCheck();
      if (P.smashT >= 1) P.smashT = -1;
    }

    // junctions
    const seg = P.seg;
    if (P.queuedTurn && P.s >= seg.len - 5) tryTurn(P.queuedTurn);
    if (P.seg === seg && P.s > seg.len + HALF_W - 0.5 && pw.boost > 0) autoTurn();
    if (P.seg === seg && P.s > seg.len + TRACK_W - 0.3) { die('edge'); return; }

    collide(); if (state !== 'playing') return;
    collect(dt);
    World.ensureAhead(P.seg, P.s);

    if (P.seg.biome !== run.biome) enterBiome(P.seg.biome);
    checkMissions();
    updateHints();
  }

  function smashCheck() {
    const range = P.power.giant > 0 ? 10 : 6.5;
    for (const o of P.seg.obstacles) {
      if (!o.alive || !o.breakable) continue;
      const dz = o.s - P.s;
      if (dz < -0.8 || dz > range) continue;
      if (P.x < o.x0 - 1.1 || P.x > o.x1 + 1.1) continue;
      breakObs(o, 'smash');
    }
  }
  function collide() {
    if (P.power.boost > 0) return;
    const giant = P.power.giant > 0;
    const hh = P.slide > 0 ? 0.8 : (giant ? 4.0 : 1.8), hw = giant ? 1.0 : 0.38;
    for (const o of P.seg.obstacles) {
      if (!o.alive) continue;
      if (Math.abs(o.s - P.s) > o.hd + (giant ? 0.9 : 0.4)) continue;
      if (P.x + hw < o.x0 || P.x - hw > o.x1) continue;
      if (P.y + hh < o.y0 || P.y > o.y1) continue;
      hit(o);
      if (state !== 'playing') return;
    }
  }
  function collect(dt) {
    const seg = P.seg, pw = P.power;
    const mag = pw.magnet > 0 || pw.boost > 0, giant = pw.giant > 0;
    const py = P.y + (P.slide > 0 ? 0.5 : 1.0);
    const k = 1 - Math.exp(-dt * 14);
    for (const c of seg.coins) {
      if (c.taken) continue;
      const dz = c.s - P.s;
      if (dz < -2 || dz > 30) continue;
      if (mag && !c.mag && dz < 16 && Math.abs(c.x - P.x) < 9) c.mag = true;
      if (c.mag) {
        c.s += (P.s + 0.5 - c.s) * k; c.x += (P.x - c.x) * k; c.y += (py - c.y) * k;
        c.mesh.position.set(c.x, c.y, -c.s);
        if (Math.abs(c.s - P.s) < 1.3 && Math.abs(c.x - P.x) < 1.1) takeCoin(c, seg);
      } else if (Math.abs(dz) < (giant ? 1.4 : 0.85) && Math.abs(c.x - P.x) < (giant ? 2.2 : 1.0) && Math.abs(c.y - py) < (giant ? 3 : 1.25)) takeCoin(c, seg);
    }
    for (const it of seg.items) {
      if (it.taken) continue;
      const dz = it.s - P.s;
      if (Math.abs(dz) < 1.2 && Math.abs(it.x - P.x) < (giant ? 2.4 : 1.3) && Math.abs(it.y - py) < (giant ? 3.2 : 1.6 + (pw.boost > 0 ? 3 : 0))) {
        it.taken = true; it.mesh.visible = false;
        const wp = segPoint(seg, it.s, it.x, it.y, new T.Vector3());
        if (it.kind === 'gem') {
          run.gems++; Save.gems++; persist(); SFX.play('gem'); toast('💎 Gem!'); burst(wp, 0xff3a7a, 30, 5, true); addScore(100);
        } else {
          run.powers++; activatePower(it.type); burst(wp, new T.Color(POWERS[it.type].color).getHex(), 34, 6, true);
        }
      }
    }
  }
  function takeCoin(c, seg) {
    c.taken = true; c.mesh.visible = false;
    const n = P.power.double > 0 ? 2 : 1;
    run.coins += n; addScore(5 * n);
    if (gt - lastCoinSfx > 0.045) { SFX.play('coin'); lastCoinSfx = gt; }
    const wp = segPoint(seg, c.s, c.x, c.y, _v4);
    for (let i = 0; i < 4; i++) World.glowFx.spawn(wp.x, wp.y, wp.z, rnd(-2, 2), rnd(0, 3), rnd(-2, 2), i % 2 ? 0xffe080 : 0xffb020, rnd(0.15, 0.3), rnd(0.25, 0.5), 2, 2, 1);
  }

  function updateDying(dt) {
    P.deathT += dt;
    const fall = P.deathType === 'edge' || P.deathType === 'gap';
    if (fall) { P.vy -= GRAV * dt; P.y += P.vy * dt; P.s += P.speed * dt * 0.5; P.speed *= Math.max(0, 1 - dt * 0.8); }
    else {
      if (P.deathT < 0.25) P.s -= dt * 4;
      P.speed = 0;
      if (P.y > 0) { P.vy -= GRAV * dt; P.y = Math.max(0, P.y + P.vy * dt); }
    }
    if (P.deathT > 1.5) offerRevive();
  }

  function updateRakshasas(dt) {
    for (const seg of World.segments) {
      if (!seg.group) continue;
      for (const o of seg.obstacles) {
        if (o.type !== 'rakshasa' || !o.group.visible) continue;
        const R = o.model;
        if (o.dying) {
          const d = o.dying; d.t += dt; d.vy -= 25 * dt; d.y = Math.max(-20, d.y + d.vy * dt); o.s += d.vs * dt;
          R.root.position.set(o.cx, d.y, -o.s); R.root.rotation.x += d.spin * dt; R.root.rotation.z += d.spin * 0.5 * dt;
          if (d.t > 1.4) o.group.visible = false;
          continue;
        }
        if (!o.alive) continue;
        let mode = 'idle';
        if (seg === P.seg && state === 'playing') {
          const dz = o.s - P.s;
          if (dz < 40 && dz > -3) {
            mode = 'alert';
            if (o.mover === 'walker' && dz < 32 && dz > 2) { o.s -= 3.2 * dt; mode = 'walk'; }
            if (o.mover === 'swayer' && dz > 5) {
              o.cx = clamp(o.baseX + Math.sin(World.time * 1.5 + o.ph) * LANE_W * 1.1, -LANE_W, LANE_W);
              o.x0 = o.cx - 0.75; o.x1 = o.cx + 0.75; mode = 'walk';
            }
            if (!o.roared && dz < 24) { o.roared = true; if (Math.random() < 0.45) SFX.play('roar'); }
          }
        }
        R.root.position.set(o.cx, 0, -o.s);
        MODELS.animateRakshasa(R, World.time, mode, dt);
      }
    }
  }

  function updateChaser(dt) {
    let target = 32;
    if (state === 'playing' && P.chaser > 0) target = run.time < 4 ? 3.4 : 2.9;
    if (state === 'dying') target = P.deathType === 'caught' ? 1.4 : (P.deathType === 'edge' || P.deathType === 'gap' ? 32 : 3.5);
    if (state === 'revive' || state === 'over') target = chaserDist;
    chaserDist += (target - chaserDist) * (1 - Math.exp(-dt * 2.2));
    chaseK += ((chaserDist < 14 ? 1 : 0) - chaseK) * (1 - Math.exp(-dt * 6));
    const vis = chaserDist < 22 && state !== 'menu';
    chaser.root.visible = vis;
    if (!vis) return;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    // slightly to the hero's right so he never hides the hero from the camera
    const side = 1.25 * Math.min(1, chaserDist / 3);
    chaser.root.position.set(heroPos.x - fx * chaserDist - fz * side, heroPos.y - P.y, heroPos.z - fz * chaserDist + fx * side);
    chaser.root.rotation.y = P.yaw;
    MODELS.animateRakshasa(chaser, gt, state === 'dying' && P.deathType === 'caught' ? 'alert' : (state === 'playing' ? 'run' : 'idle'), dt);
  }

  // ================================================================ visuals
  const DUST = { forest: 0xb0a080, ocean: 0xe8dcc0, lanka: 0xf0c878, dahan: 0x5a3a2a };
  function updateHero(dt) {
    segPoint(P.seg, P.s, P.x, P.y, heroPos);
    P.vis.multiplyScalar(Math.exp(-dt * 7));
    heroPos.add(P.vis);
    hero.root.position.copy(heroPos);
    P.yaw = angLerp(P.yaw, segYaw(P.seg), 1 - Math.exp(-dt * 12));
    hero.root.rotation.y = P.yaw;
    const pw = P.power;
    const gs = pw.giant > 0 ? 2.2 : 1;
    P.giantScale += (gs - P.giantScale) * (1 - Math.exp(-dt * 6));
    hero.root.scale.setScalar(P.giantScale);

    let mode = 'run';
    if (state === 'menu') mode = 'idle';
    else if (state === 'dying' || state === 'revive' || state === 'over') mode = (P.deathType === 'edge' || P.deathType === 'gap') ? 'fall' : 'crash';
    else if (pw.boost > 0) mode = 'fly';
    else if (P.slide > 0) mode = 'slide';
    else if (!P.grounded) mode = 'jump';
    if (state === 'playing') phase += dt * Math.min(15, 6 + P.speed * 0.3);
    const lean = -(P.lane * LANE_W - P.x) * 0.07;
    if (state !== 'paused' && state !== 'over' && state !== 'revive') hero.animate({ mode, t: gt, phase, smash: state === 'playing' ? P.smashT : -1, lean, tailSwing: lean * 2 }, dt);

    hero.aura.visible = pw.boost > 0 || pw.giant > 0;
    hero.aura.material.uniforms.uColor.value.set(pw.giant > 0 ? 0xff8030 : 0xffc040);
    hero.aura.material.uniforms.uOpacity.value = pw.giant > 0 ? 0.3 : 0.32;
    hero.shield.visible = pw.shield > 0 && (pw.shield > 2 || Math.sin(gt * 20) > 0);
    if (hero.aura.visible) hero.aura.scale.set(0.75, pw.boost > 0 ? 1.0 : 1.25, pw.boost > 0 ? 1.4 : 0.75);

    if (state !== 'playing') return;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    if (P.grounded && Math.random() < 0.6) {
      World.dustFx.spawn(heroPos.x + rnd(-0.3, 0.3), heroPos.y + 0.05, heroPos.z + rnd(-0.2, 0.2), rnd(-0.6, 0.6) - fx * 2, rnd(0.4, 1.2), rnd(-0.6, 0.6) - fz * 2, DUST[run.biome], rnd(0.3, 0.55) * P.giantScale, 0.6, -0.4, 1.5, 0.35, 1.8);
    }
    if (pw.boost > 0) {
      World.glowFx.spawn(heroPos.x + rnd(-0.3, 0.3), heroPos.y + 1 + rnd(-0.3, 0.3), heroPos.z + rnd(-0.3, 0.3), fx * P.speed * 0.85 + rnd(-1, 1), rnd(-1, 1), fz * P.speed * 0.85 + rnd(-1, 1), pick([0xffd060, 0xffa020, 0xfff0c0]), rnd(0.12, 0.25), 0.35, 0, 1, 0.8);
      const rx = fz, rz = -fx, off = rnd(-7, 7);
      World.glowFx.spawn(heroPos.x + fx * 28 + rx * off, heroPos.y + rnd(-2, 4), heroPos.z + fz * 28 + rz * off, -fx * 70, 0, -fz * 70, 0xffffff, 0.12, 0.45, 0, 0, 0.7);
    }
    if (run.biome === 'dahan') {   // Lanka Dahan: the tail burns
      hero.tuft.getWorldPosition(_v1);
      for (let i = 0; i < 2; i++) World.glowFx.spawn(_v1.x + rnd(-0.08, 0.08), _v1.y + rnd(-0.08, 0.08), _v1.z + rnd(-0.08, 0.08), rnd(-0.4, 0.4) + fx * P.speed * 0.8, rnd(1.5, 3), rnd(-0.4, 0.4) + fz * P.speed * 0.8, pick([0xff9a20, 0xffd040, 0xff5010]), rnd(0.18, 0.32) * P.giantScale, rnd(0.15, 0.28), -1, 1, 1);
    }
  }

  function updateCamera(dt) {
    const pw = P.power;
    camYaw = angLerp(camYaw, segYaw(P.seg), 1 - Math.exp(-dt * (state === 'menu' ? 20 : 4.5)));
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const hp = heroPos;
    if (state === 'menu') {
      const sw = Math.sin(gt * 0.3) * 0.6;
      const rx = -fz, rz = fx;
      desired.set(hp.x + fx * 3.3 + rx * (0.9 + sw), hp.y + 1.3, hp.z + fz * 3.3 + rz * (0.9 + sw));
      lookDesired.set(hp.x + rx * 0.15, hp.y + 0.72, hp.z + rz * 0.15);
      camRate = 3;
    } else {
      let back = 5.3 + chaseK * 1.6, up = 2.7 + chaseK * 2.1, look = 6.5, ly = 1.0;
      if (pw.giant > 0) { back = 9.5; up = 6; ly = 2.6; }
      if (pw.boost > 0) { back = 5.6; up = 2.0; }
      let by = pw.boost > 0 ? hp.y : hp.y * 0.4;
      const falling = (state !== 'playing') && (P.deathType === 'edge' || P.deathType === 'gap');
      if (falling) by = 0;
      desired.set(hp.x - fx * back, by + up, hp.z - fz * back);
      lookDesired.set(hp.x + fx * look, (falling ? 0 : by) + ly + (pw.boost > 0 ? 0 : hp.y * 0.3), hp.z + fz * look);
      camRate += (8 - camRate) * (1 - Math.exp(-dt * 1.2));
    }
    // Smooth the offset from the hero rather than the absolute position,
    // so the camera never lags further behind as the run speeds up.
    const k = 1 - Math.exp(-dt * camRate);
    camOff.lerp(desired.sub(hp), k);
    lookOff.lerp(lookDesired.sub(hp), Math.min(1, k * 1.6));
    camera.position.copy(hp).add(camOff);
    camLook.copy(hp).add(lookOff);
    camera.lookAt(camLook);
    if (shakeAmt > 0.001) {
      camera.position.x += rnd(-1, 1) * shakeAmt; camera.position.y += rnd(-1, 1) * shakeAmt;
      shakeAmt *= Math.exp(-dt * 7);
    }
    const fovT = baseFov + (pw.boost > 0 ? 9 : 0) + (state === 'playing' ? (P.speed - START_SPEED) * 0.25 : 0);
    if (Math.abs(camera.fov - fovT) > 0.05) {
      camera.fov += (fovT - camera.fov) * (1 - Math.exp(-dt * 3));
      camera.updateProjectionMatrix();
      World.setParticleScale(window.innerHeight * renderer.getPixelRatio(), camera.fov);
    }
  }
  const shake = a => { shakeAmt = Math.max(shakeAmt, a); };
  function burst(p, color, n, sp, glow) {
    const fx = glow ? World.glowFx : World.dustFx;
    for (let i = 0; i < n; i++) fx.spawn(p.x, p.y, p.z, rnd(-sp, sp), rnd(0, sp * 1.3), rnd(-sp, sp), color, rnd(0.25, 0.6), rnd(0.4, 0.9), 12, 1.5, glow ? 1 : 0.9, 0.5);
  }

  // ================================================================ biome / missions / hints
  function enterBiome(key) {
    run.biome = key;
    World.setBiome(key);
    const B = BIOMES[key];
    if (key === 'lanka' && !run.lanka) {
      run.lanka = true; addScore(1000);
      banner('You reached Lanka!', 'Jai Shri Ram! +1000');
      SFX.play('bell'); flash('#ffe08a');
      if (!Save.reachedLanka) { Save.reachedLanka = true; Save.gems += 2; persist(); toast('First time in Lanka: +2 💎'); }
    } else banner(B.name, B.sub);
  }
  let missionTick = 0;
  function checkMissions() {
    missionTick -= 1; if (missionTick > 0) return; missionTick = 10;
    const st = { coins: run.coins, dist: run.dist, smash: run.smash, powers: run.powers, jumps: run.jumps, slides: run.slides, score: run.score };
    for (let i = 0; i < 3; i++) {
      const m = Save.missions[i];
      if (st[MT[m.type].stat] >= m.target) {
        Save.missionsDone++; Save.coins += 250;
        toast(`✔ ${MT[m.type].text(m.target)} · +250`);
        SFX.play('mission');
        replaceMission(i);
        if (Save.missionsDone % 3 === 0) banner(`Score ×${mult()}`, 'Multiplier increased!');
        persist();
        break;
      }
    }
  }
  const TUT = [
    [1.0, '⇆', 'Swipe left / right to switch lanes'],
    [5.0, '⇧', 'Swipe up to jump'],
    [8.5, '⇩', 'Swipe down to slide'],
    [12, '☝', 'Tap to smash rakshasas with your gada'],
    [16, '↰ ↱', 'At a junction, swipe the way the path turns'],
    [20, null, null],
  ];
  let tutIdx = 0;
  function updateHints() {
    const seg = P.seg;
    const showTurn = (Save.runs <= 3 || run.dist < 350) && P.s > seg.len - 32 && P.s < seg.len - 2;
    const th = $('turnHint');
    th.classList.toggle('show', showTurn);
    if (showTurn) { th.querySelector('.left').style.visibility = seg.hasL ? 'visible' : 'hidden'; th.querySelector('.right').style.visibility = seg.hasR ? 'visible' : 'hidden'; }
    if (Save.runs <= 2 && tutIdx < TUT.length && run.time >= TUT[tutIdx][0]) {
      const [, g, txt] = TUT[tutIdx++];
      const el = $('tutorial');
      if (txt) { el.innerHTML = `<span class="gest">${g}</span>${txt}`; el.classList.add('show'); } else el.classList.remove('show');
    }
    const warn = P.chaser > 0 && run.time > 4;
    $('chaserWarn').classList.toggle('show', warn);
    $('hud').classList.toggle('danger', warn);
  }
  function hideHints() { $('turnHint').classList.remove('show'); $('tutorial').classList.remove('show'); $('chaserWarn').classList.remove('show'); $('hud').classList.remove('danger'); }

  // ================================================================ HUD
  const hudEls = { score: $('hudScore'), coins: $('hudCoins'), dist: $('hudDist'), mult: $('hudMult') };
  const hudCache = {};
  function setText(k, v) { if (hudCache[k] !== v) { hudCache[k] = v; hudEls[k].textContent = v; } }
  function updateHUD() {
    setText('score', Math.floor(run.score).toLocaleString());
    setText('coins', run.coins);
    setText('dist', Math.floor(run.dist));
    setText('mult', mult() * (P.power.double > 0 ? 1 : 1));
    const toL = LANKA_DIST - run.dist;
    if (toL > 0) {
      setTextEl('progLabel', `Lanka in ${Math.ceil(toL)} m`);
      const f = run.dist / LANKA_DIST * 100;
      $('progFill').style.width = f + '%'; $('progHero').style.left = f + '%';
    } else {
      setTextEl('progLabel', BIOMES[run.biome].name);
      $('progFill').style.width = '100%'; $('progHero').style.left = '100%';
    }
    for (const k in powerBars) {
      const f = P.power[k] / (P.powerMax[k] || 1);
      powerBars[k].fill.style.width = (f * 100).toFixed(1) + '%';
    }
  }
  function setTextEl(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
  const powerBars = {};
  function ensurePowerBar(k) {
    if (powerBars[k]) return;
    const el = document.createElement('div'); el.className = 'pbar';
    el.innerHTML = `<div class="ic" style="background:${POWERS[k].color}">${POWERS[k].icon}</div><div class="track"><div class="fill"></div></div>`;
    $('powerBars').appendChild(el);
    powerBars[k] = { el, fill: el.querySelector('.fill') };
  }
  function removePowerBar(k) { if (powerBars[k]) { powerBars[k].el.remove(); delete powerBars[k]; } }
  function clearPowerBars() { for (const k in powerBars) removePowerBar(k); }
  let bannerTimer = null;
  function banner(title, sub) {
    const b = $('banner');
    b.querySelector('.b-title').textContent = title; b.querySelector('.b-sub').textContent = sub || '';
    b.classList.add('show');
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('show'), 2600);
  }
  function toast(text) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = text;
    $('toasts').appendChild(t); setTimeout(() => t.remove(), 2700);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  }
  const floatText = txt => toast(`🔨 Rakshasa smashed ${txt}`);
  function flash(color) {
    const f = $('flash'); f.style.background = color; f.style.transition = 'none'; f.style.opacity = 0.55;
    requestAnimationFrame(() => { f.style.transition = 'opacity 0.45s'; f.style.opacity = 0; });
  }
  function vibrate(ms) {
    if (!Save.vibrate) return;
    try { if (window.Android && window.Android.vibrate) window.Android.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* no haptics */ }
  }

  // ================================================================ screens & flow
  const SCREENS = ['menu', 'pause', 'revive', 'over', 'hud', 'loading'];
  function showOnly(...ids) { for (const id of SCREENS) $(id).classList.toggle('hidden', !ids.includes(id)); }
  function refreshMenu() {
    $('mBest').textContent = Save.best.toLocaleString();
    $('mCoins').textContent = Save.coins.toLocaleString();
    $('mGems').textContent = Save.gems;
    $('mMult').textContent = mult();
  }
  function goMenu() {
    state = 'menu';
    SFX.stopMusic();
    if (needsReset) { newRun(); needsReset = false; }
    refreshMenu(); showOnly('menu'); hideHints();
  }
  function startRun() {
    SFX.init(); SFX.play('click');
    if (needsReset) newRun();
    needsReset = true;
    state = 'playing';
    Save.runs++; persist();
    showOnly('hud'); tutIdx = 0;
    P.speed = START_SPEED * 0.6; P.chaser = 3.5; camRate = 2;
    SFX.startMusic(); setTimeout(() => SFX.play('roar'), 300);
    banner(BIOMES.forest.name, 'Run to Lanka and find Mata Sita!');
    if (Save.headStarts > 0) {
      Save.headStarts--; persist();
      setTimeout(() => { if (state === 'playing') { activatePower('boost', 5, true); toast('🚀 Head Start!'); } }, 600);
    }
  }
  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused'; SFX.suspend();
    renderMissions($('pauseMissions'), true);
    showOnly('hud', 'pause');
  }
  function resumeGame() {
    if (state !== 'paused') return;
    SFX.resume(); state = 'playing'; showOnly('hud'); last = performance.now();
  }
  function reviveCost() { return 1 << run.revives; }
  function offerRevive() {
    const cost = reviveCost();
    if (Save.gems >= cost && run.revives < 4) {
      state = 'revive'; reviveT = 5;
      $('reviveCost').innerHTML = `<span><span class="gem-ic"></span>${cost}</span>`;
      $('btnRevive').textContent = `Revive · ${cost} 💎`;
      showOnly('hud', 'revive');
    } else gameOver();
  }
  function doRevive() {
    const cost = reviveCost();
    if (Save.gems < cost) return;
    Save.gems -= cost; run.revives++; persist();
    SFX.play('power');
    const seg = P.seg;
    if (P.s > seg.len + HALF_W - 1) {   // ran off at a junction: continue on a branch
      const side = seg.childL ? -1 : 1;
      tryTurn(side, true);
      P.s = 0; P.x = 0; P.lane = 0; P.prevLane = 0; P.vis.set(0, 0, 0);
    }
    for (const o of P.seg.obstacles) if (o.s > P.s - 4 && o.s < P.s + 45 && o.alive) { o.alive = false; o.group.visible = false; }
    P.alive = true; P.vy = 0; P.y = Math.max(P.y, -3); P.slide = 0; P.chaser = 0; chaserDist = 32;
    P.speed = baseSpeed() * 0.8; P.deathType = '';
    state = 'playing';
    activatePower('boost', 3, true); P.invuln = 5;
    showOnly('hud');
    toast('Jai Hanuman! Revived');
    SFX.resume();
  }
  function gameOver() {
    state = 'over';
    Save.coins += run.coins;
    const score = Math.floor(run.score);
    const isBest = score > Save.best;
    if (isBest) Save.best = score;
    Save.bestDist = Math.max(Save.bestDist, Math.floor(run.dist));
    persist();
    SFX.stopMusic();
    const reasons = { caught: 'The rakshasa caught you!', rakshasa: 'A rakshasa blocked your path!', crash: 'Crashed!', edge: 'Fell off the path!', gap: 'Fell into the abyss!' };
    $('overReason').textContent = reasons[P.deathType] || 'Run over';
    $('overScore').textContent = score.toLocaleString();
    $('overBest').textContent = isBest ? '★ New best score! ★' : `Best: ${Save.best.toLocaleString()}`;
    $('overDist').textContent = `${Math.floor(run.dist)} m`;
    $('overCoins').textContent = run.coins;
    $('overSmash').textContent = run.smash;
    $('overBiome').textContent = BIOMES[run.biome].name;
    renderMissions($('overMissions'), true);
    showOnly('over');
  }

  function missionProgress(m) {
    const st = { coins: run.coins || 0, dist: run.dist || 0, smash: run.smash || 0, powers: run.powers || 0, jumps: run.jumps || 0, slides: run.slides || 0, score: run.score || 0 };
    return Math.min(m.target, Math.floor(st[MT[m.type].stat]));
  }
  function renderMissions(el, withProgress) {
    el.innerHTML = Save.missions.map(m => `<div class="mission"><div class="chk"></div><div>${MT[m.type].text(m.target)}</div>${withProgress ? `<div class="pr">${missionProgress(m)}/${m.target}</div>` : ''}</div>`).join('');
  }

  // ---------------------------------------------------------------- panels
  function openPanel(kind) {
    SFX.init(); SFX.play('click');
    $('panel').classList.remove('hidden');
    renderPanel(kind);
  }
  function closePanel() { $('panel').classList.add('hidden'); refreshMenu(); }
  function renderPanel(kind) {
    const body = $('panelBody');
    const wallet = `<div class="wallet"><span><span class="coin-ic"></span>${Save.coins.toLocaleString()}</span><span><span class="gem-ic"></span>${Save.gems}</span></div>`;
    if (kind === 'shop') {
      $('panelTitle').textContent = 'Shop';
      let h = wallet;
      for (const k in POWERS) {
        const P0 = POWERS[k], L = Save.upgrades[k], cost = L < 5 ? UPGRADE_COST[L] : null;
        h += `<div class="item"><div class="ic" style="background:${P0.color}">${P0.icon}</div><div class="info"><div class="nm">${P0.name} · ${powerDur(k).toFixed(1)}s</div><div class="ds">${P0.desc}</div>
          <div class="pips">${[0, 1, 2, 3, 4].map(i => `<i class="${i < L ? 'on' : ''}"></i>`).join('')}</div></div>
          ${cost ? `<button class="btn" data-up="${k}" ${Save.coins < cost ? 'disabled' : ''}><span class="coin-ic"></span>${cost}</button>` : '<button class="btn" disabled>MAX</button>'}</div>`;
      }
      h += `<div class="item"><div class="ic" style="background:#2aa8d8">🚀</div><div class="info"><div class="nm">Head Start · owned ${Save.headStarts}</div><div class="ds">Start your next run flying with Vayu for 5 seconds. Used automatically.</div></div>
        <button class="btn" data-buy="head" ${Save.coins < HEADSTART_COST ? 'disabled' : ''}><span class="coin-ic"></span>${HEADSTART_COST}</button></div>`;
      h += `<div class="item"><div class="ic" style="background:#a0103a">💎</div><div class="info"><div class="nm">Gem</div><div class="ds">Gems let you revive with "Save Me" after a crash.</div></div>
        <button class="btn" data-buy="gem" ${Save.coins < GEM_COST ? 'disabled' : ''}><span class="coin-ic"></span>${GEM_COST}</button></div>`;
      body.innerHTML = h;
      body.querySelectorAll('[data-up]').forEach(b => b.onclick = () => {
        const k = b.dataset.up, L = Save.upgrades[k], c = UPGRADE_COST[L];
        if (L < 5 && Save.coins >= c) { Save.coins -= c; Save.upgrades[k]++; persist(); SFX.play('power'); renderPanel('shop'); }
      });
      body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
        if (b.dataset.buy === 'head' && Save.coins >= HEADSTART_COST) { Save.coins -= HEADSTART_COST; Save.headStarts++; }
        else if (b.dataset.buy === 'gem' && Save.coins >= GEM_COST) { Save.coins -= GEM_COST; Save.gems++; }
        else return;
        persist(); SFX.play('gem'); renderPanel('shop');
      });
    } else if (kind === 'missions') {
      $('panelTitle').textContent = 'Missions';
      const n = Save.missionsDone % 3;
      body.innerHTML = `<div class="ds" style="text-align:center">Complete missions to earn <b>250 coins</b> each.<br>Every 3 missions raise your score multiplier.</div>
        <div class="wallet"><span>Score ×${mult()}</span><span>${n}/3 to ×${mult() + 1}</span></div>
        <div class="mission-list">${Save.missions.map(m => `<div class="mission"><div class="chk"></div><div>${MT[m.type].text(m.target)}</div></div>`).join('')}</div>
        <div class="ds" style="text-align:center">Missions completed: ${Save.missionsDone} · Rakshasas smashed: ${Save.totalSmash}</div>`;
    } else if (kind === 'help') {
      $('panelTitle').textContent = 'How to play';
      body.innerHTML = `<div class="help">
        <p>Hanuman leaps from <b>Kishkindha</b> across the <b>ocean</b> to <b>Golden Lanka</b>. A giant rakshasa chases him the whole way!</p>
        <p><b>Swipe ← →</b> switch lanes. At a junction, swipe the way the path turns or you fall.</p>
        <p><b>Swipe ↑</b> jump over logs, fences, fire and gaps.</p>
        <p><b>Swipe ↓</b> slide under branches and arches (in the air it slams you down).</p>
        <p><b>Tap</b> swing the gada: smash rakshasas, barricades and pots in your lane.</p>
        <p>Tripping on a low obstacle lets the chasing rakshasa catch up. Trip again while he is close and you are caught.</p>
        <p>${Object.values(POWERS).map(p => `${p.icon} <b>${p.name}</b>: ${p.desc}`).join('<br>')}</p>
        <p>💎 <b>Gems</b> are rare. Use them to revive. Coins buy upgrades in the shop.</p>
        <p>Keyboard: arrows / WASD, Space jump, F smash, P pause.</p></div>`;
    } else if (kind === 'settings') {
      $('panelTitle').textContent = 'Settings';
      const row = (k, label) => `<div class="toggle"><span>${label}</span><button class="sw ${Save[k] ? 'on' : ''}" data-k="${k}" aria-label="${label}"></button></div>`;
      body.innerHTML = row('music', 'Music') + row('sound', 'Sound effects') + row('vibrate', 'Vibration') +
        `<div class="ds" style="text-align:center;margin-top:10px">Hanuman Run · v${appVersion()}</div>`;
      body.querySelectorAll('.sw').forEach(b => b.onclick = () => {
        const k = b.dataset.k; Save[k] = !Save[k]; persist(); applySettings(); SFX.play('click'); renderPanel('settings');
      });
    }
  }
  function appVersion() {
    try { if (window.Android && window.Android.getVersion) return window.Android.getVersion(); } catch (e) { /* browser */ }
    return 'dev';
  }
  function applySettings() { SFX.setMusic(Save.music); SFX.setSfx(Save.sound); }

  // buttons
  const on = (id, fn) => $(id).addEventListener('click', e => { e.stopPropagation(); fn(); });
  on('btnPlay', startRun);
  on('btnShop', () => openPanel('shop'));
  on('btnMissions', () => openPanel('missions'));
  on('btnHelp', () => openPanel('help'));
  on('btnSettings', () => openPanel('settings'));
  on('panelClose', closePanel);
  on('btnPause', pauseGame);
  on('btnResume', resumeGame);
  on('btnRestart', () => { SFX.resume(); gameOverSilently(); startRun(); });
  on('btnHome', () => { SFX.resume(); gameOverSilently(); goMenu(); });
  on('btnRevive', doRevive);
  on('btnNoRevive', gameOver);
  on('btnAgain', startRun);
  on('btnOverShop', () => openPanel('shop'));
  on('btnOverHome', goMenu);
  function gameOverSilently() {   // quitting from pause still banks the coins
    Save.coins += run.coins;
    if (Math.floor(run.score) > Save.best) Save.best = Math.floor(run.score);
    persist();
    SFX.stopMusic();
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (state === 'playing') pauseGame(); SFX.suspend(); } });
  window.gamePause = () => { if (state === 'playing') pauseGame(); SFX.suspend(); };
  window.onAndroidBack = () => {
    if (!$('panel').classList.contains('hidden')) { closePanel(); return 'handled'; }
    if (state === 'playing') { pauseGame(); return 'handled'; }
    if (state === 'paused') { resumeGame(); return 'handled'; }
    if (state === 'revive') { gameOver(); return 'handled'; }
    if (state === 'over' || state === 'dying') { goMenu(); return 'handled'; }
    return 'exit';
  };

  // ================================================================ main loop
  let last = performance.now();
  let frozen = false;
  const NO_AUTO_QUALITY = /noautoq/.test(location.search);
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (frozen) return;
    if (state === 'paused' || state === 'over') return;   // keep the last frame on screen, save battery
    if (dt > 0 && dt < 5) trackFps(dt);
    if (dt > 0.05) dt = 0.05;
    if (dt <= 0) return;
    gt += dt;
    if (state === 'playing') updatePlaying(dt);
    else if (state === 'dying') updateDying(dt);
    else if (state === 'revive') {
      reviveT -= dt;
      $('reviveRing').style.strokeDashoffset = (276.5 * (1 - reviveT / 5)).toFixed(1);
      if (reviveT <= 0) { gameOver(); return; }
    }
    if (state === 'menu') World.ensureAhead(P.seg, P.s);
    updateRakshasas(dt);
    updateHero(dt);
    updateChaser(dt);
    updateCamera(dt);
    World.update(dt, heroPos, camera);
    if (state === 'playing' || state === 'dying') updateHUD();
    renderer.render(scene, camera);
  }

  loadSave();
  applySettings();
  applyQuality(Save.quality || 0);
  newRun();
  refreshMenu();
  updateHero(0.016);
  showOnly('menu');
  requestAnimationFrame(frame);
  // debug hook used by automated tests: advance the simulation without rendering
  function simulate(sec) {
    const dt = 1 / 60;
    for (let t = 0; t < sec; t += dt) {
      gt += dt;
      if (state === 'playing') updatePlaying(dt); else if (state === 'dying') updateDying(dt);
      updateRakshasas(dt); updateHero(dt); updateChaser(dt); updateCamera(dt); World.update(dt, heroPos, camera);
    }
    updateHUD();
  }
  // Render one still from a camera placed relative to the hero (fwd/right/up in metres), then freeze.
  function shot(o) {
    frozen = true;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = -fz, rz = fx;
    const hp = heroPos;
    camera.position.set(hp.x + fx * o.fwd + rx * (o.right || 0), hp.y + o.up, hp.z + fz * o.fwd + rz * (o.right || 0));
    const lf = o.lookFwd || 0, lr = o.lookRight || 0;
    camera.lookAt(hp.x + fx * lf + rx * lr, hp.y + (o.lookUp == null ? 1 : o.lookUp), hp.z + fz * lf + rz * lr);
    camera.fov = o.fov || baseFov; camera.updateProjectionMatrix();
    World.sky.position.copy(camera.position); World.stars.position.copy(camera.position);
    renderer.render(scene, camera);
  }
  window.__game = { P, get state() { return state; }, get run() { return run; }, input, startRun, World, simulate, activatePower,
    shot, unfreeze() { frozen = false; }, get hero() { return hero; } };
})();
