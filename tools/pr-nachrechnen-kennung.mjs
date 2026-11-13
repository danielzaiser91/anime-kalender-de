/**
 * Kennungsschnitt im Datenkanal (13.11.2026, F133, Daniel „ja“ 15:25; lockert die Auflage A1/A3 der Prüfer zu PR 3490/3474 und das
 * Restrisiko aus Prüfer 3497): Ein reiner Handdaten-PR (`data/**.yaml`, z. B. dub-confirmed.yaml, curated/*) kippt nicht mit jeder
 * bewegten Datei, die ein Bau-Leser nennt, sondern nur, wenn main eine Kennung berührt, die der PR ändert (AniList-ID, Slug/Release-ID,
 * ASIN, gelesen aus den geänderten Zeilen des PR-Diffs und dem ganzen Eintrag, in dem sie liegen: die Kennung steht meist in einer
 * unveränderten Zeile des Eintrags; 13.11.2026 Rückrechnung: 13 von 127 Restfällen ohne das), oder Code des Bau-Pfads bewegt, der die Handdaten verarbeitet. Bewegte
 * Bot-Dateien zählen wie bisher nicht (Entscheidung 10.11.2026: der Bestandsbau prüft nach dem Merge). Fail-closed: keine Kennung
 * lesbar, Git-Fehler, Binärdiff -> die bisherigen Regeln gelten. Bewusste Grenze: Code außerhalb des Bau-Pfads (`pipeline/lib/`, Prüfungen)
 * entwertet nur über seine Nennung der Kennung; Code, der die Handdaten ohne Kennung liest, fällt nicht auf (F133).
 */
import { hunks } from './pr-nachrechnen-hunks.mjs'

const HANDDATEN =/^data\/.+\.ya?ml$/
/** Code des Baus, der die Handdaten verarbeitet (Auftrag F133): Phasen, Hauptbau, Statuslogik. */
export const BAU_PFAD = /^(pipeline\/build\.ts|pipeline\/bau\/.+|shared\/logic\.ts)$/

/** Alle Dateien des PR (ohne die, die kein Leser liest) sind Handdaten-YAML; `ohneLeser` kommt aus der Leser-Regel. */
export function handdatenPr(pr, ohneLeser) {
  const eigene = pr.filter((p) => !ohneLeser(p))
  return eigene.length > 0 && eigene.every((p) => HANDDATEN.test(p))
}

/** Dateien je git-Aufruf (Befehlszeilenlänge unter Windows); mehr gilt als nicht lesbar. */
const MAX_BEWEGT = 200
const SCHLUESSEL =/(?:^|[\s{,-])(anilist\w*|mal(?:id)?|anisearch\w*|[a-z]*Id|id|slug|asin|gti|release[-_]?id)\s*:\s*['"]?([^\s,'"}#\]]+)/gi
const ASIN = /\bB0[0-9A-Z]{8}\b/g
const ANILIST_URL = /anilist\.co\/anime\/(\d+)/g
const KEINE_WERTE = new Set(['true', 'false', 'null', '~'])

/** Kennungen in einer Zeile: Werte von Kennungs-Schlüsseln (Zahlen bei AniList/MAL/aniSearch jeder Länge, sonst ab 3 Zeichen), ASINs, AniList-Adressen. */
export function kennungenInZeile(zeile) {
  const funde = []
  for (const m of zeile.matchAll(SCHLUESSEL)) {
    const kurzErlaubt = /^(anilist|mal|anisearch)/i.test(m[1]) && /^\d+$/.test(m[2])
    if (!KEINE_WERTE.has(m[2].toLowerCase()) && (kurzErlaubt || m[2].length >= 3)) funde.push(m[2])
  }
  for (const re of [ASIN, ANILIST_URL]) for (const m of zeile.matchAll(re)) funde.push(m[1] ?? m[0])
  return funde
}

/** Geänderte Zeilen (`+`/`-`, ohne Dateikopf) einer Unified-Diff-Ausgabe. */
const geaendert = (diff) => diff.split(/\r?\n/).filter((z) => (z.startsWith('+') || z.startsWith('-')) && !z.startsWith('+++') && !z.startsWith('---'))

/** Menge der Kennungen, die der PR-Diff ändert. */
export const kennungenAus = (diff) => new Set(geaendert(diff).flatMap(kennungenInZeile))

/** Beginn eines Eintrags in den Handdaten-YAML: Listenelement oder Schlüssel in Spalte 0 (Kommentare und Leerzeilen nicht). */
const EINTRAG_START = /^(?:-\s|[^\s#])/
/** Mehr Zeilen je Eintrag lesen wir nicht (Datei ohne Eintragsgrenzen). */
const EINTRAG_MAX = 300

/** Kennungen der Einträge, die die Zeilen von..bis (1-basiert) von `text` berühren: die Kennung steht oft in einer unveränderten Zeile des Eintrags. */
export function eintragsKennungen(text, von, bis) {
  const zeilen = text.split(/\r?\n/)
  if (zeilen.length === 0 || von > zeilen.length) return []
  let start = Math.max(Math.min(von, zeilen.length) - 1, 0)
  while (start > 0 && !EINTRAG_START.test(zeilen[start])) start--
  let ende = Math.min(Math.max(bis, von), zeilen.length) - 1
  while (ende + 1 < zeilen.length && !EINTRAG_START.test(zeilen[ende + 1])) ende++
  return zeilen.slice(start, Math.min(ende + 1, start + EINTRAG_MAX)).flatMap(kennungenInZeile)
}

/** Kennungen der geänderten Zeilen und ihrer Einträge; `lies(seite, datei)` liefert den Text der alten ('alt') oder neuen ('neu') Seite. */
export function kennungenMitEintrag(diff, lies) {
  const menge = kennungenAus(diff)
  for (const abschnitt of diff.split(/^diff --git /m).slice(1)) {
    const datei = abschnitt.split('\n')[0].split(' b/').pop()
    for (const h of hunks(abschnitt)) {
      eintragsKennungen(lies('alt', datei), h.alt[0], h.alt[1]).forEach((k) => menge.add(k))
      eintragsKennungen(lies('neu', datei), h.neu[0], h.neu[1]).forEach((k) => menge.add(k))
    }
  }
  return menge
}


const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Erste Kennung, die der main-Diff in einer geänderten Zeile oder im Dateipfad nennt: { kennung, datei } oder null. Ganze Namen nur
 * (`12345` trifft `112345` und `12345-x` nicht), die Dateinamen stehen in den Köpfen `diff --git a/<pfad> b/<pfad>`.
 */
export function ersteNennung(diff, kennungen) {
  if (kennungen.size === 0) return null
  const re = new RegExp(`(?<![\\w-])(${[...kennungen].map(esc).join('|')})(?![\\w-])`)
  let datei = ''
  for (const zeile of diff.split(/\r?\n/)) {
    if (zeile.startsWith('diff --git ')) {
      datei = zeile.split(' b/').pop()
      const m = re.exec(datei)
      if (m !== null) return { kennung: m[1], datei }
    } else if ((zeile.startsWith('+') || zeile.startsWith('-')) && !zeile.startsWith('+++') && !zeile.startsWith('---')) {
      const m = re.exec(zeile)
      if (m !== null) return { kennung: m[1], datei }
    }
  }
  return null
}

/**
 * null = Handdaten-PR bleibt aktuell, sonst der Grund. `bewegt`: bewegte Dateien (Bau-Pfad-Code wird hier gesucht);
 * `kennung`: { kennungen (Set des PR), mainDiff (Text von basis..main der bewegten Nicht-Bot-Dateien) }.
 */
export function kennungsschnitt(bewegt, kennung) {
  const bau = bewegt.find((b) => BAU_PFAD.test(b))
  if (bau !== undefined) return `main bewegte ${bau}, Code des Baus, der die Handdaten des PR verarbeitet`
  if (kennung.kennungen.size === 0) return 'Kennungen der Handdaten-Änderung (AniList-ID, Slug, ASIN) in den geänderten Zeilen nicht lesbar'
  const treffer = ersteNennung(kennung.mainDiff, kennung.kennungen)
  return treffer === null ? null : `main nennt ${treffer.kennung} in ${treffer.datei}, eine Kennung, die der PR ändert`
}

/**
 * Liest über git, was der Kennungsschnitt braucht: PR-Diff der Handdaten (gegen die Merge-Basis) und main-Diff der bewegten Dateien
 * (Kettenbasis..main). Rückgabe { kennungen, mainDiff } oder { fehler } (dann gelten die bisherigen Regeln).
 */
export function kennungsDaten(git, refs, handdaten, bewegt) {
  if (bewegt.length > MAX_BEWEGT) return { fehler: `${bewegt.length} bewegte Dateien, zu viele für einen Aufruf` }
  try {
    git(['fetch', '-q', 'origin', refs.basis])
    const prDiff = git(['diff', '-U0', '--no-renames', `${refs.main}...${refs.kopf}`, '--', ...handdaten])
    const mainDiff = bewegt.length === 0 ? '' : git(['diff', '-U0', '--no-renames', refs.basis, refs.main, '--', ...bewegt])
    if (/^Binary files /m.test(mainDiff)) return { fehler: 'Binärdiff auf main' }
    const basis = git(['merge-base', refs.main, refs.kopf])
    const lies = (seite, datei) => {
      try {
        return git(['show', `${seite === 'alt' ? basis : refs.kopf}:${datei}`])
      } catch {
        return ''
      }
    }
    return { kennungen: kennungenMitEintrag(prDiff, lies), mainDiff }
  } catch (e) {
    return { fehler: String(e.message).split('\n')[0].slice(0, 120) }
  }
}
