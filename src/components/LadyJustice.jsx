/* Stylized Lady Justice (goddess of law with scales) — pure SVG brand art.
   Used as the auth-screen background so the marketing hero never depends on
   external image hosting. */
export function LadyJusticeArt({ className = "" }) {
  return (
    <svg
      viewBox="0 0 700 1000"
      preserveAspectRatio="xMidYMax meet"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="ljGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6e2a0" />
          <stop offset="45%" stopColor="#d9b054" />
          <stop offset="100%" stopColor="#7c5c26" />
        </linearGradient>
        <linearGradient id="ljBlade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fdf6dd" />
          <stop offset="100%" stopColor="#c9a24b" />
        </linearGradient>
        <radialGradient id="ljGlow" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="rgba(16,185,129,0.30)" />
          <stop offset="55%" stopColor="rgba(16,185,129,0.10)" />
          <stop offset="100%" stopColor="rgba(16,185,129,0)" />
        </radialGradient>
      </defs>

      {/* ambient glow + halo rings */}
      <circle cx="350" cy="430" r="330" fill="url(#ljGlow)" />
      <circle cx="350" cy="430" r="300" fill="none" stroke="#d9b054" strokeOpacity="0.12" strokeWidth="2" />
      <circle cx="350" cy="430" r="345" fill="none" stroke="#d9b054" strokeOpacity="0.06" strokeWidth="2" />

      {/* faint marble columns */}
      <g fill="#ffffff">
        <rect x="40" y="306" width="50" height="22" rx="8" opacity="0.06" />
        <rect x="48" y="330" width="34" height="480" rx="12" opacity="0.05" />
        <rect x="36" y="810" width="58" height="18" rx="6" opacity="0.06" />
        <rect x="610" y="306" width="50" height="22" rx="8" opacity="0.06" />
        <rect x="618" y="330" width="34" height="480" rx="12" opacity="0.05" />
        <rect x="606" y="810" width="58" height="18" rx="6" opacity="0.06" />
      </g>

      {/* floating light particles */}
      <g fill="#f7e08b">
        <circle cx="120" cy="220" r="3" opacity="0.35" />
        <circle cx="600" cy="180" r="2.5" opacity="0.3" />
        <circle cx="90" cy="520" r="2" opacity="0.25" />
        <circle cx="640" cy="470" r="3" opacity="0.3" />
        <circle cx="180" cy="760" r="2" opacity="0.2" />
        <circle cx="560" cy="720" r="2.5" opacity="0.25" />
        <circle cx="350" cy="80" r="2" opacity="0.3" />
      </g>

      {/* pedestal */}
      <ellipse cx="350" cy="830" rx="170" ry="18" fill="url(#ljGold)" opacity="0.5" />
      <rect x="210" y="840" width="280" height="16" rx="8" fill="url(#ljGold)" opacity="0.4" />
      <rect x="190" y="856" width="320" height="16" rx="8" fill="url(#ljGold)" opacity="0.28" />

      {/* robe / torso */}
      <path
        d="M350 198
           C 300 206, 278 240, 268 300
           C 256 380, 246 560, 224 820
           L 476 820
           C 454 560, 444 380, 432 300
           C 422 240, 400 206, 350 198 Z"
        fill="url(#ljGold)"
      />
      {/* robe folds */}
      <g fill="none" stroke="#5c441c" strokeOpacity="0.35" strokeWidth="4" strokeLinecap="round">
        <path d="M310 320 C 300 480, 292 640, 280 800" />
        <path d="M390 320 C 400 480, 408 640, 420 800" />
        <path d="M350 340 C 350 520, 350 680, 350 810" />
      </g>
      {/* waist sash */}
      <path d="M292 380 C 320 396, 380 396, 408 380" fill="none" stroke="url(#ljGold)" strokeWidth="10" strokeLinecap="round" />

      {/* neck + head + blindfold */}
      <rect x="340" y="184" width="20" height="18" fill="url(#ljGold)" />
      <circle cx="350" cy="150" r="36" fill="url(#ljGold)" />
      <rect x="314" y="140" width="72" height="16" rx="8" fill="#f7e08b" />
      <path d="M386 148 l26 -8 l-4 20 z" fill="#f7e08b" opacity="0.9" />

      {/* right arm raised, holding the scales */}
      <path d="M410 232 C 452 214, 486 186, 512 150" fill="none" stroke="url(#ljGold)" strokeWidth="18" strokeLinecap="round" />
      <circle cx="516" cy="146" r="10" fill="url(#ljGold)" />
      <g stroke="url(#ljGold)" strokeLinecap="round">
        <line x1="516" y1="146" x2="516" y2="128" strokeWidth="6" />
        <line x1="436" y1="128" x2="596" y2="128" strokeWidth="6" />
        <g strokeWidth="3" strokeOpacity="0.85">
          <line x1="446" y1="128" x2="426" y2="196" />
          <line x1="446" y1="128" x2="466" y2="196" />
          <line x1="586" y1="128" x2="566" y2="196" />
          <line x1="586" y1="128" x2="606" y2="196" />
        </g>
      </g>
      <path d="M414 196 A32 32 0 0 0 478 196 Z" fill="url(#ljGold)" />
      <path d="M554 196 A32 32 0 0 0 618 196 Z" fill="url(#ljGold)" />

      {/* left arm lowered, holding the sword */}
      <path d="M292 232 C 268 268, 258 306, 256 344" fill="none" stroke="url(#ljGold)" strokeWidth="18" strokeLinecap="round" />
      <circle cx="256" cy="348" r="10" fill="url(#ljGold)" />
      <circle cx="256" cy="328" r="6" fill="url(#ljGold)" />
      <line x1="256" y1="332" x2="256" y2="352" stroke="url(#ljGold)" strokeWidth="7" strokeLinecap="round" />
      <line x1="232" y1="356" x2="280" y2="356" stroke="url(#ljGold)" strokeWidth="8" strokeLinecap="round" />
      <path d="M250 360 L262 360 L258 552 L256 566 L254 552 Z" fill="url(#ljBlade)" />
    </svg>
  );
}
