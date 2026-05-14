// 像素冒险：横版平台跳跃
import { loadAtlas, drawSprite } from '../../shared/atlas.js';
import { mountShell, mountLoader, fitCanvas } from '../../shared/game-shell.js';

mountShell('🌟 像素冒险');
const loader = mountLoader('🌟 像素冒险');

const W = 900, H = 540;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
fitCanvas(canvas, W, H);

// 检测触摸设备
if ('ontouchstart' in window || navigator.maxTouchPoints) document.body.classList.add('is-touch');

const hudCoins = document.getElementById('hud-coins');
const hudGems = document.getElementById('hud-gems');
const hudLife = document.getElementById('hud-life');
const hudLevel = document.getElementById('hud-level');

const BASE = '../../assets/platformer';
const sources = [
  { png: `${BASE}/ground.png`, xml: `${BASE}/ground.xml`, size: 207369 },
  { png: `${BASE}/tiles.png`, xml: `${BASE}/tiles.xml`, size: 131120 },
  { png: `${BASE}/players.png`, xml: `${BASE}/players.xml`, size: 242837 },
  { png: `${BASE}/enemies.png`, xml: `${BASE}/enemies.xml`, size: 132167 },
  { png: `${BASE}/items.png`, xml: `${BASE}/items.xml`, size: 32491 }
];
sources.forEach(s => { loader.tracker.register(s.png, s.size); loader.tracker.register(s.xml, 5000); });

(async () => {
  const atlases = await Promise.all(sources.map(s => loadAtlas(s.png, s.xml, p => loader.tracker.update(p))));
  // 合并：返回一个查找函数
  const all = atlases.reduce((acc, a) => {
    Object.entries(a.frames).forEach(([k, v]) => { acc.frames[k] = { ...v, image: a.image }; });
    return acc;
  }, { frames: {} });
  loader.hide();
  start(all);
})();

// 自定义 drawSprite 因为我们有多张 image
function draw(ctx, atlas, name, dx, dy, dw, dh, opts = {}) {
  const f = atlas.frames[name];
  if (!f) return;
  const { rotation = 0, flipX = false, anchorX = 0.5, anchorY = 0.5, alpha = 1 } = opts;
  dw = dw ?? f.w; dh = dh ?? f.h;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(dx, dy);
  if (rotation) ctx.rotate(rotation);
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(f.image, f.x, f.y, f.w, f.h, -dw * anchorX, -dh * anchorY, dw, dh);
  ctx.restore();
}

function start(atlas) {
  const TILE = 70;
  // 关卡：使用字符地图。 each char represents a tile
  // 字符:
  // . = 空
  // G = 草顶
  // D = 土块（内部）
  // P = 玩家起点
  // C = 金币
  // M = 宝石
  // E = 敌人 (slime)
  // F = 敌人 (fly)
  // B = 弹簧
  // R = 砖块 grey
  // X = 尖刺
  // S = 旗帜 (终点)
  // ^ = 蘑菇平台
  // [ = grass left, ] = grass right
  const LEVELS = [
    [
      '..........................................',
      '..........................................',
      '...........CCC............................',
      '..........[GG]............................',
      '.....C.....DD....C........................',
      '....[G]...DD....[G].....CC......C.........',
      '....DD....DD....DD.....[GG]....[G].M.S....',
      '....DD....DD....DD.....DDDD....DDDDDDDD...',
      'P...DD....DD....DD..E..DDDD....DDDDDDDD...',
      'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
    ],
    [
      '..........................................................',
      '............................CCCC..........................',
      '..............M............[GGGG]..F..........M............',
      '............[GG]...........DDDDDD..........[GG]............',
      '............DDDD...C..C....DDDDDD...........DDDD...........',
      '...C..C.....DDDD..[GG]C....DDDDDD..C.........DDDD...M.S....',
      '..[GGGG]....DDDD..DDDDDD...DDDDDD.[G]........DDDDDDDDDDD...',
      '..DDDDDD.E..DDDD..DDDDDD.E.DDDDDD.DDD.E......DDDDDDDDDDD...',
      'P.DDDDDD....DDDD..DDDDDD...DDDDDD.DDD........DDDDDDDDDDD...',
      'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
    ],
    [
      '............................................................CCCCCC.............',
      '............................................................[GGGGG].............',
      '......CCC.................................F.............M...DDDDDD.............',
      '.....[GGG]...M.....CCC...............M........CCC...........DDDDDD.............',
      '.....DDDD.M.[GG]..[GGG]......M.....[GG]....M.[GG]..M.........DDDDDD.M.S.........',
      '..C..DDDD..DDDD...DDDD....F.[G]....DDDD....[GGGGG].[G].......DDDDDDDDDDDDDDD....',
      '.[G].DDDD..DDDD...DDDD...... DD....DDDD....DDDDDDDD.DD.......DDDDDDDDDDDDDDD....',
      '.DDD.DDDD..DDDD..E.DDDD...... DD....DDDD.E.. DDDDDDDDDDD.E....DDDDDDDDDDDDDDD....',
      'P.....................X.......X..................X......................X.....',
      'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
    ]
  ];

  const state = {
    level: 0,
    coins: 0,
    gems: 0,
    life: 3,
    over: false,
    won: false
  };
  let world;

  function loadLevel(idx) {
    const map = LEVELS[idx];
    const rows = map.length;
    const cols = Math.max(...map.map(r => r.length));
    const solids = [];
    const decor = [];
    const enemies = [];
    const items = [];
    const hazards = [];
    let player = null;
    let goal = null;

    for (let y = 0; y < rows; y++) {
      const row = map[y];
      for (let x = 0; x < row.length; x++) {
        const c = row[x];
        const px = x * TILE, py = y * TILE;
        if (c === 'G' || c === 'D') {
          const isTop = c === 'G';
          // 决定tile样式
          const left = row[x-1];
          const right = row[x+1];
          let sprite = isTop ? 'grassMid' : 'dirtCenter';
          if (isTop) {
            if (left !== 'G' && (right === 'G' || right === ']')) sprite = 'grassLeft';
            else if ((left === 'G' || left === '[') && right !== 'G') sprite = 'grassRight';
            else if (left !== 'G' && right !== 'G') sprite = 'grass';
          }
          solids.push({ x: px, y: py, w: TILE, h: TILE, sprite });
        } else if (c === '[') {
          solids.push({ x: px, y: py, w: TILE, h: TILE, sprite: 'grassLeft' });
        } else if (c === ']') {
          solids.push({ x: px, y: py, w: TILE, h: TILE, sprite: 'grassRight' });
        } else if (c === 'R') {
          solids.push({ x: px, y: py, w: TILE, h: TILE, sprite: 'brickGrey' });
        } else if (c === 'B') {
          solids.push({ x: px, y: py + 25, w: TILE, h: TILE - 25, sprite: 'spring', spring: true });
        } else if (c === 'C') {
          items.push({ x: px + TILE/2, y: py + TILE/2, type: 'coin', sprite: 'coinGold' });
        } else if (c === 'M') {
          items.push({ x: px + TILE/2, y: py + TILE/2, type: 'gem', sprite: ['gemBlue','gemGreen','gemRed','gemYellow'][Math.floor(Math.random()*4)] });
        } else if (c === 'E') {
          enemies.push({ x: px + TILE/2, y: py + TILE - 24, w: 56, h: 48, vx: -50, dir: -1, sprite: 'slimeBlue', kind: 'slime', stunned: 0 });
        } else if (c === 'F') {
          enemies.push({ x: px + TILE/2, y: py + TILE/2, w: 56, h: 48, vx: -60, dir: -1, sprite: 'fly', kind: 'fly', oy: py + TILE/2, t: Math.random()*Math.PI*2 });
        } else if (c === 'X') {
          hazards.push({ x: px, y: py + TILE - 30, w: TILE, h: 30, sprite: 'spikes' });
        } else if (c === 'P') {
          player = { x: px + TILE/2, y: py + TILE - 28, w: 50, h: 56, vx: 0, vy: 0, onGround: false, facing: 1, anim: 0, animT: 0, color: 'Green', invuln: 0, dead: false };
        } else if (c === 'S') {
          goal = { x: px + TILE/2, y: py + TILE - 45, w: 50, h: 90 };
        }
      }
    }
    if (!player) player = { x: 60, y: 100, w: 50, h: 56, vx: 0, vy: 0, onGround: false, facing: 1, anim: 0, animT: 0, color: 'Green', invuln: 0, dead: false };
    return { solids, enemies, items, hazards, player, goal, cols, rows, width: cols * TILE, height: rows * TILE };
  }

  // 摄像机（必须在 setLevel 之前定义）
  const cam = { x: 0, y: 0 };

  function setLevel(i) {
    state.level = i;
    state.over = false;
    state.won = false;
    world = loadLevel(i);
    hudLevel.textContent = state.level + 1;
    cam.x = 0; cam.y = 0;
    updateHUD();
  }

  function updateHUD() {
    hudCoins.textContent = state.coins;
    hudGems.textContent = state.gems;
    hudLife.textContent = state.life;
  }

  setLevel(0);
  function updateCam() {
    const p = world.player;
    const target = p.x - W/2;
    cam.x += (target - cam.x) * 0.12;
    cam.x = Math.max(0, Math.min(world.width - W, cam.x));
    cam.y = Math.max(0, Math.min(world.height - H, world.height - H));
  }

  // 输入
  const input = { left: false, right: false, jump: false, jumpPressed: false };
  window.addEventListener('keydown', e => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = true;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyK') {
      if (!input.jump) input.jumpPressed = true;
      input.jump = true;
    }
    if (state.over && (e.code === 'KeyR' || e.code === 'Enter')) setLevel(state.level);
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyK') input.jump = false;
  });

  function bindBtn(id, key) {
    const el = document.getElementById(id);
    const onDown = e => { e.preventDefault(); input[key] = true; if (key === 'jump') input.jumpPressed = true; };
    const onUp = e => { e.preventDefault(); input[key] = false; };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', onUp);
  }
  bindBtn('btn-left', 'left');
  bindBtn('btn-right', 'right');
  bindBtn('btn-jump', 'jump');

  // 物理常数
  const GRAVITY = 1800;
  const MOVE_SPEED = 260;
  const JUMP_VEL = -680;
  const ACCEL = 1800;
  const FRICTION = 1400;

  let audioCtx;
  function beep(freq, dur, type='sine', vol=0.05) {
    try {
      audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = vol;
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }

  function rectOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // 主循环
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last)/1000);
    last = now;
    if (!state.over) update(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function update(dt) {
    const p = world.player;

    // 横向加速度
    let dir = 0;
    if (input.left) dir -= 1;
    if (input.right) dir += 1;
    if (dir !== 0) {
      p.vx += dir * ACCEL * dt;
      p.vx = Math.max(-MOVE_SPEED, Math.min(MOVE_SPEED, p.vx));
      p.facing = dir;
    } else {
      const sign = Math.sign(p.vx);
      p.vx -= sign * FRICTION * dt;
      if (Math.sign(p.vx) !== sign) p.vx = 0;
    }
    // 跳跃
    if (input.jumpPressed && p.onGround) {
      p.vy = JUMP_VEL;
      p.onGround = false;
      beep(700, 0.1, 'square', 0.05);
    }
    input.jumpPressed = false;

    // 重力
    p.vy += GRAVITY * dt;
    if (p.vy > 1400) p.vy = 1400;

    // X 碰撞
    p.x += p.vx * dt;
    for (const s of world.solids) {
      const a = { x: p.x - p.w/2, y: p.y - p.h/2, w: p.w, h: p.h };
      if (rectOverlap(a, s)) {
        if (p.vx > 0) p.x = s.x - p.w/2 - 0.01;
        else if (p.vx < 0) p.x = s.x + s.w + p.w/2 + 0.01;
        p.vx = 0;
      }
    }
    // Y 碰撞
    p.y += p.vy * dt;
    p.onGround = false;
    for (const s of world.solids) {
      const a = { x: p.x - p.w/2, y: p.y - p.h/2, w: p.w, h: p.h };
      if (rectOverlap(a, s)) {
        if (p.vy > 0) {
          p.y = s.y - p.h/2 - 0.01;
          if (s.spring) { p.vy = JUMP_VEL * 1.4; beep(880, 0.12, 'triangle', 0.06); }
          else { p.vy = 0; p.onGround = true; }
        } else if (p.vy < 0) {
          p.y = s.y + s.h + p.h/2 + 0.01;
          p.vy = 0;
        }
      }
    }
    // 边界
    if (p.x < p.w/2) p.x = p.w/2;
    if (p.x > world.width - p.w/2) p.x = world.width - p.w/2;
    if (p.y > world.height + 200) { p.y = -200; hurt(); }

    if (p.invuln > 0) p.invuln -= dt;

    // 动画帧
    p.animT += dt;
    if (p.animT > 0.12) { p.anim = (p.anim + 1) % 2; p.animT = 0; }

    // 敌人
    for (const e of world.enemies) {
      if (e.kind === 'slime') {
        e.x += e.vx * dt;
        // 简易反向：碰到 solids 或下方为空
        for (const s of world.solids) {
          const a = { x: e.x - e.w/2, y: e.y - e.h/2, w: e.w, h: e.h };
          if (rectOverlap(a, s)) {
            if (e.vx > 0) e.x = s.x - e.w/2 - 0.01;
            else e.x = s.x + s.w + e.w/2 + 0.01;
            e.vx *= -1; e.dir *= -1;
          }
        }
        // 检测前方下方是否有地面，没有就反向
        const probeX = e.x + e.dir * (e.w/2 + 4);
        const probeY = e.y + e.h/2 + 8;
        let onLedge = false;
        for (const s of world.solids) {
          if (probeX > s.x && probeX < s.x + s.w && probeY > s.y && probeY < s.y + s.h) onLedge = true;
        }
        if (!onLedge) { e.vx *= -1; e.dir *= -1; }
      } else if (e.kind === 'fly') {
        e.t = (e.t || 0) + dt * 2;
        e.y = e.oy + Math.sin(e.t) * 40;
        e.x += e.vx * dt;
        if (e.x < 60 || e.x > world.width - 60) { e.vx *= -1; e.dir *= -1; }
      }
    }

    // 碰撞玩家 vs 敌人
    for (let i = world.enemies.length - 1; i >= 0; i--) {
      const e = world.enemies[i];
      const pa = { x: p.x - p.w/2, y: p.y - p.h/2, w: p.w, h: p.h };
      const ea = { x: e.x - e.w/2, y: e.y - e.h/2, w: e.w, h: e.h };
      if (rectOverlap(pa, ea)) {
        if (p.vy > 100 && p.y < e.y - 8) {
          // 踩死
          world.enemies.splice(i, 1);
          p.vy = JUMP_VEL * 0.7;
          beep(900, 0.1, 'square', 0.06);
        } else {
          hurt();
        }
      }
    }
    // 危险物
    for (const h of world.hazards) {
      const pa = { x: p.x - p.w/2, y: p.y - p.h/2 + 10, w: p.w, h: p.h - 10 };
      if (rectOverlap(pa, h)) hurt();
    }

    // 道具
    for (let i = world.items.length - 1; i >= 0; i--) {
      const it = world.items[i];
      if (Math.hypot(it.x - p.x, it.y - p.y) < 40) {
        if (it.type === 'coin') { state.coins++; beep(1320, 0.08, 'triangle', 0.05); }
        else { state.gems++; beep(1760, 0.12, 'triangle', 0.07); }
        world.items.splice(i, 1);
        updateHUD();
      }
    }

    // 终点
    if (world.goal) {
      const g = world.goal;
      if (Math.abs(p.x - g.x) < g.w/2 + 20 && Math.abs(p.y - g.y) < g.h/2 + 30) {
        win();
      }
    }

    updateCam();
  }

  function hurt() {
    const p = world.player;
    if (p.invuln > 0) return;
    state.life--;
    updateHUD();
    p.invuln = 1.2;
    p.vy = -400;
    beep(180, 0.3, 'sawtooth', 0.08);
    if (state.life <= 0) {
      gameOver(false);
    }
  }

  function win() {
    if (state.over) return;
    state.over = true;
    state.won = true;
    beep(1200, 0.5, 'triangle', 0.08);
    const isLast = state.level >= LEVELS.length - 1;
    const screen = document.createElement('div');
    screen.className = 'overlay-screen';
    screen.innerHTML = `
      <div class="overlay-card">
        <h1>${isLast ? '通关 🏆' : '过关 ✨'}</h1>
        <p>金币 ${state.coins} · 宝石 ${state.gems}</p>
        <button class="btn" id="btn-next">${isLast ? '从头再来' : '下一关'}</button>
      </div>`;
    document.body.appendChild(screen);
    screen.querySelector('#btn-next').addEventListener('click', () => {
      screen.remove();
      if (isLast) { state.coins = 0; state.gems = 0; state.life = 3; setLevel(0); }
      else setLevel(state.level + 1);
    });
  }

  function gameOver() {
    state.over = true;
    const screen = document.createElement('div');
    screen.className = 'overlay-screen';
    screen.innerHTML = `
      <div class="overlay-card">
        <h1>游戏结束</h1>
        <p>金币 ${state.coins} · 宝石 ${state.gems}</p>
        <button class="btn" id="btn-restart">重新开始</button>
      </div>`;
    document.body.appendChild(screen);
    screen.querySelector('#btn-restart').addEventListener('click', () => {
      screen.remove();
      state.coins = 0; state.gems = 0; state.life = 3;
      updateHUD();
      setLevel(0);
    });
  }

  // 渲染
  function render() {
    // 天空渐变
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#5cb6e8'); g.addColorStop(1, '#b6e2f5');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 远山(简单视差)
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    const hillOff = -cam.x * 0.3;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(((hillOff + i*200) % (W+200)) + ((hillOff < 0) ? W : 0), H - 60, 120, Math.PI, 0);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // 装饰
    for (const s of world.solids) {
      draw(ctx, atlas, s.sprite, s.x + s.w/2, s.y + s.h/2, s.w, s.h);
    }
    for (const h of world.hazards) {
      draw(ctx, atlas, h.sprite, h.x + h.w/2, h.y + h.h/2, h.w, h.h);
    }

    // 终点旗
    if (world.goal) {
      const t = Math.floor(performance.now() / 200) % 2;
      draw(ctx, atlas, t === 0 ? 'flagRed1' : 'flagRed2', world.goal.x, world.goal.y, world.goal.w, world.goal.h);
    }

    // 道具
    for (const it of world.items) {
      const y = it.y + Math.sin(performance.now()/250 + it.x)*4;
      draw(ctx, atlas, it.sprite, it.x, y, 40, 40);
    }

    // 敌人
    for (const e of world.enemies) {
      const flip = e.dir < 0;
      let sprite = e.sprite;
      if (e.kind === 'fly') {
        sprite = (Math.floor(performance.now()/120) % 2 === 0) ? 'fly' : 'fly_move';
      } else if (e.kind === 'slime') {
        sprite = (Math.floor(performance.now()/200) % 2 === 0) ? 'slimeBlue' : 'slimeBlue_move';
      }
      draw(ctx, atlas, sprite, e.x, e.y, e.w, e.h, { flipX: flip });
    }

    // 玩家
    const p = world.player;
    let pSprite = `alien${p.color}_stand`;
    if (!p.onGround) pSprite = `alien${p.color}_jump`;
    else if (Math.abs(p.vx) > 30) pSprite = `alien${p.color}_walk${p.anim+1}`;
    const flash = p.invuln > 0 ? (Math.floor(p.invuln*12) % 2 === 0) : false;
    if (!flash) draw(ctx, atlas, pSprite, p.x, p.y, p.w, p.h, { flipX: p.facing < 0 });

    ctx.restore();
  }
}
