import { useEffect, useSyncExternalStore } from 'react'
import { useLang } from '../lib/i18n.tsx'

/** Nach dieser Zeit gibt jeder Platzhalter auf: Der Fuß (Impressum, Datenschutz) darf nie dauerhaft fehlen, auch wenn ein Abruf hängt. */
export const LADEPLATZ_FRIST_MS = 8000
/** Erst danach erscheint „Lädt …“, damit der Hinweis bei schnellem Laden nicht aufblitzt. */
export const LADEPLATZ_HINWEIS_MS = 300

type Phase = 'still' | 'hinweis' | 'aufgegeben'

/*
  Eine Uhr für alle Ladeplätze eines Seitenaufrufs: Wechselt der Platzhalter von der Suspense-Hülle zur Ansicht, läuft sie weiter
  (sonst wären es 16 s statt 8 s, und der Fuß blitzte beim Wechsel auf). Erst wenn kein Ladeplatz mehr steht, beginnt beim nächsten
  Mal wieder von vorn; der Wechsel in einem Zug (ausbauen und einbauen) zählt nicht als „keiner“.
*/
let phase: Phase = 'still'
let nutzer = 0
let zeitgeber: number[] = []
const lauscher = new Set<() => void>()

function setze(neu: Phase): void {
  phase = neu
  lauscher.forEach((l) => l())
}

function anmelden(): () => void {
  nutzer++
  if (zeitgeber.length === 0) {
    zeitgeber = [window.setTimeout(() => setze('hinweis'), LADEPLATZ_HINWEIS_MS), window.setTimeout(() => setze('aufgegeben'), LADEPLATZ_FRIST_MS)]
  }
  return () => {
    nutzer--
    if (nutzer > 0) return
    window.setTimeout(() => {
      if (nutzer > 0) return
      zeitgeber.forEach((h) => window.clearTimeout(h))
      zeitgeber = []
      phase = 'still'
    }, 0)
  }
}

const abonniere = (l: () => void) => {
  lauscher.add(l)
  return () => void lauscher.delete(l)
}

/** Platzhalter für eine nachladende Ansicht; der Fuß bleibt unsichtbar (styles.css), solange er steht, sonst springt er beim Füllen aus dem Bild. */
export function Ladeplatz({ ohneHinweis = false }: { ohneHinweis?: boolean }) {
  const { t } = useLang()
  const p = useSyncExternalStore(abonniere, () => phase, () => 'still' as Phase)
  useEffect(anmelden, [])
  if (p === 'aufgegeben') return null
  return (
    <div className="relative min-h-[60vh]" data-ladeplatz>
      {p === 'hinweis' && !ohneHinweis && (
        <p role="status" className="absolute inset-0 flex items-center justify-center text-sm text-ak-leise">{t('app.laedt')}</p>
      )}
    </div>
  )
}
