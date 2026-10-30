/**
 * Eine Seite, die schon als Watchlink im vorigen Bestand stand, ist kein neuer Anbieter (30.10.2026, Food Wars Fourth Plate).
 *
 * Wird ein Watchlink zum Stream mit deutscher Tonspur (Zuordnungsänderung, neuer Beleg), entsteht in `baueNews` (Abschnitt 1b)
 * ein Schlüssel `<Titel>:<Anbieter>`, den das Gedächtnis noch nicht kennt: „weiterer Anbieter“ mit dem Bautag. Die Aussage wäre
 * falsch, die Seite war längst da. Dieser Schritt trägt den Altbestand (`'0000-00-00'`) vor dem Bau der News ein — wie der Bau
 * es für jeden schon geführten Weg tut. Bestehende Meldungen bleiben unberührt.
 */
import type { Title } from '../../shared/types.ts'
import { anbieterMitDeutsch, meldetNeu, type NewsHistorie } from './news.ts'

/** Eine Adresse ohne Anhang, Schlussstrich und Groß-/Kleinschreibung: so vergleicht der Bau zwei Fassungen derselben Seite. */
export function adresseVergleich(url: string): string {
  try {
    const u = new URL(url)
    return `${u.host}${u.pathname}`.replace(/\/+$/, '').toLowerCase()
  } catch {
    return url.trim().toLowerCase()
  }
}

/** Alle Watchlink-Adressen des vorigen Bestands (`public/data/titles.json`), egal bei welchem Titel. */
export function vorigeWatchAdressen(vorige: readonly Pick<Title, 'watchLinks'>[]): Set<string> {
  return new Set(vorige.flatMap((t) => (t.watchLinks ?? []).map((w) => adresseVergleich(w.url))))
}

/**
 * Trägt für jeden Weg mit deutschem Ja, dessen Seiten alle schon Watchlinks des vorigen Bestands waren, den Altbestand ein.
 * Ein Weg mit einer neuen Seite bleibt neu. Ohne Gedächtnisfeld `anbieter` sät `baueNews` den ganzen Bestand selbst.
 * Gibt die eingetragenen Schlüssel zurück.
 */
export function traegeAltbestandEin(historie: NewsHistorie, titles: readonly Title[], bekannt: ReadonlySet<string>): string[] {
  const anbieter = historie.anbieter
  if (!anbieter) return []
  const eingetragen: string[] = []
  for (const t of titles) {
    for (const p of anbieterMitDeutsch(t)) {
      const schluessel = `${t.id}:${p}`
      if (schluessel in anbieter) continue
      const seiten = t.streams.filter((s) => meldetNeu(s) && s.platform === p).map((s) => adresseVergleich(s.url))
      if (!seiten.every((a) => bekannt.has(a))) continue
      anbieter[schluessel] = '0000-00-00'
      eingetragen.push(schluessel)
    }
  }
  return eingetragen
}
