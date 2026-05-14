// 太空大战：纵向卷轴射击
import { loadAtlas, drawSprite } from '../../shared/atlas.js';
import { mountShell, mountLoader, fitCanvas } from '../../shared/game-shell.js';

mountShell('🚀 太空大战');
const loader = mountLoader('🚀 太空大战');

const W = 540, H = 800;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
fitCanvas(canvas, W, H);

const hudScore = document.getElementById('hud-score');
const hudLife = document.getElementById('hud-life');
const hudWave = document.getElementById('hud-wave');

const ATLAS_PNG = '../../assets/space-shooter/sheet.png';
const ATLAS_XML = '../../assets/space-shooter/sheet.xml';

loader.tracker.register(ATLAS_PNG, 147484);
loader.tracker.register(ATLAS_XML, 22737);

(async () => {
  const atlas = await loadAtlas(ATLAS_PNG, ATLAS_XML, p => loader.tracker.update(p));
  loader.hide();
  startGame(atlas);
})();

function startGame(atlas) {
  // 静态背景星
  const stars = [];
  for (let i = 0; i < 80; i++) {
    stars.push({ x: Math.random()*W, y: Math.random()*H, s: Math.random()*2+0.5, v: 30 + Math.random()*80 });
  }

  const state = {
    running: true,
    over: false,
    score: 0,
    life: 3,
    wave: 1,
    lastShot: 0,
    spawnTimer: 0,
    waveTimer: 0,
    waveEnemies: 6,
    waveEnemiesLeft: 6
  };

  const player = {
    x: W/2, y: H - 110,
    w: 60, h: 70,
    speed: 380,
    cool: 0.18,
    invuln: 0,
    sprite: 'playerShip1_blue'
  };

  const bullets = [];
  const enemyBullets = [];
  const enemies = [];
  const explosions = [];
  const powerups = [];
  let powerLevel = 1; // 1=single, 2=double, 3=triple
  let powerTimer = 0;

  // 输入
  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (state.over && (e.code === 'Space' || e.code === 'Enter')) restart();
  });
  window.addEventListener('keyup', e => keys[e.code] = false);

  // 触屏：用手指/鼠标位置跟随
  let pointer = null;
  function getPointer(ev) {
    const rect = canvas.getBoundingClientRect();
    const t = ev.touches ? ev.touches[0] : ev;
    return {
      x: (t.clientX - rect.left) * (W / rect.width),
      y: (t.clientY - rect.top) * (H / rect.height)
    };
  }
  canvas.addEventListener('pointerdown', e => { pointer = getPointer(e); if (state.over) restart(); });
  canvas.addEventListener('pointermove', e => { if (pointer) pointer = getPointer(e); });
  canvas.addEventListener('pointerup', () => pointer = null);
  canvas.addEventListener('pointercancel', () => pointer = null);

  function restart() {
    state.over = false;
    state.score = 0;
    state.life = 3;
    state.wave = 1;
    state.waveEnemies = 6;
    state.waveEnemiesLeft = 6;
    player.x = W/2; player.y = H-110; player.invuln = 1.5;
    bullets.length = 0;
    enemies.length = 0;
    enemyBullets.length = 0;
    explosions.length = 0;
    powerups.length = 0;
    powerLevel = 1;
    powerTimer = 0;
    updateHUD();
  }

  function updateHUD() {
    hudScore.textContent = state.score;
    hudLife.textContent = state.life;
    hudWave.textContent = state.wave;
  }
  updateHUD();

  function spawnEnemy() {
    if (state.waveEnemiesLeft <= 0) return;
    state.waveEnemiesLeft--;
    const tier = Math.min(5, Math.ceil(Math.random()*3) + Math.floor(state.wave/3));
    const colors = ['Black','Blue','Green','Red'];
    const c = colors[Math.floor(Math.random()*colors.length)];
    const sprite = `enemy${c}${Math.min(5,Math.max(1,tier))}`;
    const w = 60, h = 60;
    const x = 60 + Math.random()*(W-120);
    const pattern = Math.random();
    enemies.push({
      x, y: -h,
      w, h, sprite,
      hp: 1 + Math.floor(state.wave/3),
      vy: 80 + Math.random()*40 + state.wave*8,
      vx: 0,
      shootCool: 1.5 + Math.random()*2,
      lastShoot: 0,
      pattern, // 0..1: 0=straight, 1=sin
      phase: Math.random()*Math.PI*2,
      score: 10 + tier*5
    });
  }

  function spawnMeteor() {
    const sizes = ['big','med','small','tiny'];
    const s = sizes[Math.floor(Math.random()*sizes.length)];
    const n = (s==='big'||s==='med') ? Math.ceil(Math.random()*4) : Math.ceil(Math.random()*2);
    const sprite = `meteorBrown_${s}${n}`;
    const sz = { big: 100, med: 60, small: 35, tiny: 22 }[s];
    enemies.push({
      x: Math.random()*W, y: -sz,
      w: sz, h: sz, sprite,
      hp: { big: 4, med: 2, small: 1, tiny: 1 }[s],
      vy: 60 + Math.random()*120,
      vx: (Math.random()-0.5)*40,
      shootCool: 999, lastShoot: 0,
      pattern: -1,
      phase: 0,
      rot: 0,
      rotSpeed: (Math.random()-0.5)*2,
      isMeteor: true,
      score: { big: 30, med: 15, small: 8, tiny: 5 }[s]
    });
  }

  function spawnPowerup(x, y) {
    powerups.push({ x, y, vy: 80, type: 'gun' });
  }

  function explode(x, y, scale = 1) {
    explosions.push({ x, y, t: 0, dur: 0.5, scale });
  }

  function fireBullets() {
    const offsets = powerLevel === 1 ? [[0, 0]] :
                    powerLevel === 2 ? [[-12, 0], [12, 0]] :
                                       [[-18, 4], [0, -2], [18, 4]];
    for (const [dx, dy] of offsets) {
      bullets.push({ x: player.x + dx, y: player.y - 30 + dy, vy: -680, w: 12, h: 32, sprite: 'laserBlue01', from: 'player', damage: 1 });
    }
    // 简易音效（WebAudio 啁啾）
    beep(880, 0.06, 'square', 0.05);
  }

  // 简易音效
  let audioCtx;
  function beep(freq, dur, type='sine', vol=0.05) {
    try {
      audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = vol;
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      o.connect(g); g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + dur);
    } catch (e) {}
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function update(dt) {
    // 背景星
    for (const s of stars) {
      s.y += s.v * dt;
      if (s.y > H) { s.y = 0; s.x = Math.random()*W; }
    }
    if (state.over) return;

    // 玩家移动
    let dx = 0, dy = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) dx -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
    if (keys['ArrowUp'] || keys['KeyW']) dy -= 1;
    if (keys['ArrowDown'] || keys['KeyS']) dy += 1;
    if (pointer) {
      const tx = pointer.x, ty = pointer.y;
      const ddx = tx - player.x, ddy = ty - player.y;
      const d = Math.hypot(ddx, ddy);
      if (d > 4) { dx = ddx / d; dy = ddy / d; }
    }
    const len = Math.hypot(dx, dy) || 1;
    player.x += (dx/len) * player.speed * dt;
    player.y += (dy/len) * player.speed * dt;
    player.x = Math.max(player.w/2, Math.min(W - player.w/2, player.x));
    player.y = Math.max(player.h/2, Math.min(H - player.h/2, player.y));

    // 自动射击
    player.cool -= dt;
    if (keys['Space'] || keys['KeyZ'] || keys['KeyJ'] || pointer) {
      if (player.cool <= 0) { fireBullets(); player.cool = 0.18; }
    } else if (player.cool <= 0) {
      // 自动连发
      fireBullets(); player.cool = 0.18;
    }

    if (player.invuln > 0) player.invuln -= dt;
    if (powerTimer > 0) {
      powerTimer -= dt;
      if (powerTimer <= 0) powerLevel = 1;
    }

    // 子弹
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y += b.vy * dt;
      if (b.y < -50 || b.y > H+50) bullets.splice(i, 1);
    }
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      b.y += b.vy * dt;
      b.x += (b.vx||0) * dt;
      if (b.y > H+50 || b.y < -50 || b.x < -50 || b.x > W+50) enemyBullets.splice(i, 1);
    }

    // 敌人 spawn
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.waveEnemiesLeft > 0) {
      if (Math.random() < 0.3) spawnMeteor(); else spawnEnemy();
      state.spawnTimer = 0.6 + Math.random()*0.6 - Math.min(0.4, state.wave*0.03);
    }
    // 波次推进
    if (state.waveEnemiesLeft <= 0 && enemies.length === 0) {
      state.wave++;
      state.waveEnemies = 6 + state.wave*2;
      state.waveEnemiesLeft = state.waveEnemies;
      updateHUD();
    }

    // 敌人更新
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.y += e.vy * dt;
      if (e.isMeteor) {
        e.x += e.vx * dt;
        e.rot += e.rotSpeed * dt;
        if (e.x < -50 || e.x > W+50) { enemies.splice(i, 1); continue; }
      } else if (e.pattern > 0.5) {
        e.phase += dt*2;
        e.x += Math.sin(e.phase) * 80 * dt;
      }
      if (!e.isMeteor) {
        e.lastShoot += dt;
        if (e.lastShoot > e.shootCool && e.y > 30 && e.y < H-200) {
          e.lastShoot = 0;
          const ddx = player.x - e.x, ddy = player.y - e.y;
          const d = Math.hypot(ddx, ddy);
          const sp = 240;
          enemyBullets.push({
            x: e.x, y: e.y + 20, vx: (ddx/d)*sp*0.4, vy: Math.max(180, (ddy/d)*sp),
            w: 12, h: 30, sprite: 'laserRed01'
          });
        }
      }
      if (e.y > H + 80) enemies.splice(i, 1);
    }

    // 道具
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += p.vy * dt;
      if (p.y > H + 30) { powerups.splice(i, 1); continue; }
      // 拾取
      if (Math.abs(p.x - player.x) < 28 && Math.abs(p.y - player.y) < 36) {
        powerLevel = Math.min(3, powerLevel + 1);
        powerTimer = 12;
        powerups.splice(i, 1);
        beep(1320, 0.15, 'triangle', 0.08);
      }
    }

    // 碰撞：玩家子弹 vs 敌人
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (Math.abs(b.x - e.x) < e.w*0.4 && Math.abs(b.y - e.y) < e.h*0.45) {
          e.hp -= b.damage;
          bullets.splice(i, 1);
          if (e.hp <= 0) {
            state.score += e.score;
            explode(e.x, e.y, e.w/60);
            beep(220 + Math.random()*80, 0.18, 'sawtooth', 0.07);
            if (!e.isMeteor && Math.random() < 0.12) spawnPowerup(e.x, e.y);
            enemies.splice(j, 1);
            updateHUD();
          } else {
            beep(660, 0.04, 'square', 0.03);
          }
          break;
        }
      }
    }

    // 敌人子弹 vs 玩家
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      if (Math.abs(b.x - player.x) < player.w*0.35 && Math.abs(b.y - player.y) < player.h*0.4) {
        enemyBullets.splice(i, 1);
        hurtPlayer();
      }
    }
    // 敌人 vs 玩家
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (Math.abs(e.x - player.x) < (e.w + player.w)*0.35 && Math.abs(e.y - player.y) < (e.h + player.h)*0.35) {
        explode(e.x, e.y, e.w/60);
        enemies.splice(i, 1);
        hurtPlayer();
      }
    }

    // 爆炸
    for (let i = explosions.length - 1; i >= 0; i--) {
      const ex = explosions[i];
      ex.t += dt;
      if (ex.t >= ex.dur) explosions.splice(i, 1);
    }
  }

  function hurtPlayer() {
    if (player.invuln > 0) return;
    state.life--;
    player.invuln = 1.5;
    beep(120, 0.25, 'sawtooth', 0.1);
    explode(player.x, player.y, 1.4);
    powerLevel = 1;
    updateHUD();
    if (state.life <= 0) {
      state.over = true;
      showGameOver();
    }
  }

  function showGameOver() {
    // 简单的 DOM overlay
    const old = document.querySelector('.overlay-screen');
    if (old) old.remove();
    const screen = document.createElement('div');
    screen.className = 'overlay-screen';
    screen.innerHTML = `
      <div class="overlay-card">
        <h1>任务结束</h1>
        <p>最终得分: <b style="color:var(--accent)">${state.score}</b> · 抵达波次 ${state.wave}</p>
        <p>按空格 / 点击屏幕 重新开始</p>
        <button class="btn" id="btn-restart">再来一局</button>
      </div>`;
    document.body.appendChild(screen);
    screen.querySelector('#btn-restart').addEventListener('click', () => { screen.remove(); restart(); });
  }

  function render() {
    ctx.fillStyle = '#04050d';
    ctx.fillRect(0, 0, W, H);

    // 背景星
    ctx.fillStyle = '#fff';
    for (const s of stars) {
      ctx.globalAlpha = 0.4 + s.s/3;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    // 道具
    for (const p of powerups) {
      drawSprite(ctx, atlas, 'powerupBlue_bolt', p.x, p.y, 36, 36);
    }

    // 玩家子弹
    for (const b of bullets) drawSprite(ctx, atlas, b.sprite, b.x, b.y, b.w, b.h);
    // 敌人子弹
    for (const b of enemyBullets) drawSprite(ctx, atlas, b.sprite, b.x, b.y, b.w, b.h);

    // 敌人
    for (const e of enemies) {
      drawSprite(ctx, atlas, e.sprite, e.x, e.y, e.w, e.h, e.isMeteor ? { rotation: e.rot } : { rotation: Math.PI });
    }

    // 玩家（无敌闪烁）
    if (!state.over) {
      const flash = player.invuln > 0 ? (Math.floor(player.invuln * 12) % 2 === 0) : false;
      if (!flash) drawSprite(ctx, atlas, player.sprite, player.x, player.y, player.w, player.h);
      // 火焰
      drawSprite(ctx, atlas, 'fire17', player.x, player.y + 36 + Math.sin(performance.now()/40)*2, 16, 28);
    }

    // 爆炸：用碎片粒子模拟
    for (const ex of explosions) {
      const t = ex.t / ex.dur;
      const r = 8 + 40 * t * ex.scale;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = `hsl(${30 + t*30}, 100%, ${70 - t*40}%)`;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, r, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = (1-t)*0.5;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, r*0.4, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    // 武器等级提示
    if (powerLevel > 1 && powerTimer > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(90, 242, 255, ${0.6 + 0.4*Math.sin(performance.now()/200)})`;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`武器 Lv${powerLevel} · ${powerTimer.toFixed(1)}s`, W/2, H - 14);
      ctx.restore();
    }
  }
}
