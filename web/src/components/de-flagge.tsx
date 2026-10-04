/** Die deutsche Flagge als drei Streifen — Emoji-Flaggen zeigt Windows nur als „DE". */
export function DeFlaggeZeichen({ className = '' }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Deutsch"
      className={`inline-block h-2.5 w-4 shrink-0 rounded-[2px] ${className}`}
      style={{ background: 'linear-gradient(#000 33.3%, #d00 33.3% 66.6%, #ffce00 66.6%)' }}
    />
  )
}
