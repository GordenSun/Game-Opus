// 通用游戏壳：提供顶栏（返回首页、标题）、加载界面、覆盖层 等
import { ProgressTracker } from './atlas.js';

export function mountShell(title) {
  document.body.classList.add('has-shell');
  const topbar = document.createElement('div');
  topbar.className = 'topbar';
  topbar.innerHTML = `
    <a href="../../index.html" title="返回首页">← 返回</a>
    <div class="title">${title}</div>
    <button type="button" id="btn-fullscreen" title="全屏">⤢ 全屏</button>
  `;
  document.body.appendChild(topbar);

  document.getElementById('btn-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  });
}

export function mountLoader(title) {
  const overlay = document.createElement('div');
  overlay.className = 'loader-overlay';
  overlay.innerHTML = `
    <div class="loader-card">
      <div class="loader-title">${title}</div>
      <div class="loader-track"><div class="loader-bar" id="loader-bar"></div></div>
      <div class="loader-text" id="loader-text">加载中... 0%</div>
    </div>
  `;
  document.body.appendChild(overlay);

  const tracker = new ProgressTracker(
    overlay.querySelector('#loader-bar'),
    overlay.querySelector('#loader-text')
  );
  return {
    tracker,
    hide() {
      tracker.done();
      setTimeout(() => {
        overlay.classList.add('hidden');
        setTimeout(() => overlay.remove(), 400);
      }, 200);
    }
  };
}

// 让 canvas 自适应视口同时保持比例
export function fitCanvas(canvas, designW, designH) {
  function resize() {
    const pad = 16;
    const aw = window.innerWidth - pad * 2;
    const ah = window.innerHeight - pad * 2;
    const ratio = designW / designH;
    let w = aw, h = aw / ratio;
    if (h > ah) { h = ah; w = ah * ratio; }
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }
  window.addEventListener('resize', resize);
  resize();
}
