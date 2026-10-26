import { fmt1 } from "@/lib/utils";

/**
 * Minimal SVG trend: dots are raw weigh-ins, the line is the smoothed trend.
 * Decorative for screen readers; the numbers are shown as text next to it.
 */
export function TrendChart({ points, height = 120, label }: { points: { date: string; weightKg: number; trendKg: number }[]; height?: number; label: string }) {
  if (points.length < 2) {
    return <p className="text-sm text-muted-foreground">Log at least two weigh-ins to see a trend.</p>;
  }
  const w = 600;
  const pad = 8;
  const values = points.flatMap((p) => [p.weightKg, p.trendKg]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.5);
  const x = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.trendKg).toFixed(1)}`).join(" ");

  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${w} ${height}`} className="h-auto w-full" role="img" aria-label={label} preserveAspectRatio="none">
        {points.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.weightKg)} r={3} fill="var(--muted-foreground)" opacity={0.6} />
        ))}
        <polyline points={line} fill="none" stroke="var(--primary)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <figcaption className="flex justify-between text-xs text-muted-foreground">
        <span>{points[0].date}</span>
        <span>
          Range {fmt1(min)}–{fmt1(max)} kg
        </span>
        <span>{points[points.length - 1].date}</span>
      </figcaption>
    </figure>
  );
}
