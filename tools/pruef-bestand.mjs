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
 * Rangordnung zu (seit 11.10.2026 an); `vertrauen`/`ausblenden` blenden später Wege aus,
 * deren Angabe aus einer als vertrauenswürdig geprüften Quelle stammt. `PRUEFLISTE_ERWEITERT=1` bzw. `=0` schaltet
 * für eine Messung zu, ohne die Datei zu ändern. Wege der Cartoon-Stichprobe (`cartoon-jw-stichprobe.mjs`) tragen die
 * Quelle `cartoon-jw-stichprobe` und stehen bei `erweitert` vor allen anderen.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ladeNeinFaelle } from '../pipeline/lib/nein-wiedervorlage-lesen.ts'
import { todayIso } from '../shared/time.ts'

export { brauchtUrteil, wartet } from './offen-erschienen.mjs'

const WURZEL = resolve(import.meta.dirname, '..')
const zwischen = new Map()

/** Die Wege der JustWatch-Stichprobe für Cartoons (`tools/cartoon-jw-stichprobe.mjs`) als Schlüssel `Kennung|Anbieter`. */
function ladeStichprobe(wurzel) {
  try {
    const datei = JSON.parse(readFileSync(resolve(wurzel, 'data/cartoon-jw-stichprobe.json'), 'utf8'))
    return new Set(datei.eintraege.map((e) => `${e.id}|${e.plattform}`))
  } catch {
    return new Set()
  }
}

/** Gehört dieser Cartoon-Weg zur Stichprobe? Nur bei `erweitert` (sonst ist die Menge leer). */
export const inStichprobe = (t, plattform, r = regeln()) => Boolean(t.cartoon && r.stichprobe?.has(`${t.id}|${plattform}`))

/** Die Regeln; fehlt die Datei, gilt die Liste wie bisher. */
export function regeln(wurzel = WURZEL) {
  if (zwischen.has(wurzel)) return zwischen.get(wurzel)
  let datei = {}
  try {
    datei = JSON.parse(readFileSync(resolve(wurzel, 'data/pruefliste-regeln.json'), 'utf8'))
  } catch {
    /* Ohne Regeldatei bleibt alles beim Alten. */
  }
  const erweitert = process.env.PRUEFLISTE_ERWEITERT === '1' || (process.env.PRUEFLISTE_ERWEITERT !== '0' && datei.erweitert === true)
  const ergebnis = {
    erweitert,
    vertrauen: datei.vertrauen ?? {},
    ausblenden: datei.ausblenden ?? [],
    stichprobe: erweitert ? ladeStichprobe(wurzel) : new Set(),
  }
  zwischen.set(wurzel, ergebnis)
  return ergebnis
}

function lies(wurzel, datei) {
  const roh = JSON.parse(readFileSync(resolve(wurzel, 'public/data', datei), 'utf8'))
  return Array.isArray(roh) ? roh : (roh.titles ?? Object.values(roh))
}

/** Die Anbieter, deren Prüfliste die Erweiterung führt. */
const LISTEN_ANBIETER = new Set(['netflix', 'primevideo', 'disneyplus'])

/** Prime-Listen führen Titelseiten (`/gp/video/detail/<ASIN>`); die aniSearch-Form `/dp/<ASIN>?tag=…` wird zu ihr. */
const titelseite = (url) => url.replace(/^https?:\/\/www\.amazon\.de\/dp\/([A-Z0-9]{10})\b.*$/, 'https://www.amazon.de/gp/video/detail/$1')

/**
 * Wege, die ein Nein aus dem Datensatz genommen hat und die neu gemessen werden sollen (`shared/nein-wiedervorlage.ts`).
 * Die Listen gehen von den Wegen eines Titels aus; ohne den Weg käme das Nein nie wieder vor. Der Weg trägt sein Nein
 * (`dub: false`) und die Adresse aus Beleg oder Gedächtnis; wie ein Verdachtsfall steht er trotz Urteil auf der Liste.
 */
function mitNeinWegen(titel, wurzel) {
  const faelle = ladeNeinFaelle(wurzel).filter((f) => f.url && LISTEN_ANBIETER.has(f.platform))
  return titel.map((t) => {
    const neu = faelle.filter((f) => f.titleId === t.id && !(t.streams ?? []).some((s) => s.platform === f.platform))
    if (!neu.length) return t
    return { ...t, streams: [...(t.streams ?? []), ...neu.map((f) => ({ platform: f.platform, url: titelseite(f.url), dub: false }))] }
  })
}

/** Der Hauptbestand, dazu die Wege mit einem Nein, das neu gemessen werden soll. */
export const ladeBestand = (wurzel) => mitNeinWegen(lies(wurzel, 'titles.json'), wurzel)

/** Die Cartoons, als solche gekennzeichnet; leer, solange die Regeln sie nicht zuschalten. */
export const ladeCartoons = (wurzel) =>
  regeln(wurzel).erweitert ? lies(wurzel, 'cartoons.json').map((t) => ({ ...t, cartoon: true })) : []

const ANBIETER_NAME = { netflix: /netflix/i, primevideo: /prime|amazon/i, disneyplus: /disney/i }

/**
 * Woher die Angabe zu diesem Weg stammt: JustWatch nennt den Anbieter mit deutschem Ton, TMDB führt ihn nur auf,
 * der Datensatz trägt ein Urteil. Ohne Urteil (`dub` fehlt) gibt es nichts, dem man trauen könnte: `keine` — außer bei
 * `dubQuelle: 'justwatch'` (JustWatch nennt „de“ an genau der Seite des Wegs, jeder Anbieter, `pipeline/lib/jw-seite.ts`;
 * mit `dubHintOnly` nur Hinweis): `justwatch-regel`. `weg` ist der Weg (`{ dub, dubQuelle }`), auch ein Listeneintrag mit diesen Feldern.
 */
function quelleVon(t, plattform, weg) {
  if (!t.cartoon) {
    if (weg.dub !== undefined) return 'datensatz'
    return weg.dubQuelle === 'justwatch' ? 'justwatch-regel' : 'keine'
  }
  const genannt = (t.dubHinweis?.anbieter ?? []).some((n) => ANBIETER_NAME[plattform]?.test(n))
  return genannt ? 'justwatch' : 'tmdb'
}

/**
 * Quelle und Vertrauensstufe der Angabe, dazu die Warnung bei unscharfer Staffelzuordnung
 * (Daniel, 11.10.2026: „Avatar S?“ — unsere Staffel ≠ Staffeln des Anbieters).
 */
function angabe(t, plattform, weg, r) {
  const quelle = inStichprobe(t, plattform, r) ? 'cartoon-jw-stichprobe' : quelleVon(t, plattform, weg)
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
 * `vorn` (Weg der JustWatch-Stichprobe) steht vor allem anderen, damit Daniel die 100 zuerst abarbeitet.
 */
export function rangVon(t, heute = todayIso(), vorn = false) {
  if (vorn) return [-1, 0, -(t.jpYear ?? 0)]
  const jahr = Number(heute.slice(0, 4))
  const aktuell = t.jpEnd ? t.jpEnd >= heute : t.cartoon ? (t.jpYear ?? 0) >= jahr - 1 : true
  return [t.cartoon ? 1 : 0, aktuell ? 0 : 1, -(t.jpYear ?? 0)]
}

const vergleicheRang = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

/** Die Einträge einer Karte `Adresse → [{ t, … }]` in Rang-Reihenfolge (nur erweitert); gleicher Rang behält die Reihenfolge. */
export function nachRang(karte, plattform) {
  if (!regeln().erweitert) return [...karte]
  const rang = (e) => rangVon(e.t, undefined, inStichprobe(e.t, plattform))
  const bester = (eintraege) => eintraege.map(rang).sort(vergleicheRang)[0]
  return [...karte].sort((a, b) => vergleicheRang(bester(a[1]), bester(b[1])))
}

/** Die Einträge einer fertigen Liste (`[Schlüssel, Eintrag]`) in Rang-Reihenfolge; Netflix-Schlüssel sind Zahlen und behalten sonst ihre Zahlenfolge. */
export function sortiereListe(liste, titel, plattform) {
  if (!regeln().erweitert) return liste
  const nachId = new Map(titel.map((t) => [t.id, t]))
  const rang = ([, wert]) =>
    (wert.staffeln ?? wert.eintraege ?? [])
      .map((x) => nachId.get(x.id))
      .filter(Boolean)
      .map((t) => rangVon(t, undefined, inStichprobe(t, plattform)))
      .sort(vergleicheRang)[0] ?? [2, 0, 0]
  return [...liste].sort((a, b) => vergleicheRang(rang(a), rang(b)))
}
