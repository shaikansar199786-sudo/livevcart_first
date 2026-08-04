import React, { useState, useEffect, useRef } from 'react';

interface AnalogTimePickerProps {
  value: string; // "HH:mm" format
  onChange: (time: string) => void;
  onClose?: () => void;
}

export const AnalogTimePicker: React.FC<AnalogTimePickerProps> = ({ value, onChange, onClose }) => {
  const [mode, setMode] = useState<'hours' | 'minutes'>('hours');
  // Parse initial value
  const parseTime = (val: string) => {
    if (!val) return { h: 10, m: 0, am: true };
    const [hs, ms] = val.split(':');
    let h = parseInt(hs, 10);
    const m = parseInt(ms, 10);
    const am = h < 12;
    if (h === 0) h = 12;
    if (h > 12) h -= 12;
    return { h, m, am };
  };

  const init = parseTime(value);
  const [hour, setHour] = useState(init.h);
  const [minute, setMinute] = useState(init.m);
  const [isAM, setIsAM] = useState(init.am);

  const svgRef = useRef<SVGSVGElement>(null);

  // Update parent when time changes
  useEffect(() => {
    let finalH = hour;
    if (isAM && finalH === 12) finalH = 0;
    if (!isAM && finalH < 12) finalH += 12;

    const hStr = finalH.toString().padStart(2, '0');
    const mStr = minute.toString().padStart(2, '0');
    onChange(`${hStr}:${mStr}`);
  }, [hour, minute, isAM, onChange]);

  const cx = 120;
  const cy = 120;
  const r = 90;

  const handleSVGClick = (e: React.MouseEvent) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - cx;
    const y = e.clientY - rect.top - cy;

    // Calculate angle in radians, 0 is at 12 o'clock, clockwise
    let angle = Math.atan2(y, x) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;

    if (mode === 'hours') {
      let h = Math.round((angle / (2 * Math.PI)) * 12);
      if (h === 0) h = 12;
      setHour(h);
      setMode('minutes');
    } else {
      let m = Math.round((angle / (2 * Math.PI)) * 60);
      if (m === 60) m = 0;
      setMinute(m);
      if (onClose) onClose();
    }
  };

  const getHandAngle = () => {
    if (mode === 'hours') {
      return (hour / 12) * 360;
    }
    return (minute / 60) * 360;
  };

  const handAngle = getHandAngle();

  // Hand coordinates
  const hx = cx + r * Math.sin((handAngle * Math.PI) / 180);
  const hy = cy - r * Math.cos((handAngle * Math.PI) / 180);

  const numbers = mode === 'hours' ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', width: '280px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
          <span
            style={{ color: mode === 'hours' ? '#f97316' : '#9ca3af', cursor: 'pointer' }}
            onClick={() => setMode('hours')}
          >
            {hour.toString().padStart(2, '0')}
          </span>
          <span style={{ color: '#9ca3af' }}>:</span>
          <span
            style={{ color: mode === 'minutes' ? '#f97316' : '#9ca3af', cursor: 'pointer' }}
            onClick={() => setMode('minutes')}
          >
            {minute.toString().padStart(2, '0')}
          </span>
        </div>
        <div style={{ display: 'flex', backgroundColor: '#f3f4f6', borderRadius: '8px', overflow: 'hidden' }}>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setIsAM(true); }}
            style={{ padding: '6px 12px', border: 'none', background: isAM ? '#1e293b' : 'transparent', color: isAM ? 'white' : '#6b7280', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            AM
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); setIsAM(false); }}
            style={{ padding: '6px 12px', border: 'none', background: !isAM ? '#1e293b' : 'transparent', color: !isAM ? 'white' : '#6b7280', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            PM
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', width: '240px', height: '240px', margin: '0 auto', backgroundColor: '#f8fafc', borderRadius: '50%' }}>
        <svg ref={svgRef} width="240" height="240" onClick={handleSVGClick} style={{ cursor: 'pointer' }}>
          {/* Clock Face */}
          <circle cx={cx} cy={cy} r="120" fill="transparent" />

          {/* Hand */}
          <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="#f97316" strokeWidth="2" />
          <circle cx={hx} cy={hy} r="14" fill="#f97316" />
          <circle cx={cx} cy={cy} r="4" fill="#f97316" />

          {/* Numbers */}
          {numbers.map((num, i) => {
            const angle = (i * 30 * Math.PI) / 180;
            const nx = cx + r * Math.sin(angle);
            const ny = cy - r * Math.cos(angle);

            let isSelected = false;
            if (mode === 'hours') {
              isSelected = hour === num || (hour === 12 && num === 12);
            } else {
              isSelected = minute === num;
            }

            return (
              <text
                key={i}
                x={nx}
                y={ny}
                textAnchor="middle"
                alignmentBaseline="middle"
                fontSize="14"
                fontWeight={isSelected ? '700' : '500'}
                fill={isSelected ? 'white' : '#4b5563'}
                style={{ pointerEvents: 'none' }}
              >
                {mode === 'minutes' && num === 0 ? '00' : num}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
