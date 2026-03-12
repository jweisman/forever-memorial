type Props = {
  locale?: string;
  compact?: boolean;
  className?: string;
};

export default function Logo({
  locale = "en",
  compact = false,
  className = "",
}: Props) {
  if (locale === "he") {
    return <LogoHe compact={compact} className={className} />;
  }
  return <LogoEn compact={compact} className={className} />;
}

function LogoEn({
  compact,
  className,
}: {
  compact: boolean;
  className: string;
}) {
  if (compact) {
    // Mobile: wordmark + small tapering flourish, no subtitle
    return (
      <svg
        viewBox="0 0 120 43"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`h-7 w-auto ${className}`}
        role="img"
        aria-label="LeOlam"
      >
        <defs>
          <linearGradient
            id="logo-flourish-compact"
            x1="18"
            y1="33"
            x2="62"
            y2="28"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#C6A86A" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#C6A86A" stopOpacity="0" />
          </linearGradient>
        </defs>

        <text
          x="0"
          y="33"
          fontFamily="'Playfair Display', Georgia, serif"
          fontSize="32"
          fill="#C6A86A"
          letterSpacing="0.5"
        >
          LeOlam
        </text>

        <path
          d="M 18,33 C 28,42 46,42 62,28"
          stroke="url(#logo-flourish-compact)"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // Desktop: horizontal lockup — large wordmark on the left, subtitle to the right,
  // flourish from the L foot sweeping down into a full-width rule.
  return (
    <svg
      viewBox="0 0 390 62"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`h-11 w-auto ${className}`}
      role="img"
      aria-label="LeOlam — Forever Remembered"
    >
      {/* Main wordmark */}
      <text
        x="0"
        y="46"
        fontFamily="'Playfair Display', Georgia, serif"
        fontSize="52"
        fill="#C6A86A"
        letterSpacing="0.5"
      >
        LeOlam
      </text>

      {/* Subtitle — to the right, vertically centred in the wordmark height */}
      <text
        x="192"
        y="39"
        fontFamily="'Inter', system-ui, sans-serif"
        fontSize="11"
        fill="#C6A86A"
        letterSpacing="2.5"
      >
        FOREVER REMEMBERED
      </text>

      {/* Flourish — from foot of L, sweeps down into the rule */}
      <path
        d="M 26,46 C 37,59 62,57 92,57"
        stroke="#C6A86A"
        strokeWidth="1.1"
        strokeLinecap="round"
      />

      {/* Horizontal rule — from end of flourish to right edge */}
      <line
        x1="92"
        y1="57"
        x2="388"
        y2="57"
        stroke="#C6A86A"
        strokeWidth="0.5"
        strokeOpacity="0.6"
      />
    </svg>
  );
}

function LogoHe({
  compact,
  className,
}: {
  compact: boolean;
  className: string;
}) {
  if (compact) {
    // Mobile: just the Hebrew wordmark
    return (
      <svg
        viewBox="0 0 115 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`h-7 w-auto ${className}`}
        role="img"
        aria-label="לעולם"
      >
        <text
          x="57"
          y="32"
          fontFamily="'Frank Ruhl Libre', serif"
          fontSize="32"
          fill="#C6A86A"
          textAnchor="middle"
        >
          לעולם
        </text>
      </svg>
    );
  }

  // Desktop Hebrew: horizontal lockup — wordmark on the RIGHT (RTL), tagline to the LEFT.
  // textAnchor="middle" is used throughout to avoid SVG bidi positioning issues.
  // The flourish mirrors the English version: sweeps left from the wordmark foot into a full-width rule.
  return (
    <svg
      viewBox="0 0 390 62"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`h-11 w-auto ${className}`}
      role="img"
      aria-label="לעולם — זוכרים לנצח"
    >
      {/* Tagline — left side, vertically centred in the wordmark height */}
      <text
        x="140"
        y="39"
        fontFamily="'Inter', system-ui, sans-serif"
        fontSize="11"
        fill="#C6A86A"
        letterSpacing="1.5"
        textAnchor="middle"
      >
        זוכרים לנצח
      </text>

      {/* Wordmark — right side */}
      <text
        x="278"
        y="46"
        fontFamily="'Frank Ruhl Libre', serif"
        fontSize="52"
        fill="#C6A86A"
        textAnchor="middle"
      >
        לעולם
      </text>

      {/* Flourish — mirrored: from right edge of wordmark, sweeps down-left into the rule */}
      <path
        d="M 364,46 C 352,59 328,57 298,57"
        stroke="#C6A86A"
        strokeWidth="1.1"
        strokeLinecap="round"
      />

      {/* Horizontal rule — from flourish end to left edge */}
      <line
        x1="2"
        y1="57"
        x2="298"
        y2="57"
        stroke="#C6A86A"
        strokeWidth="0.5"
        strokeOpacity="0.6"
      />
    </svg>
  );
}
