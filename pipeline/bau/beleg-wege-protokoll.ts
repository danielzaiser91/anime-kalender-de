import type { Title } from '../../shared/types.ts'
import { anzeigeName } from '../../shared/titles.ts'
import { adressGleich, adressKern, dubKey, urteilVon, type DubCheck } from '../lib/dub-confirmed.ts'
import type { EntfernterVerweis } from './grundlagen.ts'

type MitWegen = Pick<Title, 'id' | 'titleDe' | 'titleEn' | 'titleRomaji' | 'streams'>

/**
 * Wege, die seit dem vorigen Bestand fehlen, weil ein Handbeleg `available: false` sie verneint (Netflix-Durchgang, Übersicht,
 * jeder Handbeleg): Das Protokoll für die Delta-Wache (`belegWege` in `data/verweise-entfernt.json`). Es zählt, was wirklich aus
 * dem Bestand verschwand, nicht jeden Weg, den eine Quelle neu anlegt und der Bau wieder streicht. Egal, welche Phase ihn
 * entfernt hat (Linkprüfung, aniSearch-, CR-, Prime-Wege): maßgeblich ist der Beleg. Das Gedächtnis `verweise` bleibt unberührt,
 * denn es sperrt Adressen und speist Leser (Wiedervorlage, Lücken-Klassen).
 */
export function belegGestrichen(vorher: readonly MitWegen[], jetzt: readonly MitWegen[], belege: readonly DubCheck[], heute: string): EntfernterVerweis[] {
  const neu = new Map(jetzt.map((t) => [t.id, t]))
  const aus: EntfernterVerweis[] = []
  for (const t of vorher) {
    const nachher = neu.get(t.id)
    if (!nachher) continue
    for (const s of t.streams ?? []) {
      if ((nachher.streams ?? []).some((n) => n.platform === s.platform && adressKern(n.url) === adressKern(s.url))) continue
      const beleg = juengsterBeleg(belege, t, s)
      if (beleg?.available !== false || urteilVon(beleg) !== 'nein') continue
      aus.push({
        titleId: t.id,
        titel: anzeigeName(t),
        plattform: s.platform,
        url: s.url,
        seriesId: null,
        grund: `Handbeleg available: false (${beleg.checkedAt ?? 'ohne Datum'})${beleg.note ? `: ${beleg.note.slice(0, 120)}` : ''}`,
        geprueftAm: beleg.checkedAt ?? null,
        entferntAm: heute,
        letzterWeg: (nachher.streams ?? []).length === 0,
      })
    }
  }
  return aus
}

/** Der jüngste Beleg mit Aussage zu genau diesem Weg; ohne Adresse im Beleg gilt er nur, wenn der Titel dort einen einzigen Weg trug (wie `belegFuer` im Bau). */
function juengsterBeleg(belege: readonly DubCheck[], t: MitWegen, s: { platform: string; url: string }): DubCheck | undefined {
  const einziger = (t.streams ?? []).filter((x) => x.platform === s.platform).length === 1
  return belege
    .filter(
      (b) =>
        dubKey(b.anilistId, b.platform) === dubKey(t.id, s.platform) &&
        (typeof b.dub === 'boolean' || b.available === false) &&
        (b.url ? adressGleich(b.url, s.url) : einziger),
    )
    .sort((a, b) => String(b.checkedAt ?? '').localeCompare(String(a.checkedAt ?? '')))[0]
}
