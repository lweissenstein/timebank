import { useEffect, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useI18n } from '../i18n';

// Validated (lightness, chroma, CVD separation) for each surface.
const COLORS = {
  light: { actual: '#00876c', plan: '#c27c2c', grid: '#e4e2dc', axis: '#6b6b66' },
  dark: { actual: '#2a9a80', plan: '#be7f30', grid: '#34342f', axis: '#a3a39b' },
};

function useDark(): boolean {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const onChange = () => setDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark;
}

export interface ChartPoint {
  date: string;
  actual?: number;
  forecast?: number;
}

export function BalanceChart({ points, today }: { points: ChartPoint[]; today: string }) {
  const { t, num, signed, date } = useI18n();
  const c = COLORS[useDark() ? 'dark' : 'light'];
  const todayPoint = [...points].reverse().find((p) => p.date < today && p.actual !== undefined)?.date;

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={c.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d: string) => date(d, { day: '2-digit', month: '2-digit' })} tick={{ fill: c.axis, fontSize: 11 }} stroke={c.grid} minTickGap={24} />
          <YAxis tickFormatter={(v: number) => num(v, 0)} tick={{ fill: c.axis, fontSize: 11 }} stroke={c.grid} width={44} />
          <ReferenceLine y={0} stroke={c.axis} strokeOpacity={0.5} />
          {todayPoint && <ReferenceLine x={todayPoint} stroke={c.axis} strokeDasharray="2 3" label={{ value: t('common.today'), fill: c.axis, fontSize: 11, position: 'insideTopLeft' }} />}
          <Tooltip
            formatter={(v, name) => [signed(Number(v)), name]}
            labelFormatter={(d) => date(String(d), { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--ink)' }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: 'var(--ink-2)' }} />
          <Line type="linear" dataKey="actual" name={t('stats.actual')} stroke={c.actual} strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 5 }} isAnimationActive={false} />
          <Line type="linear" dataKey="forecast" name={t('stats.projected')} stroke={c.plan} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
