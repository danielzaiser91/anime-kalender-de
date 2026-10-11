import { useEffect } from 'react'
import { teilbarerSlug } from '@shared/teilen.ts'
import { syncSharePath } from '../../lib/router.ts'

/*
  **Ein offener Titel bekommt seinen Teilen-Pfad `/t/<slug>/`** (19.09.2026). Bis dahin
  schrieb nur ein offener Termin einen Pfad in die Adressleiste; wer bei einem Titel die
  Adresse kopierte, teilte `/#/woche?t=…` und Discord zeigte die Startseiten-Vorschau
  (Daniel, an Boruto). Im Panel und nicht in `App.tsx`: Nur das Panel hat den Titel sicher —
  `titleById` wird beim Nachladen erweitert, ohne dass ein Effekt davon erfährt.

  Dieselbe Adresse wie der Teilen-Knopf (`teilbarerSlug`), auch bei Cartoons; Titel ohne
  Teilen-Seite (Katalog ohne Synchro) lassen die Adressleiste.
*/
export function useTeilenAdresse(title: { slug?: string; ohneSynchro?: boolean } | undefined): void {
  const slug = teilbarerSlug(title)
  useEffect(() => {
    if (slug) syncSharePath(slug)
  }, [slug])
}
