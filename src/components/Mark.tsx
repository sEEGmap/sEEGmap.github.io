export default function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="14.5" stroke="var(--line-strong)" strokeWidth="1.2" />
      <line x1="16" y1="3" x2="16" y2="29" stroke="var(--danger)" strokeWidth="1" opacity="0.55" />
      <line x1="3" y1="16" x2="29" y2="16" stroke="var(--danger)" strokeWidth="1" opacity="0.55" />
      <circle cx="16" cy="16" r="5" fill="var(--accent)" />
    </svg>
  );
}
