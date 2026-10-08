export function Mark({ size = 72 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 72 72" aria-hidden>
      <defs>
        <linearGradient id="orbit-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9b8cff" />
          <stop offset="0.5" stopColor="#7aefff" />
          <stop offset="1" stopColor="#ff8ad4" />
        </linearGradient>
      </defs>
      <circle cx="36" cy="38" r="16" fill="#140c2e" stroke="url(#orbit-ring)" strokeWidth="2.4" />
      <ellipse cx="36" cy="38" rx="28" ry="9" fill="none" stroke="url(#orbit-ring)" strokeWidth="2.2" transform="rotate(-18 36 38)" />
      <circle cx="18" cy="16" r="1.3" fill="white" />
      <circle cx="54" cy="20" r="1" fill="#d8d4ff" />
      <circle cx="48" cy="12" r="0.8" fill="white" />
    </svg>
  );
}
