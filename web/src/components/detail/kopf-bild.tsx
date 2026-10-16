/**
 * Das Bild im Panel-Kopf (Variante B, 12.10.2026). Ohne Banner (962 Titel, `listen/luecken/banner.md`) trägt das Cover selbst den Grund:
 * unscharf, einmalig auf diesem einen Element — sonst nirgends im Panel ein `filter` oder `backdrop-filter`.
 */
const PANEL_GRUND = 'to-white dark:to-[#0d1220]'

export function KopfGrund({ banner, cover }: { banner: string | undefined; cover: string | undefined }) {
  const unscharf = !banner
  const bild = banner ?? cover
  return (
    <>
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute bg-cover ${unscharf ? 'inset-[-24px] scale-[1.15] opacity-90 [filter:blur(22px)_saturate(1.1)]' : 'inset-0'}`}
        style={{ backgroundImage: bild ? `url(${bild})` : undefined, backgroundPosition: '50% 30%' }}
      />
      {unscharf && <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[rgba(8,12,18,.28)]" />}
      <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-transparent ${PANEL_GRUND}`} />
    </>
  )
}

const POSTER =
  'pointer-events-auto h-[180px] w-[120px] shrink-0 rounded-xl object-cover shadow-[0_8px_24px_rgba(0,0,0,.35)] ring-2 ring-white min-[512px]:h-[210px] min-[512px]:w-[140px] dark:ring-[#0d1220]'

/** Das ganze Cover, unbeschnitten, als Karte; ragt in das Banner (der Kopf legt sie dorthin). */
export function Posterkarte({ bild, onClick }: { bild: string | undefined; onClick: (e: { target: EventTarget }) => void }) {
  if (!bild) return <div data-poster aria-hidden="true" className={`${POSTER} bg-ak-flaeche-2`} />
  return <img data-poster src={bild} alt="" width={120} height={180} decoding="async" onClick={onClick} className={`${POSTER} cursor-zoom-in`} />
}

/** Der einzige Knopf auf dem Bild: rund, 44 px, oben rechts. */
export function SchliessenKnopf({ onClose, label }: { onClose: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label={label}
      className="absolute right-2 top-2 z-[3] grid size-11 cursor-pointer place-items-center rounded-full bg-[rgba(8,12,18,.72)] text-white transition hover:bg-[rgba(8,12,18,.88)]"
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  )
}
