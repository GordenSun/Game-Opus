// Tappy Plane: Flappy 风格闪避
import { loadAtlas, drawSprite } from '../../shared/atlas.js';
import { mountShell, mountLoader, fitCanvas } from '../../shared/game-shell.js';

mountShell('✈️ Tappy Plane');
const loader = mountLoader('✈️ Tappy Plane');

const W = 540, H = 800;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
fitCanvas(canvas, W, H);

const hudScore = document.getElementById('hud-score');
const hudBest = document.getElementById('hud-best');

const ATLAS_PNG = '../../assets/tappy-plane/sheet.png';
const ATLAS_XML = '../../assets/tappy-plane/sheet.xml';
loader.tracker.register(ATLAS_PNG, 252033);
loader.tracker.register(ATLAS_XML, 5987);

(async () => {
  const atlas = await loadAtlas(ATLAS_PNG, ATLAS_XML, p => loader.tracker.update(p));
  loader.hide();
  start(atlas);
})();

function start(atlas) {
  const themes = [
    { ground: 'groundGrass', rockUp: 'rockGrass', rockDown: 'rockGrassDown', plane: 'planeBlue', sky: ['#5fc4ff', '#bde7ff'] },
    { ground: 'groundIce', rockUp: 'rockIce', rockDown: 'rockIceDown', plane: 'planeYellow', sky: ['#a3d8ff', '#e8f5ff'] },
    { ground: 'groundSnow', rockUp: 'rockSnow', rockDown: 'rockSnowDown', plane: 'planeRed', sky: ['#7fafd1', '#cfe4f5'] },
    { ground: 'groundDirt', rockUp: 'rock', rockDown: 'rockDown', plane: 'planeGreen', sky: ['#ffb27a', '#ffe9c8'] }
  ];
  let theme = themes[Math.floor(Math.random() * themes.length)];

  // 背景云
  const clouds = [];
  for (let i = 0; i < 6; i++) {
    clouds.push({ x: Math.random()*W, y: 80 + Math.random()*(H-300), w: 100 + Math.random()*120, alpha: 0.4 + Math.random()*0.4 });
  }

  const GROUND_H = 71;
  const ROCK_W = 108, ROCK_H = 239;
  const GAP_BASE = 230;

  const state = {
    started: false,
    over: false,
    score: 0,
    best: +localStorage.getItem('tappy_best') || 0,
    speed: 200,
    spawnTimer: 0,
    groundOffset: 0
  };

  const plane = {
    x: W * 0.3, y: H/2,
    vy: 0,
    g: 1500,
    flap: -500,
    frame: 0,
    frameT: 0,
    rotation: 0,
    radius: 28
  };

  const pipes = [];
  const stars = []; // 收集物
  const puffs = [];

  function reset() {
    state.started = false;
    state.over = false;
    state.score = 0;
    state.speed = 200;
    state.spawnTimer = 0;
    pipes.length = 0; stars.length = 0; puffs.length = 0;
    plane.x = W*0.3; plane.y = H/2; plane.vy = 0; plane.rotation = 0;
    theme = themes[Math.floor(Math.random() * themes.length)];
    updateHUD();
  }
  function updateHUD() {
    hudScore.textContent = state.score;
    hudBest.textContent = state.best;
  }
  hudBest.textContent = state.best;
  updateHUD();

  function flap() {
    if (state.over) { reset(); return; }
    state.started = true;
    plane.vy = plane.flap;
    puffs.push({ x: plane.x - 24, y: plane.y + 10, t: 0, dur: 0.4, big: false });
    beep(660, 0.08, 'sine', 0.06);
  }

  window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') flap();
  });
  canvas.addEventListener('pointerdown', flap);

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
    } catch(e) {}
  }

  function spawnPipe() {
    const gap = Math.max(180, GAP_BASE - state.score * 1.2);
    const minTop = 60;
    const maxTop = H - GROUND_H - gap - 60;
    const topY = minTop + Math.random() * (maxTop - minTop);
    pipes.push({ x: W + 60, topY, gap, passed: false });
    // 中间偶尔放星星
    if (Math.random() < 0.55) {
      const colors = ['starBronze','starSilver','starGold'];
      const s = colors[Math.min(2, Math.floor(Math.random()*colors.length + state.score/30))];
      stars.push({ x: W + 60 + ROCK_W/2, y: topY + gap/2, sprite: s, val: s === 'starGold' ? 5 : s === 'starSilver' ? 3 : 1 });
    }
  }

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
    plane.frameT += dt;
    if (plane.frameT > 0.07) { plane.frame = (plane.frame + 1) % 3; plane.frameT = 0; }

    if (!state.started || state.over) {
      // 缓慢摆动
      plane.y += Math.sin(performance.now()/300) * 0.6;
      // 地面移动
      state.groundOffset = (state.groundOffset + dt * 100) % 108;
      return;
    }

    // 物理
    plane.vy += plane.g * dt;
    plane.y += plane.vy * dt;
    plane.rotation = Math.max(-0.4, Math.min(1.1, plane.vy / 600));

    // pipes 移动
    state.speed = Math.min(380, 200 + state.score * 3);
    for (const p of pipes) p.x -= state.speed * dt;
    for (const s of stars) s.x -= state.speed * dt;
    state.groundOffset = (state.groundOffset + dt * state.speed) % 108;
    for (const c of clouds) {
      c.x -= state.speed * 0.3 * dt;
      if (c.x + c.w < 0) { c.x = W + 80; c.y = 60 + Math.random()*(H-300); }
    }

    // 移除离屏并计分
    for (let i = pipes.length - 1; i >= 0; i--) {
      const p = pipes[i];
      if (!p.passed && p.x + ROCK_W < plane.x) {
        p.passed = true;
        state.score++;
        beep(880, 0.08, 'triangle', 0.05);
        updateHUD();
      }
      if (p.x < -ROCK_W) pipes.splice(i, 1);
    }
    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      if (Math.hypot(s.x - plane.x, s.y - plane.y) < 30) {
        state.score += s.val;
        beep(1200, 0.12, 'triangle', 0.07);
        stars.splice(i, 1);
        updateHUD();
        continue;
      }
      if (s.x < -30) stars.splice(i, 1);
    }

    // spawn
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnPipe();
      state.spawnTimer = (ROCK_W + 200) / state.speed;
    }

    // 碰撞
    if (plane.y + plane.radius > H - GROUND_H || plane.y - plane.radius < 0) {
      die();
    } else {
      for (const p of pipes) {
        // 上柱: x..x+ROCK_W, y: topY-ROCK_H..topY
        if (plane.x + plane.radius > p.x && plane.x - plane.radius < p.x + ROCK_W) {
          if (plane.y - plane.radius < p.topY || plane.y + plane.radius > p.topY + p.gap) {
            die();
            break;
          }
        }
      }
    }

    // puffs
    for (let i = puffs.length - 1; i >= 0; i--) { puffs[i].t += dt; if (puffs[i].t >= puffs[i].dur) puffs.splice(i, 1); }
  }

  function die() {
    if (state.over) return;
    state.over = true;
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem('tappy_best', state.best);
    }
    beep(140, 0.4, 'sawtooth', 0.1);
    showOver();
  }

  function showOver() {
    const old = document.querySelector('.overlay-screen');
    if (old) old.remove();
    let medal = '';
    if (state.score >= 30) medal = 'medalGold';
    else if (state.score >= 15) medal = 'medalSilver';
    else if (state.score >= 5) medal = 'medalBronze';
    const screen = document.createElement('div');
    screen.className = 'overlay-screen';
    screen.innerHTML = `
      <div class="overlay-card">
        <h1>坠机了</h1>
        ${medal ? `<canvas id="medal-canvas" width="80" height="80"></canvas>` : ''}
        <p>得分: <b style="color:var(--accent)">${state.score}</b> · 最佳 ${state.best}</p>
        <p>点击屏幕 / 空格 重新开始</p>
        <button class="btn" id="btn-restart">再来一局</button>
      </div>`;
    document.body.appendChild(screen);
    if (medal) {
      const c = screen.querySelector('#medal-canvas');
      const cx = c.getContext('2d');
      drawSprite(cx, atlas, medal, 40, 40, 80, 80);
    }
    screen.querySelector('#btn-restart').addEventListener('click', () => { screen.remove(); reset(); });
  }

  function render() {
    // 天空渐变
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, theme.sky[0]); g.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 云朵：简单白色椭圆模拟
    for (const c of clouds) {
      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(c.x + c.w/2, c.y, c.w/2, c.w/4, 0, 0, Math.PI*2);
      ctx.ellipse(c.x + c.w/2 - c.w/4, c.y + 8, c.w/3, c.w/5, 0, 0, Math.PI*2);
      ctx.ellipse(c.x + c.w/2 + c.w/4, c.y + 8, c.w/3.5, c.w/5, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    // pipes
    for (const p of pipes) {
      drawSprite(ctx, atlas, theme.rockDown, p.x + ROCK_W/2, p.topY - ROCK_H/2 + ROCK_H, ROCK_W, ROCK_H);
      drawSprite(ctx, atlas, theme.rockUp, p.x + ROCK_W/2, p.topY + p.gap + ROCK_H/2, ROCK_W, ROCK_H);
    }

    // stars
    for (const s of stars) {
      drawSprite(ctx, atlas, s.sprite, s.x, s.y + Math.sin(performance.now()/200 + s.x)*4, 36, 36);
    }

    // 地面
    const gf = atlas.frames[theme.ground];
    if (gf) {
      for (let x = -state.groundOffset; x < W; x += gf.w) {
        ctx.drawImage(atlas.image, gf.x, gf.y, gf.w, gf.h, x, H - GROUND_H, gf.w, GROUND_H);
      }
    }

    // puffs
    for (const p of puffs) {
      const t = p.t/p.dur;
      drawSprite(ctx, atlas, 'puffSmall', p.x - t*50, p.y, 24*(1+t), 24*(1+t), { alpha: 1-t });
    }

    // plane
    drawSprite(ctx, atlas, `${theme.plane}${(plane.frame % 3) + 1}`, plane.x, plane.y, 88, 73, { rotation: plane.rotation });

    // start hint
    if (!state.started && !state.over) {
      ctx.save();
      ctx.globalAlpha = 0.7 + Math.sin(performance.now()/300)*0.3;
      drawSprite(ctx, atlas, 'tap', W/2, H/2 + 90, 100, 100);
      ctx.restore();
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 24px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText('点击屏幕 / 空格 起飞', W/2, H/2 + 200);
      ctx.fillStyle = '#fff';
      ctx.fillText('点击屏幕 / 空格 起飞', W/2, H/2 + 200);
      ctx.restore();
    }
  }
}
