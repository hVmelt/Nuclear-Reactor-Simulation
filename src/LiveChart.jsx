import { useRef, useEffect } from 'react';

const HISTORY = 120;

// Convert any CSS color (hex or rgb) into rgba(...) with the given alpha.
// Falls back to a neutral color if input is invalid.
function withAlpha(color, alpha) {
  if (!color || typeof color !== 'string') return `rgba(150,150,150,${alpha})`;

  // Hex: #RGB or #RRGGBB
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length !== 6) return `rgba(150,150,150,${alpha})`;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // rgb(r,g,b) or rgba(r,g,b,a)
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return `rgba(${m[1]},${m[2]},${m[3]},${alpha})`;

  return `rgba(150,150,150,${alpha})`;
}

export default function LiveChart({ label, currentLabel, color, value, minVal, maxVal }) {
  const canvasRef = useRef(null);
  const historyRef = useRef(new Array(HISTORY).fill(minVal));
  const colorRef = useRef(color);
  const minRef = useRef(minVal);
  const maxRef = useRef(maxVal);
  const rafRef = useRef(null);

  // Keep refs in sync so the draw loop sees the latest values
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { minRef.current = minVal; }, [minVal]);
  useEffect(() => { maxRef.current = maxVal; }, [maxVal]);

  useEffect(() => {
    historyRef.current.push(value);
    historyRef.current.shift();
  }, [value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.parentElement.clientWidth || 400;
      canvas.width = w * dpr;
      canvas.height = 60 * dpr;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset before scaling
      ctx.scale(dpr, dpr);
    }

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const ctx = canvas.getContext('2d');
      const w = canvas.width / dpr;
      const h = 60;
      const data = historyRef.current;
      const c = colorRef.current;
      const minV = minRef.current;
      const maxV = maxRef.current;

      ctx.clearRect(0, 0, w, h);

      // grid lines
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.5;
      [0.25, 0.5, 0.75].forEach(f => { ctx.moveTo(0, h * f); ctx.lineTo(w, h * f); });
      ctx.stroke();

      const pts = data.map((v, i) => ({
        x: (i / (HISTORY - 1)) * w,
        y: h - Math.max(0, Math.min(1, (v - minV) / (maxV - minV))) * h * 0.88 - h * 0.06,
      }));

      // fill (gradient with safe color conversion)
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, withAlpha(c, 0.33));
      grad.addColorStop(1, withAlpha(c, 0));
      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // line
      ctx.beginPath();
      ctx.strokeStyle = c;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div style={{
      background: 'var(--color-bg-card)',
      border: '0.5px solid var(--color-border)',
      borderRadius: 10,
      padding: '10px 14px 8px',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 500, color }}>{currentLabel}</span>
      </div>
      <div style={{ width: '100%', height: 60, position: 'relative' }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}/>
      </div>
    </div>
  );
}
