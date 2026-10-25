/* ==========================================================================
   main.js  —  The game code (Phaser 3)
   --------------------------------------------------------------------------
   You normally DON'T need to edit this file: personal content lives in
   config.js. The code is split into numbered sections:

     1. Small helpers
     2. Placeholder pixel art (drawn from text, no image files needed)
     3. Sound (a tiny synthesizer, so no audio files are needed)
     4. Shared UI pieces (buttons, mute toggle, floating hearts)
     5. BootScene   – loads/creates all graphics & animations
     6. TitleScene  – the start screen
     7. GameScene   – the map, player, collectibles and popups
        CakeScene   – make a wish and blow out the candles
     8. EndScene    – the final message
     9. Starting the game

   Phaser basics, in one paragraph:
   A game is made of "scenes" (like screens). Each scene has
     preload() – load files (images, sounds)
     create()  – build everything once, when the scene starts
     update()  – runs ~60 times per second (movement, checks)
   We switch scenes with this.scene.start('SceneName').
   ========================================================================== */

const CFG = window.GAME_CONFIG;
if (!CFG) {
  document.body.innerHTML =
    '<p style="font-family:sans-serif;padding:2em">config.js failed to load. ' +
    'Open the browser console to see the error (often a missing comma).</p>';
  throw new Error('GAME_CONFIG missing — check config.js for typos.');
}

/* ==========================================================================
   1. SMALL HELPERS
   ========================================================================== */

// Turn "#ffccdd" into the number Phaser uses for colors (0xffccdd).
const color = (hexString) => Phaser.Display.Color.HexStringToColor(hexString).color;

// Same, but as {red, green, blue} — used for camera fades.
const rgb = (hexString) => {
  const c = Phaser.Display.Color.HexStringToColor(hexString);
  return [c.red, c.green, c.blue];
};

// One place to build text styles, so every text uses the same font.
function textStyle(size, fill = CFG.colors.text, extra = {}) {
  return Object.assign(
    { fontFamily: CFG.ui.fontFamily, fontSize: size + 'px', color: fill, align: 'center' },
    extra
  );
}

// localStorage can throw in private browsing — wrap it so it never crashes the game.
const storage = {
  get(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); } catch (e) { /* ignore */ } },
};

/* ==========================================================================
   2. PLACEHOLDER PIXEL ART
   --------------------------------------------------------------------------
   Each picture is a list of text rows. Every character is one pixel and
   is looked up in a "palette" (character -> color). "." = transparent.
   These are turned into real textures in BootScene.
   ========================================================================== */

// Draw text-rows onto a <canvas>. `scale` = how many screen pixels per art pixel.
function pixelCanvas(rows, palette, scale) {
  const w = rows[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = rows.length * scale;
  const ctx = canvas.getContext('2d');
  rows.forEach((row, y) => {
    if (row.length !== w) console.warn('Pixel art row has wrong length:', row);
    for (let x = 0; x < row.length; x++) {
      const fill = palette[row[x]];
      if (!fill) continue;
      ctx.fillStyle = fill;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  });
  return canvas;
}

// Register a single pixel-art image as a Phaser texture.
function addPixelTexture(scene, key, rows, palette, scale) {
  const tex = scene.textures.addCanvas(key, pixelCanvas(rows, palette, scale));
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST); // keep pixels crisp
}

// Register several frames side-by-side as one texture with numbered frames
// (0, 1, 2, ...) — this is what a "sprite sheet" is.
function addPixelSpriteSheet(scene, key, frames, palette, scale) {
  const fw = frames[0][0].length * scale;
  const fh = frames[0].length * scale;
  const sheet = document.createElement('canvas');
  sheet.width = fw * frames.length;
  sheet.height = fh;
  const ctx = sheet.getContext('2d');
  frames.forEach((rows, i) => ctx.drawImage(pixelCanvas(rows, palette, scale), i * fw, 0));
  const tex = scene.textures.addCanvas(key, sheet);
  frames.forEach((_, i) => tex.add(i, 0, i * fw, 0, fw, fh));
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/* ---- The placeholder kitty (16x16 pixels per frame) ----
   o = outline, w = body, p = accent (ears/scarf), b = blush, e = eyes      */
const EMPTY_ROW = '................';
const KITTY_BODY = [
  '..oo........oo..',
  '.opwo......owpo.',
  '.owwwoooooowwwo.',
  '.owwwwwwwwwwwwo.',
  'owwwwwwwwwwwwwwo',
  'owwwewwwwwwewwwo',
  'owwwewwwwwwewwwo',
  'owbbwwwoowwwbbwo',
  'owwwwwwwwwwwwwwo',
  '.owwwwwwwwwwwwo.',
  '..ooppppppppoo..',
  '...owwwwwwwwo...',
];
// Same body with one row removed = a little "squash" for breathing.
const KITTY_BODY_SQUASHED = KITTY_BODY.filter((_, i) => i !== 3);
const KITTY_LEGS = {
  stand:   ['...owwo..owwo...', '...oooo..oooo...'],
  leftUp:  ['...oooo..owwo...', '.........oooo...'],
  rightUp: ['...owwo..oooo...', '...oooo.........'],
};
// Stack padding + body + legs into one 16-row frame.
function kittyFrame(topPadding, body, legs) {
  const rows = Array(topPadding).fill(EMPTY_ROW).concat(body, legs);
  while (rows.length < 16) rows.push(EMPTY_ROW);
  return rows;
}
const KITTY_FRAMES = [
  kittyFrame(1, KITTY_BODY, KITTY_LEGS.stand),            // 0: standing
  kittyFrame(2, KITTY_BODY_SQUASHED, KITTY_LEGS.stand),   // 1: breathe in (squash)
  kittyFrame(0, KITTY_BODY, KITTY_LEGS.leftUp),           // 2: hop, left foot up
  kittyFrame(0, KITTY_BODY, KITTY_LEGS.rightUp),          // 3: hop, right foot up
];
// Which frames make up each animation. THIS is where animations plug in:
// with a custom sprite these come from your Aseprite tags instead.
const KITTY_ANIMS = {
  idle: { frames: [0, 1], frameRate: 2 },
  walk: { frames: [0, 2, 0, 3], frameRate: 9 },
};

/* ---- Collectible icons and decorations ---- */
const ART = {
  heart: [
    '.oo.oo.',
    'oppoppo',
    'opwpppo',
    '.opppo.',
    '..opo..',
    '...o...',
  ],
  star: [
    '....o....',
    '...oyo...',
    'oooyyyooo',
    'oyyyyyyyo',
    '.oyywyyo.',
    '..oyyyo..',
    '.oyyoyyo.',
    '.oyo.oyo.',
    '.oo...oo.',
  ],
  letter: [
    'oooooooo',
    'oowwwwoo',
    'owowwowo',
    'owwppwwo',
    'owwwwwwo',
    'oooooooo',
  ],
  flower: [
    '.pp.pp.',
    'pppppp.',
    '.ppyppp',
    'pppppp.',
    '.pp.pp.',
    '...g...',
    '..gg...',
  ],
  tinyFlower: [
    '.p.p.',
    'ppypp',
    '.p.p.',
    '..g..',
    '.gg..',
  ],
  tree: [
    '....oooo....',
    '..oollggoo..',
    '.olllggggdo.',
    '.ollgggggdo.',
    'olgggggggddo',
    'olggpgggggdo',
    'ogggggggpgdo',
    'ogggggggggdo',
    'odggpgggggdo',
    '.odgggggddo.',
    '..oddddddo..',
    '....otto....',
    '....otto....',
    '....otto....',
    '...otttto...',
    '...oooooo...',
  ],
  sparkle: [
    '..w..',
    '..w..',
    'wwwww',
    '..w..',
    '..w..',
  ],
  soundOn: [
    '....o.....',
    '...oo...o.',
    'oooooo...o',
    'oooooo.o.o',
    'oooooo.o.o',
    'oooooo...o',
    '...oo...o.',
    '....o.....',
  ],
  soundOff: [
    '....o.....',
    '...oo.....',
    'oooooo....',
    'oooooo.o.o',
    'oooooo..o.',
    'oooooo.o.o',
    '...oo.....',
    '....o.....',
  ],
};

/* ---- Town art: buildings, cars and props ----
   Bigger pictures are drawn with plain rectangles on a canvas instead of
   text rows. `box(x, y, w, h, fill, outline)` is the only brush needed.    */
function addDrawnTexture(scene, key, w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const box = (x, y, bw, bh, fill, outline, t = 3) => {
    if (outline) {
      ctx.fillStyle = outline;
      ctx.fillRect(x, y, bw, bh);
      x += t; y += t; bw -= t * 2; bh -= t * 2;
    }
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, bw, bh);
  };
  draw(ctx, box);
  scene.textures.addCanvas(key, canvas).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

// Shop-sign lettering (uses the game font, which is loaded before the game starts).
function signText(ctx, text, x, y, size, fill) {
  ctx.font = `bold ${size}px ${CFG.ui.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function drawWindow(box, x, y, w, h) {
  const C = CFG.colors;
  box(x, y, w, h, C.glass, C.buildingOutline);
  box(x + 6, y + 6, 4, h - 16, '#ffffff');   // a little shine
}

// Red-and-white style striped awning.
function drawAwning(box, x, y, w, h, stripe) {
  const n = Math.round(w / 18);
  for (let i = 0; i < n; i++) box(x + (i * w) / n, y, w / n + 1, h, i % 2 ? '#ffffff' : stripe);
  box(x, y + h - 3, w, 3, CFG.colors.buildingOutline);
}

function createTownTextures(scene) {
  const C = CFG.colors, O = C.buildingOutline;

  addDrawnTexture(scene, 'mall', 440, 250, (ctx, box) => {
    box(0, 44, 440, 206, C.mallWall, O);                 // walls
    box(8, 26, 424, 26, C.mallRoof, O);                  // roof ledge
    box(130, 0, 180, 54, '#ffffff', O);                  // sign board
    signText(ctx, 'MALL', 220, 28, 32, C.accentDark);
    for (let i = 0; i < 6; i++) drawWindow(box, 22 + i * 70, 68, 46, 48);   // upper floor
    [0, 1, 5].forEach((i) => drawWindow(box, 22 + i * 70, 150, 46, 50));    // ground floor
    box(296, 142, 64, 66, C.cafeAwning, O);              // movie poster
    signText(ctx, 'CINEMA', 328, 162, 13, '#ffffff');
    ctx.drawImage(pixelCanvas(ART.star, { o: O, y: C.star, w: '#ffffff' }, 3), 315, 174);
    box(160, 150, 120, 100, C.glass, O);                 // glass entrance doors
    box(218, 150, 4, 100, O);
    box(170, 160, 4, 60, '#ffffff');
    drawAwning(box, 148, 128, 144, 24, C.cafeAwning);
  });

  addDrawnTexture(scene, 'cafe', 160, 170, (ctx, box) => {
    box(0, 34, 160, 136, C.cafeWall, O);
    box(0, 22, 160, 20, C.cafeRoof, O);
    box(30, 0, 100, 36, '#ffffff', O);
    signText(ctx, 'CAFÉ', 80, 19, 22, C.cafeRoof);
    drawAwning(box, 6, 54, 148, 22, C.cafeAwning);
    drawWindow(box, 14, 82, 72, 58);
    ctx.drawImage(pixelCanvas(ART.heart, { o: O, p: C.heart, w: '#ffffff' }, 3), 39, 100);
    box(100, 94, 46, 76, C.wood, O);                     // door
    box(134, 130, 5, 5, O);                              // door knob
  });

  addDrawnTexture(scene, 'shop', 150, 150, (ctx, box) => {
    box(0, 34, 150, 116, C.shopWall, O);
    box(0, 22, 150, 20, C.shopAwning, O);
    box(20, 0, 110, 34, '#ffffff', O);
    signText(ctx, 'FLOWERS', 75, 18, 17, C.accentDark);
    drawAwning(box, 6, 50, 138, 20, C.shopAwning);
    drawWindow(box, 12, 78, 62, 48);
    box(90, 82, 46, 68, C.wood, O);
    // Flower pots under the window
    [16, 40, 62].forEach((x, i) => {
      box(x, 132, 16, 14, C.chimney, O);
      ctx.drawImage(pixelCanvas(ART.tinyFlower, { p: C.flowers[i], y: C.star, g: C.treeLeavesDark }, 2), x + 3, 120);
    });
  });

  C.houseWalls.forEach((wall, i) => {
    addDrawnTexture(scene, 'house-' + i, 130, 150, (ctx, box) => {
      box(86, 6, 20, 40, C.chimney, O);                  // chimney (smoke comes out of here)
      ctx.fillStyle = O;                                 // roof: outlined triangle
      ctx.beginPath(); ctx.moveTo(0, 64); ctx.lineTo(65, 4); ctx.lineTo(130, 64); ctx.fill();
      ctx.fillStyle = C.houseRoofs[i % C.houseRoofs.length];
      ctx.beginPath(); ctx.moveTo(8, 60); ctx.lineTo(65, 10); ctx.lineTo(122, 60); ctx.fill();
      box(10, 58, 110, 92, wall, O);
      drawWindow(box, 20, 76, 30, 30);
      drawWindow(box, 80, 76, 30, 30);
      box(51, 100, 28, 50, C.wood, O);
      box(70, 124, 4, 4, O);
    });
  });

  C.cars.forEach((body, i) => {
    // Seen from above, facing UP. It gets rotated for the other directions.
    addDrawnTexture(scene, 'car-' + i, 32, 48, (ctx, box) => {
      [[0, 8], [0, 32], [26, 8], [26, 32]].forEach(([x, y]) => box(x, y, 6, 10, '#5b4a5e'));   // wheels
      box(2, 2, 28, 44, body, O);
      box(6, 4, 6, 4, '#fff4b8');                        // headlights
      box(20, 4, 6, 4, '#fff4b8');
      box(6, 12, 20, 9, C.glass, O, 2);                  // windscreen
      box(9, 24, 6, 3, '#ffffff');                       // roof shine
      box(6, 35, 20, 7, C.glass, O, 2);                  // rear window
    });
  });

  addDrawnTexture(scene, 'lamp', 16, 66, (ctx, box) => {
    box(6, 14, 4, 46, O);
    box(0, 4, 16, 12, O);
    box(3, 12, 10, 4, '#fff4b8');
    box(2, 58, 12, 8, O);
  });

  addDrawnTexture(scene, 'bench', 56, 34, (ctx, box) => {
    box(4, 22, 5, 12, O);
    box(47, 22, 5, 12, O);
    box(0, 0, 56, 12, C.wood, O);
    box(0, 13, 56, 12, C.wood, O);
  });

  // Balloon: drawn white and tinted per color in the game, with a string.
  addDrawnTexture(scene, 'balloon', 20, 48, (ctx) => {
    ctx.strokeStyle = '#8a7d93';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(10, 24); ctx.quadraticCurveTo(6, 36, 10, 48); ctx.stroke();
    ctx.fillStyle = '#b8adbf';
    ctx.beginPath(); ctx.ellipse(10, 12, 10, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(10, 12, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(8, 23, 4, 3);
  });

  addPixelTexture(scene, 'butterfly', [
    'oo...oo',
    'owo.owo',
    'owwowwo',
    '.owowo.',
    'owo.owo',
    '.o...o.',
  ], { o: '#8a7d93', w: '#ffffff' }, 2);

  // "Happy Birthday" bunting between two poles.
  addDrawnTexture(scene, 'banner', 260, 110, (ctx, box) => {
    box(4, 4, 8, 106, O);
    box(248, 4, 8, 106, O);
    box(22, 42, 216, 46, C.accent, O);
    signText(ctx, 'Happy Birthday Taru!', 130, 66, 20, '#ffffff');
    ctx.strokeStyle = O;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(10, 10); ctx.quadraticCurveTo(130, 30, 250, 10); ctx.stroke();
    for (let i = 0; i < 11; i++) {                       // little flags along the string
      const x = 22 + i * 21.6, y = 10 + 10 * (1 - Math.pow((x - 130) / 120, 2));
      ctx.fillStyle = C.balloons[i % C.balloons.length];
      ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 14); ctx.fill();
    }
  });
}

// The birthday cake, its candles and flames, and a confetti piece.
function createCakeTextures(scene) {
  const C = CFG.colors, O = C.buildingOutline, cream = '#fffaf5';
  addDrawnTexture(scene, 'cake', 220, 170, (ctx, box) => {
    ctx.fillStyle = O;                                     // plate
    ctx.beginPath(); ctx.ellipse(110, 156, 110, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(110, 155, 106, 11, 0, 0, Math.PI * 2); ctx.fill();

    box(14, 84, 192, 70, C.heart, O);                      // bottom layer
    box(14, 84, 192, 20, cream, O);
    for (let i = 0; i < 8; i++) box(22 + i * 23, 101, 11, 6 + (i % 3) * 5, cream);   // icing drips
    for (let i = 0; i < 14; i++) {                         // sprinkles
      box(24 + ((i * 37) % 170), 118 + ((i * 17) % 28), 5, 3, C.balloons[i % C.balloons.length]);
    }
    box(44, 30, 132, 58, C.cafeWall, O);                   // top layer
    box(44, 30, 132, 18, '#ffffff', O);
    for (let i = 0; i < 5; i++) box(52 + i * 25, 45, 10, 5 + (i % 2) * 6, '#ffffff');
    ctx.drawImage(pixelCanvas(ART.heart, { o: O, p: C.accent, w: '#ffffff' }, 4), 96, 56);
  });

  addDrawnTexture(scene, 'candle', 10, 40, (ctx, box) => {
    box(4, 0, 2, 6, O);                                    // wick
    box(0, 5, 10, 35, '#ffffff', O, 2);
    for (let i = 0; i < 4; i++) box(2, 10 + i * 8, 6, 3, C.accent);
  });

  addDrawnTexture(scene, 'flame', 14, 22, (ctx) => {
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.quadraticCurveTo(15, 14, 7, 22); ctx.quadraticCurveTo(-1, 14, 7, 0); ctx.fill();
    ctx.fillStyle = '#fff4b8';
    ctx.beginPath(); ctx.moveTo(7, 7); ctx.quadraticCurveTo(11, 16, 7, 21); ctx.quadraticCurveTo(3, 16, 7, 7); ctx.fill();
  });

  addDrawnTexture(scene, 'confetti', 8, 5, (ctx, box) => box(0, 0, 8, 5, '#ffffff'));
}

/* ---- Reading Aseprite tags ----
   Aseprite's JSON lists every frame (as an Array OR a Hash/object, depending
   on the export setting) plus "frameTags" like { name: "walk", from: 2, to: 5 }.
   We turn each tag into a looping Phaser animation with the same name, using
   the frame durations you set in Aseprite. (Phaser has a built-in version of
   this, but it only understands the Array format.)                          */
function createAsepriteAnimations(scene, key) {
  const json = scene.cache.json.get(key);
  const texture = scene.textures.get(key);
  if (!json || !json.frames) return [];
  const isArray = Array.isArray(json.frames);
  const frameList = isArray ? json.frames : Object.values(json.frames);
  const frameNames = isArray ? json.frames.map((f) => f.filename) : Object.keys(json.frames);
  // Find the texture frame name for frame number i.
  const nameOf = (i) => (texture.has(frameNames[i]) ? frameNames[i] : String(i));

  const tags = (json.meta && json.meta.frameTags) || [];
  return tags.filter((tag) => tag.name).map((tag) => {
    let frames = [];
    for (let i = tag.from; i <= tag.to && i < frameList.length; i++) {
      frames.push({ key, frame: nameOf(i), duration: frameList[i].duration || 100 });
    }
    const dir = tag.direction || 'forward';
    if (dir === 'reverse' || dir === 'pingpong_reverse') frames = frames.reverse();
    if (scene.anims.exists(tag.name)) scene.anims.remove(tag.name);
    scene.anims.create({
      key: tag.name,
      frames,
      frameRate: 1000,               // ~1ms base + each frame's own Aseprite duration
      repeat: -1,
      yoyo: dir.startsWith('pingpong'),
    });
    return tag.name;
  });
}

/* ==========================================================================
   3. SOUND
   --------------------------------------------------------------------------
   Browsers only allow sound after the player clicks/taps, so Sound.unlock()
   is called when the title screen is tapped. Everything goes through one
   "master" volume knob, which is how muting works.
   ========================================================================== */
const Sound = {
  ctx: null,          // the Web Audio context (created on first tap)
  master: null,       // master volume (0 when muted)
  musicBus: null,     // music volume
  game: null,         // Phaser game (for custom audio files)
  muted: storage.get('cozy-game-muted') === '1',
  musicTimer: null,

  init(game) {
    this.game = game;
    game.sound.mute = this.muted;
  },

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = CFG.audio.musicVolume;
      this.musicBus.connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  setMuted(muted) {
    this.muted = muted;
    storage.set('cozy-game-muted', muted ? '1' : '0');
    if (this.game) this.game.sound.mute = muted;           // custom audio files
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
  },
  toggleMute() { this.setMuted(!this.muted); },

  // Play one soft note. `when` is in AudioContext time (seconds).
  note(freq, when, duration, { type = 'sine', volume = 0.2, bus = null } = {}) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.02);        // soft attack
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);    // gentle fade
    osc.connect(gain);
    gain.connect(bus || this.master);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  },

  midiToHz: (m) => 440 * Math.pow(2, (m - 69) / 12),

  playCollect(scene) {
    if (scene.cache.audio.exists('sfx-collect')) {
      scene.sound.play('sfx-collect', { volume: CFG.audio.sfxVolume });
      return;
    }
    if (!this.ctx) return;
    const t = this.ctx.currentTime, v = 0.25 * CFG.audio.sfxVolume;
    this.note(this.midiToHz(81), t, 0.3, { volume: v });
    this.note(this.midiToHz(88), t + 0.08, 0.35, { volume: v });
    this.note(this.midiToHz(93), t + 0.16, 0.5, { volume: v * 0.7, type: 'triangle' });
  },

  playEnding() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, v = 0.2 * CFG.audio.sfxVolume;
    [72, 76, 79, 84, 88].forEach((m, i) =>
      this.note(this.midiToHz(m), t + i * 0.12, 0.9, { volume: v, type: 'triangle' }));
  },

  // A soft falling "whoosh" for blowing out the candles.
  playBlow() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, v = 0.12 * CFG.audio.sfxVolume;
    [86, 81, 77, 74, 70].forEach((m, i) => this.note(this.midiToHz(m), t + i * 0.035, 0.25, { volume: v }));
  },

  playPop() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, v = 0.18 * CFG.audio.sfxVolume;
    const m = Phaser.Math.Between(76, 91);
    this.note(this.midiToHz(m), t, 0.25, { type: 'triangle', volume: v });
    this.note(this.midiToHz(m + 7), t + 0.05, 0.3, { volume: v * 0.6 });
  },

  // "Happy Birthday to You", as [midi note, beats]. Returns how long it lasts (seconds).
  playHappyBirthday() {
    const tune = [
      [67, 0.75], [67, 0.25], [69, 1], [67, 1], [72, 1], [71, 2],
      [67, 0.75], [67, 0.25], [69, 1], [67, 1], [74, 1], [72, 2],
      [67, 0.75], [67, 0.25], [79, 1], [76, 1], [72, 1], [71, 1], [69, 2],
      [77, 0.75], [77, 0.25], [76, 1], [72, 1], [74, 1], [72, 3],
    ];
    const beat = 0.42;
    if (!this.ctx) return tune.reduce((sum, [, b]) => sum + b, 0) * beat;
    const v = 0.22 * CFG.audio.sfxVolume;
    let t = this.ctx.currentTime + 0.2;
    tune.forEach(([m, beats]) => {
      this.note(this.midiToHz(m), t, beats * beat * 0.95, { type: 'triangle', volume: v });
      this.note(this.midiToHz(m - 12), t, beats * beat * 0.9, { volume: v * 0.35 });
      t += beats * beat;
    });
    return t - this.ctx.currentTime;
  },

  // Pause the background music (e.g. during the birthday song) and bring it back.
  stopMusic(scene) {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
    const bgm = scene.sound.get('bgm');
    if (bgm && bgm.isPlaying) bgm.pause();
  },
  resumeMusic(scene) {
    const bgm = scene.sound.get('bgm');
    if (bgm && bgm.isPaused) bgm.resume();
    else this.startMusic(scene);
  },

  // Background music: your own file if set in config, otherwise a soft
  // looping arpeggio (C – Am – F – G) generated on the fly.
  startMusic(scene) {
    if (!CFG.audio.music) return;
    if (scene.cache.audio.exists('bgm')) {
      if (!scene.sound.get('bgm')) scene.sound.play('bgm', { loop: true, volume: CFG.audio.musicVolume });
      return;
    }
    if (!this.ctx || this.musicTimer) return;
    const chords = [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]];
    const pattern = [0, 1, 2, 3, 2, 1, 2, 1];
    const stepLength = 60 / CFG.audio.musicTempo / 2;   // eighth notes
    let step = 0;
    let nextTime = this.ctx.currentTime + 0.1;
    // Every 100ms, schedule any notes due in the next half second.
    this.musicTimer = setInterval(() => {
      const now = this.ctx.currentTime;
      if (nextTime < now) nextTime = now + 0.05;          // tab was asleep: don't burst
      while (nextTime < now + 0.5) {
        const chord = chords[Math.floor(step / 8) % chords.length];
        const tone = chord[pattern[step % 8]];
        this.note(this.midiToHz(tone + 12), nextTime, stepLength * 2.2, { volume: 0.06, bus: this.musicBus });
        if (step % 8 === 0) {
          this.note(this.midiToHz(chord[0] - 12), nextTime, stepLength * 7, { type: 'triangle', volume: 0.08, bus: this.musicBus });
        }
        nextTime += stepLength;
        step++;
      }
    }, 100);
  },
};

/* ==========================================================================
   4. SHARED UI PIECES
   ========================================================================== */

// A rounded, pastel button with a label. Returns a Phaser Container.
function makeButton(scene, x, y, label, onClick) {
  const txt = scene.add.text(0, -2, label, textStyle(24, '#ffffff', { fontStyle: 'bold' })).setOrigin(0.5);
  const w = txt.width + 64, h = 56;
  const g = scene.add.graphics();
  g.fillStyle(color(CFG.colors.accentDark)).fillRoundedRect(-w / 2, -h / 2 + 5, w, h, 28); // shadow
  g.fillStyle(color(CFG.colors.accent)).fillRoundedRect(-w / 2, -h / 2, w, h, 28);
  const button = scene.add.container(x, y, [g, txt]).setSize(w, h).setInteractive({ useHandCursor: true });
  button.on('pointerover', () => scene.tweens.add({ targets: button, scale: 1.06, duration: 120 }));
  button.on('pointerout', () => scene.tweens.add({ targets: button, scale: 1, duration: 120 }));
  button.on('pointerdown', onClick);
  return button;
}

// The speaker button in the top-right corner. M key also toggles it.
function createMuteButton(scene) {
  const x = scene.scale.width - 40, y = 40;
  const bg = scene.add.circle(x, y, 24, color(CFG.colors.panel))
    .setStrokeStyle(3, color(CFG.colors.panelBorder))
    .setScrollFactor(0).setDepth(30000)
    .setInteractive({ useHandCursor: true });
  const icon = scene.add.image(x, y, Sound.muted ? 'icon-sound-off' : 'icon-sound-on')
    .setScrollFactor(0).setDepth(30001);
  const toggle = () => {
    Sound.toggleMute();
    icon.setTexture(Sound.muted ? 'icon-sound-off' : 'icon-sound-on');
  };
  bg.on('pointerdown', (pointer, lx, ly, event) => { event.stopPropagation(); toggle(); });
  scene.input.keyboard.on('keydown-M', toggle);
  return bg;
}

// Birthday balloons floating up from the bottom of the screen, over and over.
function addRisingBalloons(scene, count) {
  const { width: W, height: H } = scene.scale;
  const colors = CFG.colors.balloons;
  for (let i = 0; i < count; i++) {
    const b = scene.add.image(0, 0, 'balloon').setAlpha(0.85).setTint(color(colors[i % colors.length]));
    const launch = () => {
      b.setPosition(Phaser.Math.Between(20, W - 20), H + 60);
      scene.tweens.add({
        targets: b, y: -60, x: b.x + Phaser.Math.Between(-60, 60),
        duration: Phaser.Math.Between(7000, 11000), ease: 'Sine.In', onComplete: launch,
      });
    };
    b.setPosition(-100, -100);
    scene.time.delayedCall(i * 900, launch);
  }
}

// Softly drifting hearts for the title & ending backgrounds.
function addFloatingHearts(scene, count) {
  const { width: W, height: H } = scene.scale;
  for (let i = 0; i < count; i++) {
    const heart = scene.add.image(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 'item-heart')
      .setAlpha(Phaser.Math.FloatBetween(0.15, 0.35))
      .setScale(Phaser.Math.FloatBetween(0.5, 1));
    scene.tweens.add({
      targets: heart,
      y: heart.y - Phaser.Math.Between(30, 80),
      x: heart.x + Phaser.Math.Between(-20, 20),
      duration: Phaser.Math.Between(2500, 4500),
      delay: Phaser.Math.Between(0, 1500),
      yoyo: true, repeat: -1, ease: 'Sine.InOut',
    });
  }
}

/* ==========================================================================
   5. BOOT SCENE — load files, build textures and animations
   ========================================================================== */
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    // Tell you (in the console) exactly which file is missing, if any.
    this.load.on('loaderror', (file) => {
      console.warn(`[game] Could not load "${file.src}". Check the path in config.js.`);
    });

    // Your Aseprite sprite: loads the PNG + JSON together. Phaser understands
    // both the "Array" and "Hash" JSON formats Aseprite can export.
    const P = CFG.player;
    if (P.useCustomSprite) {
      this.load.aseprite('player-custom', P.customSprite.image, P.customSprite.json);
    }
    if (CFG.audio.musicFile) this.load.audio('bgm', CFG.audio.musicFile);
    if (CFG.audio.collectSoundFile) this.load.audio('sfx-collect', CFG.audio.collectSoundFile);
  }

  create() {
    this.createTextures();
    // Store the player setup in the "registry" (shared memory between scenes).
    this.registry.set('playerSetup', this.createPlayerAnimations());
    Sound.init(this.game);
    this.scene.start('Title');
  }

  // Turn all the text-art from section 2 into textures.
  createTextures() {
    const C = CFG.colors;
    const itemPalette = { o: C.itemOutline, p: C.heart, w: '#ffffff', y: C.star, g: C.treeLeavesDark };
    addPixelTexture(this, 'item-heart', ART.heart, itemPalette, 4);
    addPixelTexture(this, 'item-star', ART.star, itemPalette, 4);
    addPixelTexture(this, 'item-letter', ART.letter, { ...itemPalette, w: C.letter }, 4);
    addPixelTexture(this, 'item-flower', ART.flower, { ...itemPalette, p: C.blossom }, 4);

    C.flowers.forEach((petal, i) => {
      addPixelTexture(this, 'deco-flower-' + i, ART.tinyFlower,
        { p: petal, y: C.star, g: C.treeLeavesDark }, 3);
    });

    addPixelTexture(this, 'tree', ART.tree, {
      o: C.treeOutline, l: C.treeLeavesLight, g: C.treeLeaves, d: C.treeLeavesDark,
      p: C.blossom, t: C.treeTrunk,
    }, 4);

    createTownTextures(this);
    createCakeTextures(this);
    addPixelTexture(this, 'sparkle', ART.sparkle, { w: '#ffffff' }, 2);
    addPixelTexture(this, 'icon-sound-on', ART.soundOn, { o: C.text }, 2);
    addPixelTexture(this, 'icon-sound-off', ART.soundOff, { o: C.text }, 2);

    // Grass tile: a flat color with a few darker tufts, repeated over the map.
    const tile = document.createElement('canvas');
    tile.width = tile.height = 48;
    const ctx = tile.getContext('2d');
    ctx.fillStyle = C.grass;
    ctx.fillRect(0, 0, 48, 48);
    ctx.fillStyle = C.grassDark;
    [[6, 8], [30, 4], [18, 26], [38, 32], [8, 40]].forEach(([x, y]) => {
      ctx.fillRect(x, y, 2, 6);
      ctx.fillRect(x + 4, y + 2, 2, 4);
    });
    this.textures.addCanvas('grass', tile).setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  // Build "idle" and "walk" animations — from your Aseprite file if enabled,
  // otherwise from the placeholder kitty. Returns what GameScene needs to know.
  createPlayerAnimations() {
    const P = CFG.player;
    const S = P.customSprite;

    if (P.useCustomSprite && this.textures.exists('player-custom')) {
      if (S.pixelArt) this.textures.get('player-custom').setFilter(Phaser.Textures.FilterMode.NEAREST);

      // Creates one animation per Aseprite tag, named after the tag.
      const tagNames = createAsepriteAnimations(this, 'player-custom');
      console.log('[game] Aseprite tags found:', tagNames.join(', ') || '(none)');

      // Tag names are matched ignoring upper/lower case ("Walk down" = "walk down").
      const findTag = (name) => name && tagNames.find((t) => t.toLowerCase() === name.toLowerCase());

      // Optional one-walk-per-direction tags. Only used if all four exist.
      const wt = S.walkTags || {};
      const dirs = { right: findTag(wt.right), left: findTag(wt.left), up: findTag(wt.up), down: findTag(wt.down) };
      const walkDirs = Object.values(dirs).every(Boolean) ? dirs : null;
      if (walkDirs) console.log('[game] Using 4-direction walk tags:', Object.values(walkDirs).join(', '));

      // Safety nets so a missing tag doesn't break the game.
      const allFrames = this.textures.get('player-custom').getFrameNames();
      const idle = findTag(S.idleTag) || S.idleTag;
      if (!this.anims.exists(idle)) {
        console.warn(`[game] No Aseprite tag named "${S.idleTag}" — using the first frame as idle.`);
        this.anims.create({ key: idle, frames: [{ key: 'player-custom', frame: allFrames[0] }] });
      }
      const walk = findTag(S.walkTag) || (walkDirs ? walkDirs.down : S.walkTag);
      if (!this.anims.exists(walk)) {
        console.warn(`[game] No Aseprite tag named "${S.walkTag}" — using all frames as walk.`);
        this.anims.create({
          key: walk, frameRate: 8, repeat: -1,
          frames: allFrames.map((f) => ({ key: 'player-custom', frame: f })),
        });
      }
      return {
        texture: 'player-custom', idle, walk, walkDirs,
        scale: S.scale, facesLeft: S.facesLeft, waddle: S.walkWaddle || 0,
      };
    }

    if (P.useCustomSprite) {
      console.warn('[game] useCustomSprite is true but the sprite failed to load — using the placeholder.');
    }

    // Placeholder kitty, drawn at 3x so it's a cute chunky 48x48.
    const pc = P.placeholderColors;
    addPixelSpriteSheet(this, 'player-placeholder', KITTY_FRAMES,
      { o: pc.outline, w: pc.body, p: pc.accent, b: pc.blush, e: pc.outline }, 3);
    for (const [name, def] of Object.entries(KITTY_ANIMS)) {
      this.anims.create({
        key: 'placeholder-' + name,
        frames: def.frames.map((f) => ({ key: 'player-placeholder', frame: f })),
        frameRate: def.frameRate,
        repeat: -1,
      });
    }
    return {
      texture: 'player-placeholder', idle: 'placeholder-idle', walk: 'placeholder-walk', walkDirs: null,
      scale: 1, facesLeft: false, waddle: 0,
    };
  }
}

/* ==========================================================================
   6. TITLE SCENE
   ========================================================================== */
class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }

  create() {
    const { width: W, height: H } = this.scale;
    const setup = this.registry.get('playerSetup');
    this.cameras.main.setBackgroundColor(CFG.colors.background);
    this.cameras.main.fadeIn(400, ...rgb(CFG.colors.background));

    addFloatingHearts(this, 16);
    addRisingBalloons(this, 6);

    // A strip of grass + flowers along the bottom.
    this.add.tileSprite(0, H - 110, W, 110, 'grass').setOrigin(0);
    for (let i = 0; i < 22; i++) {
      this.add.image(Phaser.Math.Between(10, W - 10), Phaser.Math.Between(H - 95, H - 10),
        'deco-flower-' + (i % CFG.colors.flowers.length));
    }

    // Title & subtitle
    const titleSize = Math.min(56, Math.floor(W / 11));
    this.add.text(W / 2, H * 0.24, CFG.title, textStyle(titleSize, CFG.colors.accent, {
      fontStyle: 'bold', wordWrap: { width: W - 60 }, stroke: '#ffffff', strokeThickness: 8,
    })).setOrigin(0.5);
    this.add.text(W / 2, H * 0.24 + titleSize + 10, CFG.subtitle, textStyle(22, CFG.colors.textSoft)).setOrigin(0.5, 0);

    // Character preview, hopping happily.
    const hero = this.add.sprite(W / 2, H * 0.58, setup.texture).setScale(setup.scale * 1.6).play(setup.walk);
    this.tweens.add({ targets: hero, y: hero.y - 8, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // Blinking "press to start"
    const prompt = this.add.text(W / 2, H * 0.76, CFG.text.startPrompt, textStyle(22, CFG.colors.text)).setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });

    createMuteButton(this);

    // Start on tap/click (but not when tapping the mute button) or SPACE/ENTER.
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      Sound.unlock();          // sound can only start after a user gesture
      Sound.startMusic(this);
      this.cameras.main.fadeOut(400, ...rgb(CFG.colors.background));
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
    };
    this.input.on('pointerdown', (pointer, over) => { if (over.length === 0) start(); });
    this.input.keyboard.on('keydown-SPACE', start);
    this.input.keyboard.on('keydown-ENTER', start);
  }
}

/* ==========================================================================
   7. GAME SCENE — the main gameplay
   ========================================================================== */

// Where things sit on the map (in pixels). The garden is on the left, the town
// on the right. Buildings are placed by the middle of their bottom edge.
const LAYOUT = {
  road:   { x: 1100, width: 100 },          // north–south road, full height
  street: { y: 650, height: 90 },           // east–west street, from the road to the right edge
  sidewalk: 22,
  crossings: [{ along: 'road', at: 560 }, { along: 'street', at: 1935 }],   // zebra crossings
  path: [[-60, 700], [200, 660], [420, 730], [640, 600], [880, 620], [1090, 560]],
  pond: { x: 560, y: 1050, rx: 120, ry: 70 },
  buildings: [
    { key: 'cafe',    x: 1300, y: 615 },
    { key: 'mall',    x: 1660, y: 615 },
    { key: 'house-0', x: 2050, y: 615 },
    { key: 'house-1', x: 1320, y: 970 },
    { key: 'house-2', x: 1530, y: 970 },
    { key: 'shop',    x: 1760, y: 970 },
    { key: 'house-0', x: 2010, y: 970 },
  ],
  lamps: [[1088, 220], [1212, 420], [1088, 900], [1212, 1150], [1380, 760], [1620, 760], [1880, 760]],
  benches: [[790, 1060], [2080, 1150], [440, 300]],
  banner: { x: 330, y: 610 },
  balloons: [[1575, 646], [1745, 646], [196, 622], [464, 622], [2125, 1135]],   // bunches of 3
  cars: [                                    // one lane each: speed in px/s, number of cars
    { along: 'road',   dir: 1,  offset: -23, speed: 95, count: 2 },
    { along: 'road',   dir: -1, offset: 23,  speed: 80, count: 2 },
    { along: 'street', dir: -1, offset: -22, speed: 85, count: 2 },
    { along: 'street', dir: 1,  offset: 22,  speed: 75, count: 1 },
  ],
};

class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    const W = CFG.world.width, H = CFG.world.height;
    this.collectedCount = 0;
    this.popupOpen = false;   // while true, the player can't move
    this.finished = false;
    this.obstacles = [];      // invisible collision boxes (trees, pond, buildings)

    // A seeded random generator: same seed = same map every time.
    this.rng = new Phaser.Math.RandomDataGenerator([CFG.world.seed]);

    // Physics world = the size of the map.
    this.physics.world.setBounds(0, 0, W, H);

    // --- 7a. Build the map (ground, path, roads, pond, town, items, trees, flowers)
    this.blocked = [];        // rectangles where random trees/flowers must not go
    this.add.tileSprite(0, 0, W, H, 'grass').setOrigin(0).setDepth(-100);
    this.drawPath();
    this.drawRoads(W, H);
    const pond = LAYOUT.pond;
    this.createPond(pond.x, pond.y, pond.rx, pond.ry);
    this.createTown();
    this.createCollectibles();
    this.createTrees(W, H);
    this.scatterFlowers(W, H);
    this.createCritters();
    this.createCars(W, H);

    // --- 7b. The player
    this.createPlayer();

    // --- 7c. Camera follows the player but never shows outside the map.
    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.fadeIn(500, ...rgb(CFG.colors.background));

    // --- 7d. Controls
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,SPACE,ENTER,P,SHIFT');
    this.createJoystick();

    // --- 7e. On-screen UI
    this.createHud();
    createMuteButton(this);
    this.showStartHint();
  }

  /* ---------- Map building ---------- */

  // A soft winding dirt path, drawn as lots of overlapping circles along a curve.
  drawPath() {
    const curve = new Phaser.Curves.Spline(LAYOUT.path.map(([x, y]) => new Phaser.Math.Vector2(x, y)));
    const g = this.add.graphics().setDepth(-90);
    g.fillStyle(color(CFG.colors.path));
    curve.getSpacedPoints(Math.floor(curve.getLength() / 6)).forEach((p) => g.fillCircle(p.x, p.y, 30));
  }

  // The road, the street, sidewalks, lane markings and zebra crossings.
  drawRoads(W, H) {
    const C = CFG.colors, sw = LAYOUT.sidewalk;
    const r = LAYOUT.road, s = LAYOUT.street;
    const roadRect = [r.x - sw, 0, r.width + sw * 2, H];
    const streetRect = [r.x, s.y - sw, W - r.x, s.height + sw * 2];
    const g = this.add.graphics().setDepth(-85);

    // Sidewalks (with a darker curb), then asphalt on top
    g.fillStyle(color(C.sidewalkEdge)).fillRect(...roadRect).fillRect(...streetRect);
    g.fillStyle(color(C.sidewalk))
      .fillRect(r.x - sw + 3, 0, r.width + sw * 2 - 6, H)
      .fillRect(r.x, s.y - sw + 3, W - r.x, s.height + sw * 2 - 6);
    g.fillStyle(color(C.road)).fillRect(r.x, 0, r.width, H).fillRect(r.x, s.y, W - r.x, s.height);

    // Dashed middle lines (none inside the junction)
    g.fillStyle(color(C.roadLine));
    const midX = r.x + r.width / 2, midY = s.y + s.height / 2;
    for (let y = 10; y < H; y += 44) {
      if (y + 22 < s.y || y > s.y + s.height) g.fillRect(midX - 2, y, 4, 22);
    }
    for (let x = r.x + r.width + 20; x < W; x += 44) g.fillRect(x, midY - 2, 22, 4);

    // Zebra crossings
    g.fillStyle(0xffffff, 0.9);
    LAYOUT.crossings.forEach((c) => {
      for (let i = 6; i < 96; i += 16) {
        if (c.along === 'road') g.fillRect(r.x + i, c.at - 20, 9, 40);
        else g.fillRect(c.at - 20, s.y + i * s.height / 100, 40, 9);
      }
    });

    this.blocked.push(roadRect, streetRect);
  }

  // Buildings, street lamps, benches, the birthday banner and balloons.
  createTown() {
    const C = CFG.colors;
    LAYOUT.buildings.forEach((b) => {
      const img = this.add.image(b.x, b.y, b.key).setOrigin(0.5, 1).setDepth(b.y);
      const w = img.width, h = img.height;
      this.addObstacle(b.x, b.y - h * 0.28, w - 8, h * 0.56);   // the lower part is solid
      this.blocked.push([b.x - w / 2 - 20, b.y - h - 20, w + 40, h + 40]);

      if (b.key.startsWith('house')) this.puffSmoke(b.x + 31, b.y - h + 6);
      if (b.key === 'mall') this.twinkleLights(b.x, b.y - h + 27, 180, 54, b.y + 1);
    });

    LAYOUT.lamps.forEach(([x, y]) => {
      this.add.image(x, y, 'lamp').setOrigin(0.5, 1).setDepth(y);
      this.addObstacle(x, y - 4, 12, 8);
    });
    LAYOUT.benches.forEach(([x, y]) => {
      this.add.image(x, y, 'bench').setOrigin(0.5, 1).setDepth(y);
      this.addObstacle(x, y - 8, 52, 14);
      this.blocked.push([x - 40, y - 50, 80, 70]);
    });

    const bn = LAYOUT.banner;
    this.add.image(bn.x, bn.y, 'banner').setOrigin(0.5, 1).setDepth(bn.y);
    this.addObstacle(bn.x - 122, bn.y - 4, 12, 8);   // only the two poles block
    this.addObstacle(bn.x + 122, bn.y - 4, 12, 8);
    this.blocked.push([bn.x - 140, bn.y - 120, 280, 140]);

    // Bunches of three balloons that sway on their strings
    LAYOUT.balloons.forEach(([x, y], n) => {
      [[-10, 4], [0, -8], [10, 4]].forEach(([dx, dy], i) => {
        const b = this.add.image(x + dx, y + dy, 'balloon').setOrigin(0.5, 1).setDepth(y + i)
          .setTint(color(C.balloons[(n + i) % C.balloons.length]));
        this.tweens.add({
          targets: b, angle: { from: -6, to: 6 }, y: b.y - 4,
          duration: 1400 + i * 250, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: n * 200,
        });
      });
    });
  }

  // Little puffs of smoke rising from a chimney, forever.
  puffSmoke(x, y) {
    this.time.addEvent({
      delay: 900, loop: true, startAt: this.rng.between(0, 800),
      callback: () => {
        const puff = this.add.circle(x, y, 6, 0xffffff, 0.7).setDepth(y + 500);
        this.tweens.add({
          targets: puff, y: y - 46, x: x + this.rng.between(4, 14), scale: 2.2, alpha: 0,
          duration: 2200, ease: 'Sine.Out', onComplete: () => puff.destroy(),
        });
      },
    });
  }

  // Fairy lights around the mall sign, blinking one after another.
  twinkleLights(cx, cy, w, h, depth) {
    const colors = CFG.colors.balloons;
    const spots = [];
    for (let x = -w / 2; x <= w / 2; x += 18) spots.push([x, -h / 2], [x, h / 2]);
    spots.forEach(([dx, dy], i) => {
      const bulb = this.add.circle(cx + dx, cy + dy, 3, color(colors[i % colors.length])).setDepth(depth);
      this.tweens.add({ targets: bulb, alpha: 0.25, duration: 500, yoyo: true, repeat: -1, delay: (i % 4) * 250 });
    });
  }

  // Butterflies fluttering around the garden, and ripples on the pond.
  createCritters() {
    const colors = CFG.colors.butterflies;
    for (let i = 0; i < 7; i++) {
      const home = { x: this.rng.between(150, 950), y: this.rng.between(180, 1150) };
      const b = this.add.image(home.x, home.y, 'butterfly').setDepth(5000)
        .setTint(color(colors[i % colors.length]));
      this.tweens.add({ targets: b, scaleX: 0.3, duration: 120, yoyo: true, repeat: -1 });   // flapping
      const flutter = () => this.tweens.add({
        targets: b, x: home.x + this.rng.between(-90, 90), y: home.y + this.rng.between(-60, 60),
        duration: this.rng.between(1400, 2600), ease: 'Sine.InOut', onComplete: flutter,
      });
      flutter();
    }

    const p = LAYOUT.pond;
    this.time.addEvent({
      delay: 1300, loop: true,
      callback: () => {
        const x = p.x + this.rng.between(-p.rx * 0.6, p.rx * 0.6);
        const y = p.y + this.rng.between(-p.ry * 0.5, p.ry * 0.5);
        const ring = this.add.ellipse(x, y, 10, 5).setStrokeStyle(2, 0xffffff, 0.8).setDepth(-79);
        this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 1600, onComplete: () => ring.destroy() });
      },
    });
  }

  // Cars driving along their lanes. Each lane loops; cars stop for the player.
  createCars(W, H) {
    const r = LAYOUT.road, s = LAYOUT.street;
    const junction = r.x + r.width + 10;    // where the street meets the road
    this.cars = [];
    LAYOUT.cars.forEach((def, laneIndex) => {
      const onRoad = def.along === 'road';
      const lane = {
        axis: onRoad ? 'y' : 'x',
        dir: def.dir,
        speed: def.speed,
        fixed: onRoad ? r.x + r.width / 2 + def.offset : s.y + s.height / 2 + def.offset,
        // Road cars come in and leave past the map edge; street cars fade at the junction.
        start: onRoad ? (def.dir > 0 ? -60 : H + 60) : (def.dir > 0 ? junction : W + 60),
        end: onRoad ? (def.dir > 0 ? H + 60 : -60) : (def.dir > 0 ? W + 60 : junction),
        fadeAt: onRoad ? null : junction,
      };
      const length = Math.abs(lane.end - lane.start);
      for (let i = 0; i < def.count; i++) {
        const along = lane.start + lane.dir * length * ((i + 0.5) / def.count);
        const car = this.add.image(0, 0, 'car-' + ((laneIndex + i) % CFG.colors.cars.length));
        car.setAngle(onRoad ? (def.dir > 0 ? 180 : 0) : (def.dir > 0 ? 90 : -90));
        if (onRoad) car.setPosition(lane.fixed, along); else car.setPosition(along, lane.fixed);
        car.lane = lane;
        car.speed = lane.speed;
        this.cars.push(car);
      }
    });
  }

  updateCars(dt) {
    const p = this.player.body.center;
    for (const car of this.cars) {
      const L = car.lane;
      const ahead = (o) => (L.axis === 'y' ? o.y - car.y : o.x - car.x) * L.dir;   // > 0 = in front
      const beside = (o) => Math.abs(L.axis === 'y' ? o.x - L.fixed : o.y - L.fixed);
      // Brake for the player standing in this lane, or for the car in front.
      let gap = Infinity;
      if (beside(p) < 34 && ahead(p) > 0) gap = ahead(p);
      for (const other of this.cars) {
        if (other !== car && other.lane === L && ahead(other) > 0) gap = Math.min(gap, ahead(other));
      }
      const target = gap < 80 ? 0 : L.speed;
      car.speed += (target - car.speed) * Math.min(1, dt * 5);

      let pos = (L.axis === 'y' ? car.y : car.x) + car.speed * dt * L.dir;
      if ((pos - L.end) * L.dir > 0) pos = L.start;          // off the end: back to the start
      if (L.axis === 'y') car.y = pos; else car.x = pos;
      car.setAlpha(L.fadeAt === null ? 1 : Phaser.Math.Clamp(Math.abs(pos - L.fadeAt) / 50, 0, 1));
      car.setDepth(car.y + 20);
    }
  }

  createPond(x, y, rx, ry) {
    const g = this.add.graphics().setDepth(-80);
    g.fillStyle(color(CFG.colors.waterEdge)).fillEllipse(x, y, rx * 2 + 16, ry * 2 + 16);
    g.fillStyle(color(CFG.colors.water)).fillEllipse(x, y, rx * 2, ry * 2);
    g.fillStyle(0xffffff, 0.5).fillEllipse(x - rx * 0.4, y - ry * 0.35, rx * 0.5, ry * 0.18);
    // Lily pads with a tiny blossom
    [[0.35, 0.25], [-0.25, 0.35], [0.1, -0.3]].forEach(([dx, dy]) => {
      g.fillStyle(color(CFG.colors.treeLeaves)).fillCircle(x + dx * rx, y + dy * ry, 12);
      g.fillStyle(color(CFG.colors.blossom)).fillCircle(x + dx * rx + 3, y + dy * ry - 3, 4);
    });
    this.addObstacle(x, y, rx * 1.7, ry * 1.5);
    this.pond = { x, y, rx: rx + 20, ry: ry + 20 };
  }

  // An invisible box the player bumps into.
  addObstacle(x, y, w, h) {
    const zone = this.add.zone(x, y, w, h);
    this.physics.add.existing(zone, true);   // true = static (never moves)
    this.obstacles.push(zone);
  }

  isInPond(x, y, extra = 0) {
    const p = this.pond;
    const dx = (x - p.x) / (p.rx + extra), dy = (y - p.y) / (p.ry + extra);
    return dx * dx + dy * dy < 1;
  }

  // Is this spot on a road, a sidewalk or a building?
  isBlocked(x, y) {
    return this.blocked.some(([bx, by, bw, bh]) => x > bx && x < bx + bw && y > by && y < by + bh);
  }

  // Is this spot far enough from items, the start point, the pond and the town?
  isFreeSpot(x, y, minDist) {
    const start = CFG.world.playerStart;
    if (Phaser.Math.Distance.Between(x, y, start.x, start.y) < minDist) return false;
    if (this.isInPond(x, y, 40) || this.isBlocked(x, y)) return false;
    return this.items.every((it) => Phaser.Math.Distance.Between(x, y, it.x, it.baseY) >= minDist);
  }

  createCollectibles() {
    this.items = [];
    const W = CFG.world.width, H = CFG.world.height;
    CFG.collectibles.forEach((data, i) => {
      let x = data.x, y = data.y;
      // No position given? Pick a random free spot.
      if (x === undefined || y === undefined) {
        let tries = 0;
        do {
          x = this.rng.between(150, W - 150);
          y = this.rng.between(150, H - 150);
        } while (!this.isFreeSpot(x, y, 140) && ++tries < 200);
      }
      const iconKey = this.textures.exists('item-' + data.icon) ? 'item-' + data.icon : 'item-heart';

      // Soft shadow + glow + the icon itself
      const shadow = this.add.ellipse(x, y + 24, 30, 10, 0x000000, 0.12).setDepth(y);
      const glow = this.add.circle(x, y, 26, 0xffffff, 0.45).setDepth(y);
      const item = this.add.image(x, y, iconKey).setDepth(y + 1);
      item.baseY = y;
      item.glow = glow;
      item.shadow = shadow;
      item.data_ = { ...data, title: data.title || `Memory #${i + 1}`, iconKey };
      item.collected = false;

      // Gentle bobbing and pulsing so items are easy to spot.
      this.tweens.add({ targets: item, y: y - 6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: i * 120 });
      this.tweens.add({ targets: glow, scale: 1.25, alpha: 0.15, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.items.push(item);
    });
  }

  createTrees(W, H) {
    const placeTree = (x, y) => {
      if (this.isBlocked(x, y)) return;                             // keep roads clear
      this.add.image(x, y, 'tree').setOrigin(0.5, 1).setDepth(y);  // depth = y, so things lower on screen draw in front
      this.addObstacle(x, y - 10, 26, 18);                          // only the trunk blocks
    };
    // A frame of trees around the edge of the map
    for (let x = 30; x < W; x += 66) {
      placeTree(x + this.rng.between(-8, 8), 70);
      placeTree(x + this.rng.between(-8, 8), H - 4);
    }
    for (let y = 150; y < H - 60; y += 78) {
      placeTree(24, y + this.rng.between(-8, 8));
      placeTree(W - 24, y + this.rng.between(-8, 8));
    }
    // Random trees inside, kept away from items, the start point and each other
    const placed = [];
    let tries = 0;
    while (placed.length < CFG.world.trees && tries++ < 800) {
      const x = this.rng.between(120, W - 120), y = this.rng.between(160, H - 80);
      if (!this.isFreeSpot(x, y, 100)) continue;
      if (placed.some((p) => Phaser.Math.Distance.Between(x, y, p.x, p.y) < 110)) continue;
      placed.push({ x, y });
      placeTree(x, y);
    }
  }

  scatterFlowers(W, H) {
    for (let i = 0; i < CFG.world.flowers; i++) {
      const x = this.rng.between(10, W - 10), y = this.rng.between(10, H - 10);
      if (this.isInPond(x, y, 10) || this.isBlocked(x, y)) continue;
      this.add.image(x, y, 'deco-flower-' + this.rng.between(0, CFG.colors.flowers.length - 1)).setDepth(-70);
    }
  }

  /* ---------- Player ---------- */

  createPlayer() {
    const setup = this.registry.get('playerSetup');
    this.playerSetup = setup;
    const start = CFG.world.playerStart;
    this.player = this.physics.add.sprite(start.x, start.y, setup.texture)
      .setScale(setup.scale)
      .setCollideWorldBounds(true);
    this.player.play(setup.idle);

    // Shrink the collision box to the feet (measured in the frame's own pixels).
    const hb = CFG.player.hitbox;
    const fw = this.player.frame.realWidth, fh = this.player.frame.realHeight;
    const bw = fw * hb.width, bh = fh * hb.height;
    this.player.body.setSize(bw, bh);
    this.player.body.setOffset((fw - bw) / 2, fh - bh - fh * hb.bottomGap);

    this.physics.add.collider(this.player, this.obstacles);
  }

  /* ---------- Touch / mouse joystick ---------- */
  // Touch anywhere and drag: a joystick appears under your finger.
  createJoystick() {
    const H = this.scale.height;
    this.isTouch = this.sys.game.device.input.touch;
    this.joy = { pointerId: null, x: 0, y: 0, dx: 0, dy: 0, radius: 56, homeX: 100, homeY: H - 100 };
    const restAlpha = this.isTouch && CFG.controls.joystick ? 0.5 : 0;   // faint hint on phones
    this.joyBase = this.add.circle(this.joy.homeX, this.joy.homeY, this.joy.radius, color(CFG.colors.panel), 0.6)
      .setStrokeStyle(4, color(CFG.colors.panelBorder)).setScrollFactor(0).setDepth(25000).setAlpha(restAlpha);
    this.joyKnob = this.add.circle(this.joy.homeX, this.joy.homeY, 24, color(CFG.colors.accent), 0.9)
      .setScrollFactor(0).setDepth(25001).setAlpha(restAlpha);

    this.input.on('pointerdown', (pointer, over) => {
      if (this.popupOpen) {                    // any tap closes the popup
        if (this.popupReady) this.closePopup();
        return;
      }
      if (over.length || !CFG.controls.joystick || this.joy.pointerId !== null) return;
      this.joy.pointerId = pointer.id;
      this.joy.x = pointer.x; this.joy.y = pointer.y;
      this.joyBase.setPosition(pointer.x, pointer.y).setAlpha(1);
      this.joyKnob.setPosition(pointer.x, pointer.y).setAlpha(1);
    });
    this.input.on('pointermove', (pointer) => {
      if (pointer.id !== this.joy.pointerId) return;
      const v = new Phaser.Math.Vector2(pointer.x - this.joy.x, pointer.y - this.joy.y);
      if (v.length() > this.joy.radius) v.setLength(this.joy.radius);
      this.joyKnob.setPosition(this.joy.x + v.x, this.joy.y + v.y);
      const strength = v.length() / this.joy.radius;
      if (strength < 0.15) { this.joy.dx = this.joy.dy = 0; return; }   // small dead zone
      this.joy.dx = v.x / this.joy.radius;
      this.joy.dy = v.y / this.joy.radius;
    });
    const release = (pointer) => {
      if (pointer.id !== this.joy.pointerId) return;
      this.joy.pointerId = null;
      this.joy.dx = this.joy.dy = 0;
      this.joyBase.setPosition(this.joy.homeX, this.joy.homeY).setAlpha(restAlpha);
      this.joyKnob.setPosition(this.joy.homeX, this.joy.homeY).setAlpha(restAlpha);
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
  }

  /* ---------- HUD (counter in the corner) ---------- */
  createHud() {
    const total = this.items.length;
    this.counterText = this.add.text(72, 42, '', textStyle(26, CFG.colors.text, { fontStyle: 'bold' }))
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(30001);
    this.counterText.setText(`${CFG.text.counterLabel}${total} / ${total}`); // measure widest text
    const w = this.counterText.width + 76;
    const g = this.add.graphics().setScrollFactor(0).setDepth(30000);
    g.fillStyle(color(CFG.colors.panelBorder)).fillRoundedRect(13, 13, w + 6, 58, 20);
    g.fillStyle(color(CFG.colors.panel)).fillRoundedRect(16, 16, w, 52, 18);
    this.hudIcon = this.add.image(46, 42, 'item-heart').setScrollFactor(0).setDepth(30001);
    this.updateCounter();
  }

  updateCounter() {
    this.counterText.setText(`${CFG.text.counterLabel}${this.collectedCount} / ${this.items.length}`);
  }

  showStartHint() {
    const { width: W, height: H } = this.scale;
    const hint = `${CFG.text.startHint}\n${this.isTouch ? CFG.text.touchHint : CFG.text.keyboardHint}`;
    const t = this.add.text(W / 2, H - 70, hint, textStyle(20, CFG.colors.text, {
      backgroundColor: CFG.colors.panel, padding: { x: 18, y: 10 }, lineSpacing: 4,
    })).setOrigin(0.5).setScrollFactor(0).setDepth(30000);
    this.tweens.add({ targets: t, alpha: 0, delay: 4000, duration: 800, onComplete: () => t.destroy() });
  }

  // Small floating message (used by the P position helper).
  toast(message) {
    const { width: W } = this.scale;
    const t = this.add.text(W / 2, 100, message, textStyle(18, CFG.colors.text, {
      backgroundColor: CFG.colors.panel, padding: { x: 12, y: 6 },
    })).setOrigin(0.5).setScrollFactor(0).setDepth(30000);
    this.tweens.add({ targets: t, alpha: 0, delay: 2500, duration: 500, onComplete: () => t.destroy() });
  }

  /* ---------- The game loop: runs every frame ---------- */
  update(time, delta) {
    this.updateCars(delta / 1000);

    // Read these every frame so an old key press doesn't "leak" into a popup.
    const spacePressed = Phaser.Input.Keyboard.JustDown(this.keys.SPACE);
    const enterPressed = Phaser.Input.Keyboard.JustDown(this.keys.ENTER);

    if (this.popupOpen) {
      this.player.setVelocity(0, 0);
      this.player.play(this.playerSetup.idle, true).setAngle(0);
      if ((spacePressed || enterPressed) && this.popupReady) this.closePopup();
      return;
    }

    // 1) Which direction does the player want to go? (-1, 0 or 1 on each axis)
    let dx = 0, dy = 0;
    if (this.cursors.left.isDown || this.keys.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) dy += 1;
    const dir = new Phaser.Math.Vector2(dx, dy);
    if (dir.length() > 0) dir.normalize();                 // diagonals aren't faster
    else dir.set(this.joy.dx, this.joy.dy);                // no keys? use joystick

    // 2) Move (hold SHIFT to run)
    const running = this.keys.SHIFT.isDown;
    const speed = CFG.player.speed * (running ? CFG.player.runMultiplier : 1);
    this.player.setVelocity(dir.x * speed, dir.y * speed);

    // 3) Animate: walk while moving, idle while still.
    const setup = this.playerSetup;
    const moving = dir.length() > 0.01;
    this.player.anims.timeScale = moving && running ? CFG.player.runMultiplier : 1;   // faster steps when running
    if (!moving) {
      this.player.play(setup.idle, true);
    } else if (setup.walkDirs) {
      // One animation per direction: pick whichever axis we're moving along most.
      const d = Math.abs(dir.x) >= Math.abs(dir.y)
        ? (dir.x < 0 ? 'left' : 'right')
        : (dir.y < 0 ? 'up' : 'down');
      this.player.play(setup.walkDirs[d], true);
    } else {
      // A single walk animation, flipped to face left/right.
      this.player.play(setup.walk, true);
      if (Math.abs(dir.x) > 0.1) this.player.setFlipX((dir.x < 0) !== setup.facesLeft);
    }
    // A gentle side-to-side waddle while walking (rotation doesn't affect the hitbox).
    // (A running phase instead of the clock, so speeding up doesn't make it jump.)
    this.waddlePhase = moving ? (this.waddlePhase || 0) + (delta / 90) * this.player.anims.timeScale : 0;
    this.player.setAngle(moving && setup.waddle ? Math.sin(this.waddlePhase) * setup.waddle : 0);

    // 4) Draw the player in front of / behind trees based on where their feet are.
    this.player.setDepth(this.player.body.bottom);

    // 5) Did we touch a collectible?
    const feet = this.player.body.center;
    for (const item of this.items) {
      if (!item.collected &&
          Phaser.Math.Distance.Between(feet.x, feet.y, item.x, item.baseY) < CFG.world.collectRadius) {
        this.collect(item);
        break;
      }
    }

    // Position helper (P key): shows where you're standing, for config.js.
    if (CFG.debug.positionHelper && Phaser.Input.Keyboard.JustDown(this.keys.P)) {
      const pos = `x: ${Math.round(this.player.x)}, y: ${Math.round(this.player.y)}`;
      console.log('[game] Player position →', pos);
      this.toast(pos);
    }
  }

  /* ---------- Collecting ---------- */
  collect(item) {
    item.collected = true;
    this.collectedCount++;
    this.updateCounter();
    Sound.playCollect(this);

    // Sparkle burst
    const burst = this.add.particles(0, 0, 'sparkle', {
      speed: { min: 80, max: 200 }, lifespan: 700,
      scale: { start: 1.4, end: 0 }, alpha: { start: 1, end: 0 },
      tint: [color(CFG.colors.accent), color(CFG.colors.star), 0xffffff],
      emitting: false,
    }).setDepth(20000);
    burst.explode(18, item.x, item.y);
    this.time.delayedCall(1000, () => burst.destroy());

    // Item pops and fades away; counter icon does a happy bounce
    item.glow.destroy();
    item.shadow.destroy();
    this.tweens.killTweensOf(item);
    this.tweens.add({ targets: item, scale: 2, alpha: 0, y: item.y - 20, duration: 350, onComplete: () => item.setVisible(false) });
    this.tweens.add({ targets: [this.hudIcon, this.counterText], scale: 1.3, duration: 150, yoyo: true });

    this.showPopup(item.data_);
  }

  /* ---------- Popup message ---------- */
  showPopup(data) {
    this.popupOpen = true;
    this.popupReady = false;     // short delay so a held key/tap doesn't close it instantly
    const { width: W, height: H } = this.scale;
    const pw = Math.min(W > H ? 640 : 500, W - 48);    // wider on landscape screens

    const overlay = this.add.rectangle(0, 0, W, H, color(CFG.colors.overlay), 0.3)
      .setOrigin(0).setScrollFactor(0).setDepth(40000);
    const icon = this.add.image(0, 0, data.iconKey).setScale(1.4);
    const title = this.add.text(0, 0, data.title, textStyle(30, CFG.colors.accent, { fontStyle: 'bold' })).setOrigin(0.5, 0);
    let fontSize = 21;
    const msg = this.add.text(0, 0, data.message, textStyle(fontSize, CFG.colors.text, {
      wordWrap: { width: pw - 60, useAdvancedWrap: true }, lineSpacing: 6,
    })).setOrigin(0.5, 0);
    const hint = this.add.text(0, 0, CFG.text.continueHint, textStyle(16, CFG.colors.textSoft)).setOrigin(0.5, 0);

    // Stack everything vertically and size the panel to fit.
    const pad = 28, gap = 14;
    const measure = () => pad + icon.displayHeight + gap + title.height + gap + msg.height + gap * 1.5 + hint.height + pad;
    // Long message on a short screen? Shrink the text until the panel fits.
    while (measure() > H - 30 && fontSize > 14) msg.setFontSize(--fontSize);
    const ph = measure();
    let y = -ph / 2 + pad;
    icon.setY(y + icon.displayHeight / 2); y += icon.displayHeight + gap;
    title.setY(y); y += title.height + gap;
    msg.setY(y); y += msg.height + gap * 1.5;
    hint.setY(y);

    const panel = this.add.graphics();
    panel.fillStyle(color(CFG.colors.panelBorder)).fillRoundedRect(-pw / 2 - 5, -ph / 2 - 5, pw + 10, ph + 10, 30);
    panel.fillStyle(color(CFG.colors.panel)).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 26);

    const box = this.add.container(W / 2, H / 2, [panel, icon, title, msg, hint])
      .setScrollFactor(0).setDepth(40001).setScale(0.7).setAlpha(0);
    this.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 300, ease: 'Back.Out' });
    this.tweens.add({ targets: hint, alpha: 0.4, duration: 800, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: icon, angle: { from: -8, to: 8 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.popup = { overlay, box };
    this.time.delayedCall(400, () => { this.popupReady = true; });
  }

  closePopup() {
    if (!this.popup) return;
    this.popupReady = false;
    const { overlay, box } = this.popup;
    this.popup = null;
    this.tweens.add({
      targets: box, scale: 0.8, alpha: 0, duration: 160,
      onComplete: () => { box.destroy(); overlay.destroy(); },
    });

    if (this.collectedCount >= this.items.length) {
      this.finishGame();               // keep popupOpen = true so the player stays put
    } else {
      this.popupOpen = false;
    }
  }

  finishGame() {
    if (this.finished) return;
    this.finished = true;
    Sound.playEnding();
    this.cameras.main.fadeOut(900, ...rgb(CFG.colors.background));
    const next = CFG.cake && CFG.cake.enabled ? 'Cake' : 'End';
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(next));
  }
}

/* ==========================================================================
   7b. CAKE SCENE — make a wish and blow out the candles
   ========================================================================== */
class CakeScene extends Phaser.Scene {
  constructor() { super('Cake'); }

  create() {
    const { width: W, height: H } = this.scale;
    const K = CFG.cake;
    this.cameras.main.setBackgroundColor(CFG.colors.background);
    this.cameras.main.fadeIn(800, ...rgb(CFG.colors.background));
    addFloatingHearts(this, 14);
    Sound.stopMusic(this);

    // The cake, sized to the screen, with a row of lit candles on top
    const s = Math.min(1.8, (W * 0.62) / 220, (H * 0.42) / 170);
    const cx = W / 2, cy = H * 0.72;
    this.add.image(cx, cy, 'cake').setOrigin(0.5, 1).setScale(s);
    const n = Math.max(1, K.candles);
    this.flames = [];
    for (let i = 0; i < n; i++) {
      const x = cx + (n === 1 ? 0 : (i / (n - 1) - 0.5) * 100 * s);
      const y = cy - 136 * s;                                // top of the upper layer
      this.add.image(x, y, 'candle').setOrigin(0.5, 1).setScale(s);
      const glow = this.add.circle(x, y - 42 * s, 12 * s, 0xfff4b8, 0.35);
      const flame = this.add.image(x, y - 36 * s, 'flame').setOrigin(0.5, 1).setScale(s);
      this.tweens.add({ targets: flame, scaleX: s * 0.75, scaleY: s * 1.12, duration: 180 + i * 23, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: glow, scale: 1.4, alpha: 0.15, duration: 400 + i * 40, yoyo: true, repeat: -1 });
      this.flames.push({ flame, glow, x, y: y - 50 * s });
    }

    const titleSize = Math.min(44, Math.floor(W / 13));
    this.title = this.add.text(W / 2, H * 0.16, K.wishText, textStyle(titleSize, CFG.colors.accent, {
      fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 8, wordWrap: { width: W - 60 },
    })).setOrigin(0.5).setDepth(100);          // stays in front of confetti & fireworks
    this.hint = this.add.text(W / 2, cy + 40, K.blowHint, textStyle(20, CFG.colors.textSoft)).setOrigin(0.5);
    this.tweens.add({ targets: this.hint, alpha: 0.35, duration: 800, yoyo: true, repeat: -1 });

    // First press blows the candles out; after the celebration, a press continues.
    this.stage = 'wish';
    this.ready = false;
    this.time.delayedCall(900, () => { this.ready = true; });
    const press = () => {
      if (!this.ready) return;
      if (this.stage === 'wish') this.blowOut();
      else if (this.stage === 'done') this.goToEnding();
    };
    this.input.on('pointerdown', (pointer, over) => { if (over.length === 0) press(); });
    this.input.keyboard.on('keydown-SPACE', press);
    this.input.keyboard.on('keydown-ENTER', press);
    createMuteButton(this);
  }

  blowOut() {
    const { width: W, height: H } = this.scale;
    this.stage = 'celebrating';
    Sound.playBlow();
    this.hint.setVisible(false);

    // Flames go out one after another, each leaving a wisp of smoke
    this.flames.forEach(({ flame, glow, x, y }, i) => {
      this.time.delayedCall(i * 70, () => {
        this.tweens.killTweensOf([flame, glow]);
        this.tweens.add({ targets: [flame, glow], alpha: 0, scaleY: 0, duration: 200 });
        for (let k = 0; k < 3; k++) {
          const puff = this.add.circle(x, y, 4, 0xd8cfdc, 0.8);
          this.tweens.add({
            targets: puff, y: y - 50 - k * 12, x: x + Phaser.Math.Between(-8, 8), scale: 2.5, alpha: 0,
            delay: k * 160, duration: 1300, onComplete: () => puff.destroy(),
          });
        }
      });
    });

    this.time.delayedCall(600, () => {
      const songLength = Sound.playHappyBirthday();
      this.title.setText(CFG.cake.celebrateText);
      this.tweens.add({ targets: this.title, scale: { from: 0.4, to: 1 }, duration: 600, ease: 'Back.Out' });
      this.confetti(W);
      // Fireworks throughout the song
      const count = Math.max(6, Math.floor(songLength / 0.8));
      this.time.addEvent({ delay: 750, repeat: count - 1, callback: () => this.firework(W, H) });
      // Let the song play, then offer to continue
      this.time.delayedCall(Math.min(songLength * 1000, 12000), () => {
        this.stage = 'done';
        this.hint.setText(CFG.text.continueHint).setVisible(true);
      });
    });
  }

  confetti(W) {
    const tints = CFG.colors.balloons.concat(CFG.colors.accent, CFG.colors.star).map(color);
    const rain = this.add.particles(0, -10, 'confetti', {
      x: { min: 0, max: W }, lifespan: 5000,
      speedY: { min: 90, max: 200 }, speedX: { min: -50, max: 50 },
      rotate: { start: 0, end: 540 }, scale: { min: 0.8, max: 1.6 },
      tint: tints, frequency: 35, quantity: 2,
    }).setDepth(50);
    this.time.delayedCall(5000, () => rain.stop());
  }

  // A little rocket that flies up and bursts into sparkles.
  firework(W, H) {
    const x = Phaser.Math.Between(W * 0.12, W * 0.88), y = Phaser.Math.Between(H * 0.1, H * 0.4);
    const tint = color(Phaser.Utils.Array.GetRandom(CFG.colors.balloons.concat(CFG.colors.star)));
    const rocket = this.add.circle(x, H + 10, 3, 0xffffff).setDepth(40);
    this.tweens.add({
      targets: rocket, y, duration: 600, ease: 'Quad.Out',
      onComplete: () => {
        rocket.destroy();
        Sound.playPop();
        const burst = this.add.particles(0, 0, 'sparkle', {
          speed: { min: 60, max: 230 }, lifespan: 1000, gravityY: 140,
          scale: { start: 1.6, end: 0 }, alpha: { start: 1, end: 0 },
          tint: [tint, 0xffffff], emitting: false,
        }).setDepth(40);
        burst.explode(36, x, y);
        this.time.delayedCall(1200, () => burst.destroy());
      },
    });
  }

  goToEnding() {
    this.stage = 'leaving';
    this.cameras.main.fadeOut(800, ...rgb(CFG.colors.background));
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('End'));
  }
}

/* ==========================================================================
   8. END SCENE — the final message
   ========================================================================== */
class EndScene extends Phaser.Scene {
  constructor() { super('End'); }

  create() {
    const { width: W, height: H } = this.scale;
    this.cameras.main.setBackgroundColor(CFG.colors.background);
    this.cameras.main.fadeIn(800, ...rgb(CFG.colors.background));
    addFloatingHearts(this, 24);
    addRisingBalloons(this, 10);
    Sound.resumeMusic(this);

    // Build the pieces first, then center them vertically as a group.
    const titleSize = Math.min(48, Math.floor(W / 12));
    const icons = CFG.collectibles.map((c) =>
      this.add.image(0, 0, this.textures.exists('item-' + c.icon) ? 'item-' + c.icon : 'item-heart').setAlpha(0));
    const title = this.add.text(W / 2, 0, CFG.ending.title, textStyle(titleSize, CFG.colors.accent, {
      fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 8, wordWrap: { width: W - 60 },
    })).setOrigin(0.5, 0).setAlpha(0);
    const msg = this.add.text(W / 2, 0, CFG.ending.message, textStyle(22, CFG.colors.text, {
      wordWrap: { width: Math.min(620, W - 60), useAdvancedWrap: true }, lineSpacing: 8,
    })).setOrigin(0.5, 0).setAlpha(0);
    const sig = this.add.text(W / 2, 0, CFG.ending.signature, textStyle(22, CFG.colors.textSoft, { fontStyle: 'italic' }))
      .setOrigin(0.5, 0).setAlpha(0);
    const button = makeButton(this, W / 2, 0, CFG.text.playAgain, () => {
      this.cameras.main.fadeOut(400, ...rgb(CFG.colors.background));
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
    }).setAlpha(0);

    const gap = 22;
    const total = 30 + gap + title.height + gap + msg.height + gap + sig.height + gap * 2 + 56;
    let y = Math.max(20, (H - total) / 2);
    const spacing = Math.min(48, (W - 40) / icons.length);
    icons.forEach((icon, i) => icon.setPosition(W / 2 + (i - (icons.length - 1) / 2) * spacing, y + 15));
    y += 30 + gap;
    title.setY(y); y += title.height + gap;
    msg.setY(y); y += msg.height + gap;
    sig.setY(y); y += sig.height + gap * 2;
    button.setY(y + 28);

    // Reveal one piece after another.
    icons.forEach((icon, i) => this.tweens.add({ targets: icon, alpha: 1, scale: { from: 0, to: 1 }, delay: 300 + i * 90, duration: 300, ease: 'Back.Out' }));
    // The button only becomes clickable once visible, so a quick double-tap
    // at the end of the game can't skip the message by accident.
    button.disableInteractive();
    [title, msg, sig, button].forEach((obj, i) =>
      this.tweens.add({
        targets: obj, alpha: 1, delay: 900 + i * 700, duration: 700,
        onComplete: () => { if (obj === button) button.setInteractive({ useHandCursor: true }); },
      }));

    createMuteButton(this);
  }
}

/* ==========================================================================
   9. START THE GAME
   --------------------------------------------------------------------------
   The game picks a portrait or landscape canvas based on the screen, then
   scales it to fit (Phaser.Scale.FIT). We wait briefly for the web font so
   text doesn't appear in the fallback font first.
   ========================================================================== */
function startGame() {
  const portrait = window.innerHeight > window.innerWidth;
  // Saved on `window` so you can poke at it from the browser console.
  window.game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: portrait ? 540 : 960,
    height: portrait ? 960 : 600,
    backgroundColor: CFG.colors.background,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { debug: CFG.debug.showHitboxes } },
    input: { activePointers: 3 },   // allow multi-touch
    scene: [BootScene, TitleScene, GameScene, CakeScene, EndScene],
  });
}

const fontFamily = CFG.ui.fontFamily;
const fontsReady = document.fonts
  ? Promise.all([document.fonts.load(`20px ${fontFamily}`), document.fonts.load(`bold 20px ${fontFamily}`)])
  : Promise.resolve();
Promise.race([fontsReady, new Promise((resolve) => setTimeout(resolve, 2500))])
  .catch(() => {})
  .then(startGame);
