// 动物记忆翻牌
import { loadAtlas, drawSprite } from '../../shared/atlas.js';
import { mountShell, mountLoader } from '../../shared/game-shell.js';

mountShell('🐯 动物记忆');
const loader = mountLoader('🐯 动物记忆');

const ATLAS_PNG = '../../assets/animals/round.png';
const ATLAS_XML = '../../assets/animals/round.xml';
loader.tracker.register(ATLAS_PNG, 75497);
loader.tracker.register(ATLAS_XML, 2233);

(async () => {
  const atlas = await loadAtlas(ATLAS_PNG, ATLAS_XML, p => loader.tracker.update(p));
  loader.hide();
  start(atlas);
})();

function start(atlas) {
  const ANIMALS = Object.keys(atlas.frames).slice().sort();
  const board = document.getElementById('board');
  const statMoves = document.getElementById('stat-moves');
  const statMatches = document.getElementById('stat-matches');
  const statTotal = document.getElementById('stat-total');
  const statTime = document.getElementById('stat-time');

  const DIFFICULTY = {
    easy:   { cols: 4, rows: 3 },
    medium: { cols: 6, rows: 4 },
    hard:   { cols: 6, rows: 6 }
  };
  let mode = 'easy';
  let cards = [];
  let flipped = [];
  let moves = 0, matches = 0, total = 0;
  let canFlip = true;
  let startTime = 0;
  let timerId = null;
  let audioCtx;

  function beep(freq, dur, type='sine', vol=0.06) {
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

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function setupBoard() {
    const { cols, rows } = DIFFICULTY[mode];
    const pairs = (cols * rows) / 2;
    total = pairs;
    statTotal.textContent = total;
    statMatches.textContent = '0';
    statMoves.textContent = '0';
    statTime.textContent = '0:00';
    moves = 0; matches = 0; flipped = []; canFlip = true;
    startTime = performance.now();
    if (timerId) clearInterval(timerId);
    timerId = setInterval(updateTimer, 500);

    const picks = shuffle(ANIMALS.slice()).slice(0, pairs);
    const deck = shuffle([...picks, ...picks]);

    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    const maxW = Math.min(900, window.innerWidth - 32);
    const cardSize = Math.min(120, Math.floor((maxW - (cols-1) * 10) / cols));
    board.style.width = (cardSize * cols + (cols-1) * 10) + 'px';

    cards = deck.map((animal, i) => {
      const el = document.createElement('div');
      el.className = 'card';
      el.style.width = cardSize + 'px';
      el.innerHTML = `
        <div class="face front">?</div>
        <div class="face back"><canvas width="80" height="80"></canvas></div>
      `;
      const cv = el.querySelector('canvas');
      const cx = cv.getContext('2d');
      drawSprite(cx, atlas, animal, 40, 40, 80, 80);

      el.addEventListener('click', () => onFlip(i));
      board.appendChild(el);
      return { el, animal, flipped: false, matched: false };
    });
  }

  function onFlip(i) {
    if (!canFlip) return;
    const c = cards[i];
    if (c.flipped || c.matched) return;
    c.flipped = true;
    c.el.classList.add('flipped');
    beep(660 + i * 20, 0.08, 'sine', 0.04);
    flipped.push(i);
    if (flipped.length === 2) {
      moves++;
      statMoves.textContent = moves;
      const [a, b] = flipped;
      if (cards[a].animal === cards[b].animal) {
        cards[a].matched = cards[b].matched = true;
        cards[a].el.classList.add('matched');
        cards[b].el.classList.add('matched');
        flipped = [];
        matches++;
        statMatches.textContent = matches;
        beep(1200, 0.15, 'triangle', 0.08);
        if (matches === total) finish();
      } else {
        canFlip = false;
        setTimeout(() => {
          cards[a].flipped = cards[b].flipped = false;
          cards[a].el.classList.remove('flipped');
          cards[b].el.classList.remove('flipped');
          flipped = [];
          canFlip = true;
          beep(200, 0.1, 'sawtooth', 0.04);
        }, 800);
      }
    }
  }

  function updateTimer() {
    const s = Math.floor((performance.now() - startTime) / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    statTime.textContent = `${m}:${r.toString().padStart(2,'0')}`;
  }

  function finish() {
    clearInterval(timerId);
    const t = Math.floor((performance.now() - startTime) / 1000);
    const m = Math.floor(t / 60), r = t % 60;
    const screen = document.createElement('div');
    screen.className = 'overlay-screen';
    screen.innerHTML = `
      <div class="overlay-card">
        <h1>全部配对完成 🎉</h1>
        <p>难度：${ {easy:'简单',medium:'普通',hard:'困难'}[mode] }</p>
        <p>步数：<b style="color:var(--accent)">${moves}</b> · 用时 ${m}:${r.toString().padStart(2,'0')}</p>
        <button class="btn" id="btn-again">再玩一次</button>
      </div>`;
    document.body.appendChild(screen);
    screen.querySelector('#btn-again').addEventListener('click', () => { screen.remove(); setupBoard(); });
  }

  document.querySelectorAll('.difficulty button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.difficulty button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mode = btn.dataset.d;
      setupBoard();
    });
  });

  // 只调整尺寸不重置游戏
  function resizeCards() {
    const { cols } = DIFFICULTY[mode];
    const maxW = Math.min(900, window.innerWidth - 32);
    const cardSize = Math.min(120, Math.floor((maxW - (cols-1) * 10) / cols));
    board.style.width = (cardSize * cols + (cols-1) * 10) + 'px';
    cards.forEach(c => c.el.style.width = cardSize + 'px');
  }
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeCards, 100);
  });
  setupBoard();
}
