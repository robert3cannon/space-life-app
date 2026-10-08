export function Stars() {
  return (
    <div className="sky" aria-hidden>
      <div className="stars-far" />
      <div className="stars" />
      <div className="planets">
        <RingedPlanet />
        <Moon />
        <GasGiant />
      </div>
    </div>
  );
}

function RingedPlanet() {
  return (
    <svg className="planet planet-ring" viewBox="0 0 200 200">
      <defs>
        <radialGradient id="orbit-ring-body" cx="36%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fff8ff" />
          <stop offset="22%" stopColor="#d8cbff" />
          <stop offset="55%" stopColor="#7a68e0" />
          <stop offset="100%" stopColor="#241456" />
        </radialGradient>
        <linearGradient id="orbit-ring-ice" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7aefff" stopOpacity="0" />
          <stop offset="18%" stopColor="#d9ccff" stopOpacity="0.95" />
          <stop offset="48%" stopColor="#7aefff" stopOpacity="0.9" />
          <stop offset="78%" stopColor="#ff8ad4" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#7aefff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="orbit-ring-front">
          <rect x="0" y="104" width="200" height="96" />
        </clipPath>
      </defs>
      <circle cx="100" cy="96" r="74" fill="#9b8cff" opacity="0.22" />
      <g transform="rotate(-18 100 104)">
        <ellipse cx="100" cy="104" rx="92" ry="20" fill="none" stroke="url(#orbit-ring-ice)" strokeWidth="7" opacity="0.4" />
      </g>
      <circle cx="100" cy="96" r="50" fill="url(#orbit-ring-body)" />
      <ellipse cx="86" cy="78" rx="22" ry="12" fill="#ffffff" opacity="0.18" />
      <path d="M62 108c14 8 50 12 76 4" fill="none" stroke="#2a1d62" strokeWidth="6" opacity="0.35" strokeLinecap="round" />
      <g transform="rotate(-18 100 104)">
        <g clipPath="url(#orbit-ring-front)">
          <ellipse cx="100" cy="104" rx="92" ry="20" fill="none" stroke="url(#orbit-ring-ice)" strokeWidth="9" />
          <ellipse cx="100" cy="104" rx="78" ry="14" fill="none" stroke="#f4f0ff" strokeWidth="1.5" opacity="0.55" />
        </g>
      </g>
    </svg>
  );
}

function Moon() {
  return (
    <svg className="planet planet-moon" viewBox="0 0 64 64">
      <defs>
        <radialGradient id="orbit-moon-body" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#f7f4ff" />
          <stop offset="55%" stopColor="#c3b7e6" />
          <stop offset="100%" stopColor="#5c537c" />
        </radialGradient>
      </defs>
      <circle cx="40" cy="28" r="18" fill="#9b8cff" opacity="0.28" />
      <circle cx="32" cy="32" r="16" fill="url(#orbit-moon-body)" />
      <circle cx="26" cy="28" r="3.2" fill="#6d6494" opacity="0.45" />
      <circle cx="36" cy="36" r="2" fill="#6d6494" opacity="0.35" />
      <circle cx="34" cy="24" r="1.4" fill="#6d6494" opacity="0.3" />
    </svg>
  );
}

function GasGiant() {
  return (
    <svg className="planet planet-giant" viewBox="0 0 220 220">
      <defs>
        <radialGradient id="orbit-giant-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7aefff" stopOpacity="0.28" />
          <stop offset="70%" stopColor="#3a2d86" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="orbit-giant-body" cx="34%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#f4fdff" />
          <stop offset="20%" stopColor="#9ad8ff" />
          <stop offset="52%" stopColor="#3f62c8" />
          <stop offset="100%" stopColor="#141044" />
        </radialGradient>
        <clipPath id="orbit-giant-clip">
          <circle cx="110" cy="110" r="62" />
        </clipPath>
      </defs>
      <circle cx="110" cy="110" r="100" fill="url(#orbit-giant-glow)" />
      <circle cx="110" cy="110" r="62" fill="url(#orbit-giant-body)" />
      <g clipPath="url(#orbit-giant-clip)">
        <ellipse cx="110" cy="86" rx="70" ry="8" fill="#1a1460" opacity="0.28" />
        <ellipse cx="110" cy="104" rx="74" ry="7" fill="#ff8ad4" opacity="0.22" />
        <ellipse cx="110" cy="122" rx="74" ry="10" fill="#071433" opacity="0.35" />
        <ellipse cx="110" cy="142" rx="70" ry="8" fill="#7aefff" opacity="0.28" />
        <ellipse cx="128" cy="118" rx="14" ry="8" fill="#d7fbff" opacity="0.55" />
      </g>
      <ellipse cx="92" cy="90" rx="24" ry="14" fill="#ffffff" opacity="0.16" />
    </svg>
  );
}
