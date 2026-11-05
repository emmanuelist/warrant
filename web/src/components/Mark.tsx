/**
 * The brand mark: one lever, pulled. Same geometry as the Interlock's levers. The lever takes the
 * surrounding ink, so the mark reads in the studio light and on the night band alike.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 28" className={className} aria-hidden="true">
      <rect x="9" y="3" width="6" height="16" rx="3" fill="currentColor" opacity="0.18" />
      <g transform="rotate(-18 12 18)">
        <rect x="10.75" y="4" width="2.5" height="15" rx="1.25" fill="currentColor" />
        <circle cx="12" cy="4.5" r="3.4" fill="currentColor" />
      </g>
      <rect x="3" y="19.5" width="18" height="7.5" rx="1" fill="var(--color-lock)" />
    </svg>
  );
}
