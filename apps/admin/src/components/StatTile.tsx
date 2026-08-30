type Tone = 'neutral' | 'good' | 'warning' | 'critical';

/**
 * A single number is a stat tile, not a chart — there is no trend to plot.
 * `tone` ships alongside a text label, so state never rides on color alone.
 */
export function StatTile({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}) {
  return (
    <div className={`tile tile--${tone}`}>
      <span className="tile__label">{label}</span>
      <strong className="tile__value">{value}</strong>
      {sub && <span className="tile__sub">{sub}</span>}
    </div>
  );
}
