export interface DonutSegment {
  value: number;
  color: string;
  label: string;
}

/**
 * Small ring chart. Segments are drawn as arcs of one circle with a 2px gap
 * between them; the label of each segment is used for the accessible title.
 */
export function Donut({ segments, size = 52, thickness = 9 }: { segments: DonutSegment[]; size?: number; thickness?: number }) {
  const parts = segments.filter((s) => s.value > 0);
  const total = parts.reduce((sum, s) => sum + s.value, 0);
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const gap = parts.length > 1 ? 2 : 0;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={parts.map((p) => p.label).join(', ')} className="donut">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
      {total > 0 &&
        parts.map((p) => {
          const length = (p.value / total) * circumference;
          const visible = Math.max(0.5, length - gap);
          const el = (
            <circle
              key={p.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={p.color}
              strokeWidth={thickness}
              strokeDasharray={`${visible} ${circumference - visible}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>{p.label}</title>
            </circle>
          );
          offset += length;
          return el;
        })}
    </svg>
  );
}
