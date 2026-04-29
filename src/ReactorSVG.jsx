import React, { useRef, useEffect } from 'react';
import { getTempColor } from './useReactorPhysics';

const VB_W = 280;
const VB_H = 420;
const COLS = [48, 88, 128, 168, 208, 248];
const ROWS = [48, 98, 148, 198, 248, 298, 358];
const ROD_W = 10;
const ROD_H = 36;
const CTRL_H = 48;
const VESSEL_TOP = 27;
const VESSEL_BOT = 390;
const TRAVEL = VESSEL_BOT - VESSEL_TOP - CTRL_H;
const SVG_NS = 'http://www.w3.org/2000/svg';

function isControl(ci, ri) {
  return (ri % 2 === 0 && ci % 2 === 1) || (ri % 2 === 1 && ci % 2 === 0);
}

const CONTROL_RODS = [];
COLS.forEach((cx, ci) => {
  ROWS.forEach((_, ri) => {
    if (isControl(ci, ri)) CONTROL_RODS.push({ key: `${ci}-${ri}`, cx });
  });
});

export default function ReactorSVG({ insertions, onInsertionChange, temperature, flux }) {
  const svgRef = useRef(null);
  const ctrlRectRefs = useRef({});
  const neutronGroupRef = useRef(null);
  const modBgRef = useRef(null);
  const particlesRef = useRef([]);

  // Refs that always point to current props (avoid stale closures in event handlers)
  const insertionsRef = useRef(insertions);
  const onChangeRef = useRef(onInsertionChange);
  const fluxRef = useRef(flux);
  useEffect(() => { insertionsRef.current = insertions; }, [insertions]);
  useEffect(() => { onChangeRef.current = onInsertionChange; }, [onInsertionChange]);
  useEffect(() => { fluxRef.current = flux; }, [flux]);

  // Build SVG content + attach drag handlers ONCE
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // Clean any prior content (StrictMode double-invoke safety)
    const fuelG = svg.querySelector('#fuel-rods');
    const ctrlG = svg.querySelector('#control-rods');
    while (fuelG.firstChild) fuelG.removeChild(fuelG.firstChild);
    while (ctrlG.firstChild) ctrlG.removeChild(ctrlG.firstChild);
    ctrlRectRefs.current = {};

    // Fuel rods
    COLS.forEach((cx, ci) => {
      ROWS.forEach((cy, ri) => {
        if (!isControl(ci, ri)) {
          const r = document.createElementNS(SVG_NS, 'rect');
          r.setAttribute('x', cx - ROD_W / 2);
          r.setAttribute('y', cy - ROD_H / 2);
          r.setAttribute('width', ROD_W);
          r.setAttribute('height', ROD_H);
          r.setAttribute('rx', '2');
          r.style.fill = '#EF9F27';
          r.style.opacity = '0.9';
          fuelG.appendChild(r);
        }
      });
    });

    // Control rods with drag handlers
    CONTROL_RODS.forEach(({ key }) => {
      const r = document.createElementNS(SVG_NS, 'rect');
      r.setAttribute('width', ROD_W);
      r.setAttribute('height', CTRL_H);
      r.setAttribute('rx', '2');
      r.style.fill = '#444441';
      r.style.cursor = 'ns-resize';

      r.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const startClientY = e.clientY;
        const startIns = insertionsRef.current[key] ?? 1;
        const svgRect = svg.getBoundingClientRect();
        const scaleY = VB_H / svgRect.height;

        const onMove = (ev) => {
          const dy = (ev.clientY - startClientY) * scaleY;
          const newIns = Math.max(0, Math.min(1, startIns + dy / TRAVEL));
          onChangeRef.current(key, newIns);
        };
        const onUp = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });

      ctrlRectRefs.current[key] = r;
      ctrlG.appendChild(r);
    });
  }, []);

  // Position rods whenever insertions change
  useEffect(() => {
    CONTROL_RODS.forEach(({ key, cx }) => {
      const rect = ctrlRectRefs.current[key];
      if (!rect) return;
      const ins = insertions[key] ?? 1;
      const y = VESSEL_TOP + ins * TRAVEL;
      rect.setAttribute('x', cx - ROD_W / 2);
      rect.setAttribute('y', y);
    });
  }, [insertions]);

  // Moderator color reflects temperature
  useEffect(() => {
    if (modBgRef.current) {
      modBgRef.current.setAttribute('fill', getTempColor(temperature));
    }
  }, [temperature]);

  // Neutron particles — single RAF loop reading flux from ref
  useEffect(() => {
    let rafId;
    const neutronG = neutronGroupRef.current;
    if (!neutronG) return;

    function animate() {
      const f = fluxRef.current;
      if (f > 0.05 && particlesRef.current.length < Math.round(f * 18) && Math.random() < f * 0.3) {
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('r', '2.5');
        c.setAttribute('fill', '#FAC775');
        c.setAttribute('opacity', '0.85');
        neutronG.appendChild(c);
        particlesRef.current.push({
          el: c,
          x: 35 + Math.random() * 210,
          y: 35 + Math.random() * 350,
          vx: (Math.random() - 0.5) * 2.5,
          vy: (Math.random() - 0.5) * 2.5,
          life: 0,
          maxLife: 25 + Math.random() * 30,
        });
      }
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx; p.y += p.vy; p.life++;
        p.el.setAttribute('cx', p.x);
        p.el.setAttribute('cy', p.y);
        p.el.setAttribute('opacity', (1 - p.life / p.maxLife) * 0.85);
        if (p.life >= p.maxLife || p.x < 27 || p.x > 253 || p.y < 27 || p.y > 390) {
          if (p.el.parentNode === neutronG) neutronG.removeChild(p.el);
          particlesRef.current.splice(i, 1);
        }
      }
      rafId = requestAnimationFrame(animate);
    }

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={{ width: '100%', display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </marker>
      </defs>
      <rect x="20" y="20" width="240" height="380" rx="14" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="6"/>
      <rect ref={modBgRef} x="27" y="27" width="226" height="366" rx="10" fill="#B5D4F4" opacity="0.2"/>
      <rect x="20" y="20" width="240" height="380" rx="14" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
      <line x1="4" y1="360" x2="18" y2="360" stroke="#378ADD" strokeWidth="1.5" markerEnd="url(#arr)"/>
      <text x="3" y="354" fontSize="8" fill="#378ADD">in</text>
      <line x1="18" y1="50" x2="4" y2="50" stroke="#E24B4A" strokeWidth="1.5" markerEnd="url(#arr)"/>
      <text x="3" y="44" fontSize="8" fill="#E24B4A">out</text>
      <g id="neutrons" ref={neutronGroupRef}/>
      <g id="fuel-rods"/>
      <g id="control-rods"/>
    </svg>
  );
}
