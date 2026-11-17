/*
 * GradientText (vanilla JS port of the React Bits component, JavaScript + CSS variant).
 * Any element with the data-gradient-text attribute becomes animated gradient text.
 * Options are read from data-* attributes: data-colors="#5227FF,#FF9FFC", data-animation-speed,
 * data-variant (linear|flow|conic), data-angle, data-scale, data-yoyo, data-glow,
 * data-show-border, data-border-width, data-pause-on-hover, data-follow-pointer.
 */
(function () {
'use strict';

const VARIANTS = ['linear', 'flow', 'conic'];
const TAU = Math.PI * 2;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const bool = (v, d) => (v === undefined ? d : v !== 'false');

function init(host) {
  if (host.__gradientText) return;
  host.__gradientText = true;
  const d = host.dataset;

  let colors = (d.colors || '#5227FF,#FF9FFC,#B497CF').split(',').map(c => c.trim()).filter(Boolean);
  if (colors.length < 2) colors = [colors[0] || '#ffffff', colors[0] || '#ffffff'];
  const s = {
    colors,
    speed: Math.max(0.2, num(d.animationSpeed, 8)),
    variant: VARIANTS.includes(d.variant) ? d.variant : 'linear',
    angle: num(d.angle, 90),
    scale: clamp(num(d.scale, 3), 1, 6),
    yoyo: bool(d.yoyo, true),
    pauseOnHover: bool(d.pauseOnHover, false) && d.pauseOnHover !== undefined,
    followPointer: d.followPointer !== undefined && d.followPointer !== 'false'
  };
  const glow = clamp(num(d.glow, 0), 0, 1);
  const showBorder = d.showBorder !== undefined && d.showBorder !== 'false';

  // Build markup around the original content
  const html = host.innerHTML;
  host.innerHTML = '';
  const root = document.createElement('span');
  root.className = 'gradient-text' + (showBorder ? ' gradient-text--border' : '');
  root.style.setProperty('--gt-border', num(d.borderWidth, 1.5) + 'px');
  root.style.setProperty('--gt-glow', glow);
  const inner = document.createElement('span');
  inner.className = 'gradient-text__inner';
  const content = document.createElement('span');
  content.className = 'gradient-text__content';
  content.innerHTML = html;
  inner.appendChild(content);
  if (glow > 0) {
    const g = document.createElement('span');
    g.className = 'gradient-text__glow';
    g.setAttribute('aria-hidden', 'true');
    g.innerHTML = html;
    inner.appendChild(g);
  }
  root.appendChild(inner);
  host.appendChild(root);

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const state = { time: 0, inside: false, visible: true, x: 0.5, y: 0.5, px: 0.5, py: 0.5, vx: 0, vy: 0, pull: 0 };
  let raf = 0;
  let last = 0;

  const paint = () => {
    const list = s.colors;
    const cycle = state.time / s.speed;
    let image;
    if (s.variant === 'flow') {
      const blobs = list.map((color, i) => {
        const spin = cycle * TAU;
        const rate = 0.55 + ((i * 0.618) % 1) * 0.5;
        let x = 50 + 44 * Math.sin(spin * rate + i * 2.1);
        let y = 50 + 40 * Math.sin(spin * (rate * 0.83 + 0.21) + i * 1.3);
        if (i === 0) {
          x += (state.px * 100 - x) * state.pull;
          y += (state.py * 100 - y) * state.pull;
        }
        return `radial-gradient(ellipse ${(22 + 12 * s.scale).toFixed(1)}% ${(60 + 30 * s.scale).toFixed(1)}% at ${x.toFixed(2)}% ${y.toFixed(2)}%, ${color} 0%, transparent 100%)`;
      });
      image = `${blobs.join(', ')}, linear-gradient(${s.angle}deg, ${list.join(', ')})`;
    } else if (s.variant === 'conic') {
      const sway = s.yoyo ? Math.sin(cycle * Math.PI) * 50 : cycle * 360;
      const cx = 50 + (state.px * 100 - 50) * state.pull;
      const cy = 260 + (state.py * 100 - 260) * state.pull;
      image = `repeating-conic-gradient(from ${(sway - 30).toFixed(2)}deg at ${cx.toFixed(2)}% ${cy.toFixed(2)}%, ${[...list, list[0]].map((color, i) => `${color} ${((i / list.length) * 60 * (3 / s.scale)).toFixed(2)}deg`).join(', ')})`;
    } else {
      const loop = [...list, list[0]];
      const period = 100 * s.scale;
      let offset;
      if (s.yoyo) {
        const swing = cycle % 2;
        const t = swing < 1 ? swing : 2 - swing;
        offset = (0.5 - Math.cos(Math.PI * t) / 2) * (period - 100);
      } else {
        offset = (cycle % 1) * period;
      }
      offset += (state.px - 0.5) * period * 0.5 * state.pull;
      const stops = loop.map((color, i) => `${color} ${((i / (loop.length - 1)) * period - offset).toFixed(2)}%`);
      image = `repeating-linear-gradient(${s.angle}deg, ${stops.join(', ')})`;
    }
    root.style.setProperty('--gt-gradient', image);
  };

  const tick = now => {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const paused = reduce || (s.pauseOnHover && state.inside);
    if (!paused) state.time += dt;
    const target = s.followPointer && state.inside ? 1 : 0;
    state.pull += (target - state.pull) * (1 - Math.exp(-dt * 6));
    const stiffness = 160;
    state.vx += ((state.x - state.px) * stiffness - state.vx * 2 * Math.sqrt(stiffness)) * dt;
    state.vy += ((state.y - state.py) * stiffness - state.vy * 2 * Math.sqrt(stiffness)) * dt;
    state.px += state.vx * dt;
    state.py += state.vy * dt;
    paint();
    const settling = Math.abs(state.pull - target) > 0.001 || Math.abs(state.vx) + Math.abs(state.vy) > 0.001;
    if (!state.visible || (paused && !settling)) return;
    raf = requestAnimationFrame(tick);
  };
  const wake = () => {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };

  const locate = e => {
    const r = root.getBoundingClientRect();
    state.x = clamp((e.clientX - r.left) / r.width, 0, 1);
    state.y = clamp((e.clientY - r.top) / r.height, 0, 1);
  };
  root.addEventListener('pointerenter', e => {
    locate(e);
    if (!state.inside) { state.px = state.x; state.py = state.y; }
    state.inside = true;
    wake();
  });
  root.addEventListener('pointermove', e => { locate(e); wake(); });
  root.addEventListener('pointerleave', () => { state.inside = false; wake(); });

  new IntersectionObserver(entries => {
    state.visible = entries.some(e => e.isIntersecting);
    if (state.visible) wake();
  }).observe(root);

  paint();
  wake();
}

function boot() { document.querySelectorAll('[data-gradient-text]').forEach(init); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
