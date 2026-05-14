// Kenney TextureAtlas XML 解析器 + 加载工具
// 支持显示加载进度，配合 shared/loader.css 一起使用

export async function loadAtlas(pngUrl, xmlUrl, onProgress) {
  const [imgBlob, xmlText] = await Promise.all([
    fetchWithProgress(pngUrl, onProgress, 'png'),
    fetchWithProgress(xmlUrl, onProgress, 'xml').then(b => b.text())
  ]);

  const image = await blobToImage(imgBlob);
  const frames = parseAtlasXml(xmlText);
  return { image, frames };
}

function parseAtlasXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const subs = doc.getElementsByTagName('SubTexture');
  const frames = {};
  for (const s of subs) {
    const name = s.getAttribute('name').replace(/\.png$/i, '');
    frames[name] = {
      x: +s.getAttribute('x'),
      y: +s.getAttribute('y'),
      w: +s.getAttribute('width'),
      h: +s.getAttribute('height')
    };
  }
  return frames;
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

// 带进度的 fetch；onProgress({ url, loaded, total, type })
async function fetchWithProgress(url, onProgress, type) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  const total = +res.headers.get('Content-Length') || 0;
  if (!res.body || !total) {
    const blob = await res.blob();
    onProgress && onProgress({ url, loaded: blob.size, total: blob.size, type });
    return blob;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress && onProgress({ url, loaded, total, type });
  }
  return new Blob(chunks);
}

// 进度条管理器，可控制多个资源累计进度
export class ProgressTracker {
  constructor(barEl, textEl) {
    this.bar = barEl;
    this.text = textEl;
    this.resources = new Map();
  }
  register(url, estimatedSize) {
    this.resources.set(url, { loaded: 0, total: estimatedSize || 0 });
  }
  update({ url, loaded, total }) {
    if (!this.resources.has(url)) this.resources.set(url, { loaded: 0, total: 0 });
    const r = this.resources.get(url);
    r.loaded = loaded;
    if (total) r.total = total;
    let l = 0, t = 0;
    this.resources.forEach(v => { l += v.loaded; t += Math.max(v.total, v.loaded); });
    const pct = t ? Math.min(100, (l / t) * 100) : 0;
    if (this.bar) this.bar.style.width = pct.toFixed(1) + '%';
    if (this.text) this.text.textContent = `加载中... ${pct.toFixed(0)}%`;
  }
  done() {
    if (this.bar) this.bar.style.width = '100%';
    if (this.text) this.text.textContent = '就绪';
  }
}

// 在 canvas 中按 atlas frame 绘制 sprite
export function drawSprite(ctx, atlas, name, dx, dy, dw, dh, opts = {}) {
  const f = atlas.frames[name];
  if (!f) return;
  const { rotation = 0, flipX = false, anchorX = 0.5, anchorY = 0.5, alpha = 1 } = opts;
  dw = dw ?? f.w;
  dh = dh ?? f.h;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(dx, dy);
  if (rotation) ctx.rotate(rotation);
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(atlas.image, f.x, f.y, f.w, f.h, -dw * anchorX, -dh * anchorY, dw, dh);
  ctx.restore();
}
