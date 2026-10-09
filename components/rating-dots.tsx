export function RatingDots({ score, label }: { score: number; label?: string }) {
  const filled = Math.max(0, Math.min(5, Math.round(score)));
  return (
    <span
      className="rating"
      data-testid="muscle-rating"
      data-score={filled}
      role="img"
      aria-label={label ?? `${filled} out of 5`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < filled ? "on" : ""} />
      ))}
    </span>
  );
}
