/**
 * Die Titel, über die die Prüflisten der Erweiterung laufen (Netflix, Disney+, Prime).
 *
 * Zwei Bestände, in dieser Reihenfolge: der Hauptbestand (`titles.json`) und die Cartoons aus TMDB
 * (`cartoons.json`, Kennung negativ). Beide tragen Anbieter-Pillen; bei den Cartoons fehlt jede
 * Sprachangabe, die Pillen haben dort weder Haken noch Folgenzahl (Messung 11.10.2026: 557 von 561
 * Netflix-, Prime- und Disney+-Wegen). Ihre Folgenzahl ist TMDBs Gesamtzahl — wie der Anbieter die
 * Staffeln schneidet, wissen wir nicht, daher der Hinweis am Eintrag (`eintragsInfo`).
 *
 * Gesteuert über `data/pruefliste-regeln.json`: `erweitert` schaltet Cartoons, Folgenzahl-Lücken und
 * Rangordnung zu (Vorgabe: aus, bis Daniel freigibt); `vertrauen`/`ausblenden` blenden später Wege aus,
 * deren Angabe aus einer als vertrauenswürdig geprüften Quelle stammt. `PRUEFLISTE_ERWEITERT=1` schaltet
 * für eine Messung zu, ohne die Datei zu ändern.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const WURZEL = resolve(import.meta.dirname, '..')
const zwischen = new Map()

/** Die Regeln; fehlt die Datei, gilt die Liste wie bisher. */
export function regeln(wurzel = WURZEL) {
  if (zwischen.has(wurzel)) return zwischen.get(wurzel)
  let datei = {}
  try {
    datei = JSON.parse(readFileSync(resolve(wurzel, 'data/pruefliste-regeln.json'), 'utf8'))
  } catch {
    /* Ohne Regeldatei bleibt alles beim Alten. */
  }
  const ergebnis = {
    erweitert: process.env.PRUEFLISTE_ERWEITERT === '1' || datei.erweitert === true,
    vertrauen: datei.vertrauen ?? {},
    ausblenden: datei.ausblenden ?? [],
  }
  zwischen.set(wurzel, ergebnis)
  return ergebnis
}

function lies(wurzel, datei) {
  const roh = JSON.parse(readFileSync(resolve(wurzel, 'public/data', datei), 'utf8'))
  return Array.isArray(roh) ? roh : (roh.titles ?? Object.values(roh))
}

/** Der Hauptbestand. */
export const ladeBestand = (wurzel) => lies(wurzel, 'titles.json')

/** Die Cartoons, als solche gekennzeichnet; leer, solange die Regeln sie nicht zuschalten. */
export const ladeCartoons = (wurzel) =>
  regeln(wurzel).erweitert ? lies(wurzel, 'cartoons.json').map((t) => ({ ...t, cartoon: true })) : []

const ANBIETER_NAME = { netflix: /netflix/i, primevideo: /prime|amazon/i, disneyplus: /disney/i }

/**
 * Woher die Angabe zu diesem Weg stammt: JustWatch nennt den Anbieter mit deutschem Ton, TMDB führt ihn nur auf,
 * der Datensatz trägt ein Urteil. Ohne Urteil (`dub` fehlt) gibt es nichts, dem man trauen könnte: `keine`.
 * `weg` ist der Weg (`{ dub }`), auch ein Listeneintrag mit diesem Feld.
 */
function quelleVon(t, plattform, weg) {
  if (!t.cartoon) return weg.dub === undefined ? 'keine' : 'datensatz'
  const genannt = (t.dubHinweis?.anbieter ?? []).some((n) => ANBIETER_NAME[plattform]?.test(n))
  return genannt ? 'justwatch' : 'tmdb'
}

/**
 * Quelle und Vertrauensstufe der Angabe, dazu die Warnung bei unscharfer Staffelzuordnung
 * (Daniel, 11.10.2026: „Avatar S?“ — unsere Staffel ≠ Staffeln des Anbieters).
 */
function angabe(t, plattform, weg, r) {
  const quelle = quelleVon(t, plattform, weg)
  return { quelle, vertrauen: quelle === 'keine' ? 'ungeprueft' : (r.vertrauen[quelle] ?? 'ungeprueft') }
}

/** Die Felder am Listeneintrag; ohne `erweitert` bleibt der Eintrag, wie er war. */
export function eintragsInfo(t, plattform, weg = {}, r = regeln()) {
  if (!r.erweitert) return {}
  const unscharf = t.cartoon && t.episodes > 1
  return {
    ...angabe(t, plattform, weg, r),
    ...(unscharf
      ? {
          staffelUnscharf: true,
          hinweis: `Staffeln unklar: TMDB zählt ${t.episodes} Folgen insgesamt, der Anbieter kann sie anders schneiden`,
        }
      : {}),
  }
}

/** Soll dieser Weg wegen einer vertrauenswürdigen Quelle nicht auf die Liste? */
export const ausgeblendet = (t, plattform, weg = {}, r = regeln()) => r.erweitert && r.ausblenden.includes(angabe(t, plattform, weg, r).vertrauen)

/**
 * Der Rang eines Titels: Hauptbestand vor Cartoons, darin laufende und aktuelle zuerst, dann neuere vor älteren.
 * Ohne bekanntes Ende gilt ein Hauptbestandstitel als laufend, ein Cartoon als aktuell ab dem Vorjahr.
 */
export function rangVon(t, heute = new Date().toISOString().slice(0, 10)) {
  const jahr = Number(heute.slice(0, 4))
  const aktuell = t.jpEnd ? t.jpEnd >= heute : t.cartoon ? (t.jpYear ?? 0) >= jahr - 1 : true
  return [t.cartoon ? 1 : 0, aktuell ? 0 : 1, -(t.jpYear ?? 0)]
}

const vergleicheRang = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

/** Die Einträge einer Karte `Adresse → [{ t, … }]` in Rang-Reihenfolge (nur erweitert); gleicher Rang behält die Reihenfolge. */
export function nachRang(karte) {
  if (!regeln().erweitert) return [...karte]
  const bester = (eintraege) => eintraege.map((e) => rangVon(e.t)).sort(vergleicheRang)[0]
  return [...karte].sort((a, b) => vergleicheRang(bester(a[1]), bester(b[1])))
}

/** Die Einträge einer fertigen Liste (`[Schlüssel, Eintrag]`) in Rang-Reihenfolge; Netflix-Schlüssel sind Zahlen und behalten sonst ihre Zahlenfolge. */
export function sortiereListe(liste, titel) {
  if (!regeln().erweitert) return liste
  const nachId = new Map(titel.map((t) => [t.id, t]))
  const rang = ([, wert]) =>
    (wert.staffeln ?? wert.eintraege ?? [])
      .map((x) => nachId.get(x.id))
      .filter(Boolean)
      .map((t) => rangVon(t))
      .sort(vergleicheRang)[0] ?? [2, 0, 0]
  return [...liste].sort((a, b) => vergleicheRang(rang(a), rang(b)))
}
