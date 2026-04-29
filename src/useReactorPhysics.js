import { useRef, useCallback } from 'react';

const TEMP_INLET = 290;
const TEMP_MAX   = 350;
const TEMP_REF   = 300;
const TEMP_COEFF = -0.003;

export function useReactorPhysics() {
  const temperatureRef = useRef(290);

  const compute = useCallback((insertions) => {
    const keys = Object.keys(insertions);
    const avgIns = keys.reduce((s, k) => s + insertions[k], 0) / keys.length;
    const rodReactivity = 1 - avgIns;
    const tempFeedback = TEMP_COEFF * (temperatureRef.current - TEMP_REF);
    const keff = Math.max(0.5, Math.min(1.15, 0.60 + rodReactivity * 0.50 + tempFeedback));
    const flux = keff > 1.0 ? 1.0 : keff < 0.80 ? 0 : (keff - 0.80) / 0.20;
    const power = flux * 3000;

    const targetTemp = TEMP_INLET + flux * (TEMP_MAX - TEMP_INLET);
    temperatureRef.current += (targetTemp - temperatureRef.current) * 0.04;
    temperatureRef.current = Math.max(TEMP_INLET, Math.min(TEMP_MAX + 5, temperatureRef.current));

    return {
      keff,
      flux,
      power,
      temperature: temperatureRef.current,
      tempFeedback,
    };
  }, []);

  return { compute };
}

export function getTempColor(t) {
  const frac = Math.max(0, Math.min(1, (t - TEMP_INLET) / (TEMP_MAX - TEMP_INLET)));
  if (frac < 0.5) {
    const f = frac * 2;
    return `rgb(${Math.round(181 + f * 58)},${Math.round(212 - f * 53)},${Math.round(244 - f * 205)})`;
  } else {
    const f = (frac - 0.5) * 2;
    return `rgb(${Math.round(239 - f * 13)},${Math.round(159 - f * 84)},${Math.round(39 + f * 9)})`;
  }
}

export function getStatusChip(keff) {
  if (keff < 0.85)       return { label: 'Off',            color: '#6b6966', bg: '#1e2130' };
  if (keff < 1.0)        return { label: 'Subcritical',    color: '#9c9a92', bg: '#1e2130' };
  if (keff < 1.005)      return { label: 'Critical',       color: '#639922', bg: '#1e3010' };
  if (keff < 1.05)       return { label: 'Supercritical',  color: '#BA7517', bg: '#2a1e05' };
  return                        { label: '⚠ Prompt crit',  color: '#fff',    bg: '#E24B4A' };
}
