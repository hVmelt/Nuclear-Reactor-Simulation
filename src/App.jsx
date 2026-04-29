import { useState, useEffect, useRef, useCallback } from 'react';
import ReactorSVG from './ReactorSVG';
import LiveChart from './LiveChart';
import { useReactorPhysics, getTempColor, getStatusChip } from './useReactorPhysics';

const COLS = [48, 88, 128, 168, 208, 248];
const ROWS = [48, 98, 148, 198, 248, 298, 358];

function isControl(ci, ri) {
  return (ri % 2 === 0 && ci % 2 === 1) || (ri % 2 === 1 && ci % 2 === 0);
}

function buildInitialInsertions(value = 1) {
  const ins = {};
  COLS.forEach((_, ci) => ROWS.forEach((_, ri) => {
    if (isControl(ci, ri)) ins[`${ci}-${ri}`] = value;
  }));
  return ins;
}

function MetricCard({ label, value, barPct, barColor, children }) {
  return (
    <div style={{
      background: 'var(--color-bg-card)',
      border: '0.5px solid var(--color-border)',
      borderRadius: 10,
      padding: '10px 12px',
      marginBottom: 8,
    }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500 }}>{value}</div>
      {barPct !== undefined && (
        <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.max(1, barPct)}%`, background: barColor, borderRadius: 3, transition: 'width 0.2s, background 0.4s' }}/>
        </div>
      )}
      {children}
    </div>
  );
}

function Btn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent',
      border: '0.5px solid rgba(255,255,255,0.2)',
      borderRadius: 7,
      padding: '6px 10px',
      fontSize: 12,
      cursor: 'pointer',
      color: 'var(--color-text-primary)',
      fontFamily: 'inherit',
      textAlign: 'left',
      width: '100%',
      marginBottom: 5,
      transition: 'background 0.15s',
    }}
    onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.07)'}
    onMouseLeave={e => e.target.style.background = 'transparent'}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [insertions, setInsertions] = useState(() => buildInitialInsertions(1));
  const [physicsState, setPhysicsState] = useState({
    keff: 0.6, flux: 0, power: 0, temperature: 290, tempFeedback: 0,
  });

  const { compute } = useReactorPhysics();
  const insertionsRef = useRef(insertions);

  useEffect(() => { insertionsRef.current = insertions; }, [insertions]);

  useEffect(() => {
    let rafId;
    let frame = 0;
    function tick() {
      const state = compute(insertionsRef.current);
      if (frame % 2 === 0) setPhysicsState({ ...state });
      frame++;
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [compute]);

  const handleInsertionChange = useCallback((key, value) => {
    setInsertions(prev => ({ ...prev, [key]: value }));
  }, []);

  const setAllRods = useCallback((val) => {
    setInsertions(buildInitialInsertions(val));
  }, []);

  const { keff, flux, power, temperature } = physicsState;
  const tempColor = getTempColor(temperature);
  const chip = getStatusChip(keff);
  const tempPct = Math.round((temperature - 290) / (350 - 290) * 100);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 16px 32px' }}>
      <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Nuclear Reactor Simulator</h1>
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
        Drag gray control rods up/down · Withdraw → power rises · SCRAM → emergency shutdown
      </p>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 16 }}>
        {/* Reactor diagram */}
        <div style={{ flex: '0 0 240px' }}>
          <ReactorSVG
            insertions={insertions}
            onInsertionChange={handleInsertionChange}
            temperature={temperature}
            flux={flux}
          />
        </div>

        {/* Sidebar metrics + controls */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <MetricCard
            label="Core temperature"
            value={`${Math.round(temperature)}°C`}
            barPct={tempPct}
            barColor={tempColor}
          />
          <MetricCard
            label="Neutron flux"
            value={`${Math.round(flux * 100)}%`}
            barPct={Math.round(flux * 100)}
            barColor="#EF9F27"
          />
          <MetricCard
            label="Thermal power"
            value={`${Math.round(power)} MW`}
            barPct={Math.round(power / 30)}
            barColor="#E24B4A"
          />
          <MetricCard label="Effective reactivity (keff)" value={keff.toFixed(3)}>
            <div style={{
              display: 'inline-block',
              marginTop: 6,
              padding: '2px 8px',
              borderRadius: 5,
              fontSize: 11,
              fontWeight: 500,
              background: chip.bg,
              color: chip.color,
            }}>
              {chip.label}
            </div>
          </MetricCard>

          {/* Controls */}
          <div style={{
            background: 'var(--color-bg-card)',
            border: '0.5px solid var(--color-border)',
            borderRadius: 10,
            padding: '10px 12px',
          }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Quick controls</div>
            <Btn onClick={() => setAllRods(0)}>↑ Withdraw all rods</Btn>
            <Btn onClick={() => setAllRods(0.5)}>↔ Half insertion</Btn>
            <Btn onClick={() => setAllRods(1)}>↓ SCRAM (insert all)</Btn>
          </div>
        </div>
      </div>

      {/* Live charts */}
      <LiveChart
        label="Thermal power output (MW)"
        currentLabel={`${Math.round(power)} MW`}
        color="#E24B4A"
        value={power}
        minVal={0}
        maxVal={3000}
      />
      <LiveChart
        label="Core temperature (°C)"
        currentLabel={`${Math.round(temperature)}°C`}
        color={tempColor}
        value={temperature}
        minVal={285}
        maxVal={360}
      />
      <LiveChart
        label="Neutron flux (%)"
        currentLabel={`${Math.round(flux * 100)}%`}
        color="#EF9F27"
        value={flux * 100}
        minVal={0}
        maxVal={100}
      />

      <div style={{ marginTop: 16, fontSize: 11, color: 'var(--color-text-tertiary)', lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--color-text-secondary)' }}>Physics model:</strong> Simplified PWR.
        keff = 0.60 + rodWithdrawal×0.50 + tempCoeff×ΔT. Temp coefficient = −0.003/°C (negative = stable).
        Max thermal output = 3000 MW. Prompt critical threshold at keff ≥ 1.05.
      </div>
    </div>
  );
}
