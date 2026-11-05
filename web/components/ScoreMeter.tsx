/** Five-segment meter. `tone` picks the fill colour. */
export default function ScoreMeter({
  label,
  value,
  title,
  tone = "neutral",
}: {
  label: string;
  value: number;
  title?: string;
  tone?: "good" | "warn" | "neutral";
}) {
  return (
    <div className={`ns-meter ns-meter-${tone}`} title={title}>
      <span className="ns-meter-label">{label}</span>
      <span className="ns-meter-bars" role="img" aria-label={`${label} ${value} of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= value ? "on" : undefined} />
        ))}
      </span>
    </div>
  );
}
