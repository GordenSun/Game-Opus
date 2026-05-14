// 坦克竞技场：俯视角 8 方向移动 + 鼠标瞄准
import { loadAtlas, drawSprite } from '../../shared/atlas.js';
import { mountShell, mountLoader, fitCanvas } from '../../shared/game-shell.js';

mountShell('💥 坦克竞技场');
const loader = mountLoader('💥 坦克竞技场');

const W = 800, H = 640;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
fitCanvas(canvas, W, H);

const hudScore = document.getElementById('hud-score');
const hudLife = document.getElementById('hud-life');
const hudKill = document.getElementById('hud-kill');

const ATLAS_PNG = '../../assets/topdown-tanks/sheet.png';
const ATLAS_XML = '../../assets/topdown-tanks/sheet.xml';
loader.tracker.register(ATLAS_PNG, 74264);
loader.tracker.register(ATLAS_XML, 6867);

(async () => {
  const atlas = await loadAtlas(ATLAS_PNG, ATLAS_XML, p => loader.tracker.update(p));
  loader.hide();
  start(atlas);
})();

// Kenney 的 tank/barrel sprite 默认朝向：朝上（barrelXXX_up 在精灵图中也是朝上方向）
// 我们让 0 弧度 = 朝右(+X)，绘制时用 angle + PI/2 校正成「朝下默认」
// 实际坦克车身和炮管 source 朝上(-Y)，所以 ctx 旋转角度需要 +PI/2 让它「朝0弧度方向」

function start(atlas) {
  const TILE = 64;
  const grassPattern = makeGroundPattern();

  function makeGroundPattern() {
    const c = document.createElement('canvas');
    c.width = TILE * 4; c.height = TILE * 4;
    const cx = c.getContext('2d');
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const f = ['grass','grass','grass','sand','dirt'][Math.floor(Math.random()*5)];
      const fr = atlas.frames[f];
      if (fr) cx.drawImage(atlas.image, fr.x, fr.y, fr.w, fr.h, x*TILE, y*TILE, TILE, TILE);
      else { cx.fillStyle = '#3a5232'; cx.fillRect(x*TILE, y*TILE, TILE, TILE); }
    }
    return ctx.createPattern(c, 'repeat');
  }

  // 障碍物（沙袋、树）
  const obstacles = [];
  function farFromPlayerStart(x, y) {
    return Math.hypot(x - W/2, y - H/2) > 110;
  }
  function genObstacles() {
    obstacles.length = 0;
    let tries = 0;
    while (obstacles.length < 12 && tries < 200) {
      tries++;
      const x = 80 + Math.random()*(W-160);
      const y = 80 + Math.random()*(H-160);
      if (!farFromPlayerStart(x, y)) continue;
      obstacles.push({ x, y, w: 40, h: 40, sprite: Math.random() < 0.5 ? 'sandbagBeige' : 'sandbagBrown', destructible: true, hp: 2 });
    }
    tries = 0;
    let trees = 0;
    while (trees < 5 && tries < 200) {
      tries++;
      const big = Math.random() < 0.5;
      const x = 80 + Math.random()*(W-160);
      const y = 80 + Math.random()*(H-160);
      if (!farFromPlayerStart(x, y)) continue;
      obstacles.push({ x, y, w: big?70:46, h: big?70:46, sprite: big?'treeLarge':'treeSmall', destructible: false });
      trees++;
    }
  }
  genObstacles();

  // 履带涂鸦层
  const tracksCanvas = document.createElement('canvas');
  tracksCanvas.width = W; tracksCanvas.height = H;
  const tctx = tracksCanvas.getContext('2d');

  const state = {
    score: 0, life: 5, kills: 0,
    over: false,
    spawnTimer: 0,
    enemiesAlive: 0,
    maxEnemies: 4
  };

  const player = {
    x: W/2, y: H/2, w: 44, h: 56,
    bodyAngle: 0, // 朝向（弧度，0=朝右，PI/2=朝下）
    turretAngle: 0,
    speed: 180,
    fireCool: 0,
    fireDelay: 0.4,
    invuln: 1.5,
    color: 'Blue',
    lastTrack: 0
  };

  const enemies = [];
  const bullets = [];
  const explosions = [];
  const smokes = [];

  // 输入
  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (state.over && (e.code === 'Space' || e.code === 'Enter')) restart();
  });
  window.addEventListener('keyup', e => keys[e.code] = false);

  let mouse = { x: W/2, y: H/2 - 50, down: false };
  function ev2canvas(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - rect.left) * (W / rect.width), y: (t.clientY - rect.top) * (H / rect.height) };
  }
  canvas.addEventListener('pointermove', e => { const p = ev2canvas(e); mouse.x = p.x; mouse.y = p.y; });
  canvas.addEventListener('pointerdown', e => { mouse.down = true; const p = ev2canvas(e); mouse.x = p.x; mouse.y = p.y; if (state.over) restart(); });
  canvas.addEventListener('pointerup', () => mouse.down = false);
  canvas.addEventListener('pointercancel', () => mouse.down = false);

  function restart() {
    state.score = 0; state.life = 5; state.kills = 0; state.over = false; state.spawnTimer = 0; state.maxEnemies = 4;
    enemies.length = 0; bullets.length = 0; explosions.length = 0; smokes.length = 0;
    player.x = W/2; player.y = H/2; player.invuln = 1.5; player.bodyAngle = 0;
    tctx.clearRect(0, 0, W, H);
    genObstacles();
    updateHUD();
  }
  function updateHUD() {
    hudScore.textContent = state.score;
    hudLife.textContent = state.life;
    hudKill.textContent = state.kills;
  }
  updateHUD();

  function spawnEnemy() {
    if (state.enemiesAlive >= state.maxEnemies) return;
    state.enemiesAlive++;
    const colors = ['Red','Green','Black'];
    const c = colors[Math.floor(Math.random()*colors.length)];
    // 在边缘出生
    const side = Math.floor(Math.random()*4);
    let x, y;
    if (side === 0) { x = 30; y = Math.random()*H; }
    else if (side === 1) { x = W-30; y = Math.random()*H; }
    else if (side === 2) { x = Math.random()*W; y = 30; }
    else { x = Math.random()*W; y = H-30; }
    enemies.push({
      x, y, w: 44, h: 56,
      bodyAngle: Math.random()*Math.PI*2,
      turretAngle: 0,
      speed: 70 + Math.random()*40,
      fireCool: 1 + Math.random()*2,
      fireDelay: 1.4,
      hp: 2,
      color: c,
      goal: pickGoal(),
      lastTrack: 0
    });
  }
  function pickGoal() {
    return { x: 60 + Math.random()*(W-120), y: 60 + Math.random()*(H-120) };
  }

  // 圆形碰撞
  function circleHit(a, b, ra, rb) {
    return Math.hypot(a.x - b.x, a.y - b.y) < ra + rb;
  }
  function rectHit(b, o) {
    return b.x > o.x - o.w/2 && b.x < o.x + o.w/2 && b.y > o.y - o.h/2 && b.y < o.y + o.h/2;
  }
  function obstacleCollide(nx, ny, w, h) {
    // tank vs rect obstacles
    for (const o of obstacles) {
      const dx = nx - o.x, dy = ny - o.y;
      const ow = (o.w + w*0.7)/2, oh = (o.h + h*0.7)/2;
      if (Math.abs(dx) < ow && Math.abs(dy) < oh) return true;
    }
    return false;
  }

  function fireFrom(t, isPlayer) {
    const sp = 360;
    const ang = t.turretAngle;
    bullets.push({
      x: t.x + Math.cos(ang) * 30,
      y: t.y + Math.sin(ang) * 30,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      sprite: isPlayer ? 'bulletBlue' : 'bulletRed',
      angle: ang,
      owner: isPlayer ? 'p' : 'e',
      life: 1.8
    });
    beep(isPlayer ? 720 : 320, 0.06, 'square', 0.05);
    // 后坐力
    smokes.push({ x: t.x + Math.cos(ang)*22, y: t.y + Math.sin(ang)*22, t: 0, dur: 0.4, scale: 0.6 });
  }

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

  // 主循环
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last)/1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function update(dt) {
    if (state.over) return;
    // 玩家移动
    let dx = 0, dy = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) dx -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
    if (keys['ArrowUp'] || keys['KeyW']) dy -= 1;
    if (keys['ArrowDown'] || keys['KeyS']) dy += 1;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len; dy /= len;
      const nx = player.x + dx * player.speed * dt;
      const ny = player.y + dy * player.speed * dt;
      let cx = player.x, cy = player.y;
      if (!obstacleCollide(nx, player.y, player.w, player.h)) cx = nx;
      if (!obstacleCollide(cx, ny, player.w, player.h)) cy = ny;
      cx = Math.max(player.w/2, Math.min(W - player.w/2, cx));
      cy = Math.max(player.h/2, Math.min(H - player.h/2, cy));
      // 履带
      if (cx !== player.x || cy !== player.y) {
        player.lastTrack += dt;
        if (player.lastTrack > 0.05) {
          drawTrack(player.x, player.y, player.bodyAngle);
          player.lastTrack = 0;
        }
        player.bodyAngle = Math.atan2(dy, dx);
      }
      player.x = cx; player.y = cy;
    }
    // 炮塔
    player.turretAngle = Math.atan2(mouse.y - player.y, mouse.x - player.x);

    // 射击
    player.fireCool -= dt;
    if ((mouse.down || keys['Space']) && player.fireCool <= 0) {
      fireFrom(player, true);
      player.fireCool = player.fireDelay;
    }
    if (player.invuln > 0) player.invuln -= dt;

    // 敌人 AI
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnEnemy();
      state.spawnTimer = 1.0 + Math.random() * 1.5;
    }
    state.enemiesAlive = enemies.length;
    state.maxEnemies = Math.min(8, 4 + Math.floor(state.kills / 5));

    for (const e of enemies) {
      // 向目标移动；若被挡住则换目标
      let tx = e.goal.x - e.x, ty = e.goal.y - e.y;
      const d = Math.hypot(tx, ty);
      if (d < 30) e.goal = pickGoal();
      else {
        tx /= d; ty /= d;
        const nx = e.x + tx * e.speed * dt;
        const ny = e.y + ty * e.speed * dt;
        let blocked = false;
        if (obstacleCollide(nx, ny, e.w, e.h)) { blocked = true; e.goal = pickGoal(); }
        else {
          if (Math.abs(nx - player.x) < (e.w + player.w)*0.45 && Math.abs(ny - player.y) < (e.h + player.h)*0.45) blocked = true;
          else {
            e.lastTrack = (e.lastTrack||0) + dt;
            if (e.lastTrack > 0.06) { drawTrack(e.x, e.y, e.bodyAngle); e.lastTrack = 0; }
            e.bodyAngle = Math.atan2(ty, tx);
            e.x = nx; e.y = ny;
          }
        }
        if (blocked) e.goal = pickGoal();
      }
      // 瞄准玩家
      const ta = Math.atan2(player.y - e.y, player.x - e.x);
      let diff = ((ta - e.turretAngle + Math.PI*3) % (Math.PI*2)) - Math.PI;
      e.turretAngle += Math.sign(diff) * Math.min(Math.abs(diff), 2.2 * dt);

      // 射击
      e.fireCool -= dt;
      if (e.fireCool <= 0 && Math.abs(diff) < 0.2 && Math.hypot(player.x - e.x, player.y - e.y) < 380) {
        fireFrom(e, false);
        e.fireCool = e.fireDelay + Math.random() * 0.6;
      }
    }

    // 子弹
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > W || b.y > H) { bullets.splice(i, 1); continue; }
      // 撞障碍
      let hit = false;
      for (let j = obstacles.length - 1; j >= 0; j--) {
        const o = obstacles[j];
        if (rectHit(b, o)) {
          hit = true;
          if (o.destructible) { o.hp--; explode(b.x, b.y, 0.5); if (o.hp <= 0) obstacles.splice(j, 1); }
          else explode(b.x, b.y, 0.4);
          break;
        }
      }
      if (hit) { bullets.splice(i, 1); continue; }
      if (b.owner === 'p') {
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          if (circleHit(b, e, 6, 22)) {
            e.hp--;
            bullets.splice(i, 1);
            explode(b.x, b.y, 0.6);
            if (e.hp <= 0) {
              state.score += 50;
              state.kills++;
              explode(e.x, e.y, 1.3);
              enemies.splice(j, 1);
              updateHUD();
            }
            break;
          }
        }
      } else {
        if (player.invuln <= 0 && circleHit(b, player, 6, 22)) {
          bullets.splice(i, 1);
          hurt();
        }
      }
    }

    // 烟雾/爆炸
    for (let i = smokes.length - 1; i >= 0; i--) {
      const s = smokes[i];
      s.t += dt;
      if (s.t >= s.dur) smokes.splice(i, 1);
    }
    for (let i = explosions.length - 1; i >= 0; i--) {
      const e = explosions[i];
      e.t += dt;
      if (e.t >= e.dur) explosions.splice(i, 1);
    }
  }

  function explode(x, y, scale=1) {
    explosions.push({ x, y, t: 0, dur: 0.55, scale });
    // smoke trail
    for (let i = 0; i < 3*scale; i++) {
      smokes.push({ x: x + (Math.random()-0.5)*20, y: y + (Math.random()-0.5)*20, t: 0, dur: 0.6 + Math.random()*0.5, scale });
    }
  }

  function drawTrack(x, y, ang) {
    tctx.save();
    tctx.translate(x, y);
    tctx.rotate(ang + Math.PI/2);
    tctx.globalAlpha = 0.35;
    const f = atlas.frames['tracksSmall'];
    if (f) tctx.drawImage(atlas.image, f.x, f.y, f.w, f.h, -f.w/4, -f.h/4, f.w/2, f.h/2);
    tctx.restore();
    // 渐淡：每隔一段渲染时间整体 fadeout
  }

  let trackFade = 0;
  function fadeTracks(dt) {
    trackFade += dt;
    if (trackFade > 0.4) {
      tctx.save();
      tctx.globalCompositeOperation = 'destination-out';
      tctx.fillStyle = 'rgba(0,0,0,0.03)';
      tctx.fillRect(0, 0, W, H);
      tctx.restore();
      trackFade = 0;
    }
  }

  function hurt() {
    if (player.invuln > 0) return;
    state.life--;
    player.invuln = 1.5;
    explode(player.x, player.y, 1.2);
    beep(100, 0.3, 'sawtooth', 0.1);
    updateHUD();
    if (state.life <= 0) {
      state.over = true;
      const screen = document.createElement('div');
      screen.className = 'overlay-screen';
      screen.innerHTML = `
        <div class="overlay-card">
          <h1>战车毁了</h1>
          <p>得分: <b style="color:var(--accent)">${state.score}</b> · 击杀 ${state.kills}</p>
          <button class="btn" id="btn-restart">再战一次</button>
        </div>`;
      document.body.appendChild(screen);
      screen.querySelector('#btn-restart').addEventListener('click', () => { screen.remove(); restart(); });
    }
  }

  function drawTank(t, isPlayer) {
    const bodySprite = `tank${t.color}`;
    const barrelSprite = `barrel${t.color}`;
    // body
    drawSprite(ctx, atlas, bodySprite, t.x, t.y, t.w, t.h, { rotation: t.bodyAngle + Math.PI/2 });
    // barrel atop
    const f = atlas.frames[barrelSprite];
    if (f) {
      const bw = 14, bh = 38;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.turretAngle + Math.PI/2);
      ctx.drawImage(atlas.image, f.x, f.y, f.w, f.h, -bw/2, -bh + 8, bw, bh);
      ctx.restore();
    }
  }

  function render() {
    // ground tile
    ctx.fillStyle = grassPattern;
    ctx.fillRect(0, 0, W, H);
    fadeTracks(1/60);
    ctx.drawImage(tracksCanvas, 0, 0);

    // obstacles
    for (const o of obstacles) drawSprite(ctx, atlas, o.sprite, o.x, o.y, o.w, o.h);

    // smokes
    for (const s of smokes) {
      const t = s.t / s.dur;
      const idx = Math.min(5, Math.floor(t * 6));
      drawSprite(ctx, atlas, `smokeGrey${idx}`, s.x, s.y, 40*s.scale*(1+t*0.5), 40*s.scale*(1+t*0.5), { alpha: 1-t });
    }

    // bullets
    for (const b of bullets) {
      drawSprite(ctx, atlas, b.sprite, b.x, b.y, 10, 26, { rotation: b.angle + Math.PI/2 });
    }

    // tanks (enemies first, player on top)
    for (const e of enemies) drawTank(e, false);
    if (!state.over) {
      const flash = player.invuln > 0 ? (Math.floor(player.invuln*12) % 2 === 0) : false;
      if (!flash) drawTank(player, true);
    }

    // explosions
    for (const ex of explosions) {
      const t = ex.t / ex.dur;
      const r = 12 + 45 * t * ex.scale;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      const grad = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, r);
      grad.addColorStop(0, '#fff');
      grad.addColorStop(0.4, '#ffd25a');
      grad.addColorStop(1, 'rgba(255,90,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, r, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    // 准星
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 10, 0, Math.PI*2);
    ctx.moveTo(mouse.x - 16, mouse.y); ctx.lineTo(mouse.x - 6, mouse.y);
    ctx.moveTo(mouse.x + 6, mouse.y); ctx.lineTo(mouse.x + 16, mouse.y);
    ctx.moveTo(mouse.x, mouse.y - 16); ctx.lineTo(mouse.x, mouse.y - 6);
    ctx.moveTo(mouse.x, mouse.y + 6); ctx.lineTo(mouse.x, mouse.y + 16);
    ctx.stroke();
    ctx.restore();
  }
}
