/**
 * Liest die Laufliste des Status-Workers. Ist das D1-Tageslimit erreicht, antwortet der Worker mit 503, JSON und
 * `Retry-After` (worker/src/auffangnetz.ts); die Cloudflare-Fehlerseite „1101“ (Text oder HTML) deutet auf dasselbe.
 * Das ergibt eine klare Meldung statt eines JSON-Stacktraces; jeder andere Fehler bleibt eine Statuszeile ohne Kontingent-Hinweis.
 */

/** `{ liste }` bei Erfolg, sonst `{ meldung }`. `abruf` ist `fetch` (Tests: Attrappe). */
export async function holeLaeufe(abruf, url) {
  let antwort
  try {
    antwort = await abruf(url)
  } catch (fehler) {
    return { meldung: `Status-Worker nicht erreichbar (${fehler.message}) — nichts aufgeräumt` }
  }
  const text = await antwort.text()
  let daten
  try {
    daten = JSON.parse(text)
  } catch {
    /* Text oder HTML: unten als Fehlerantwort gemeldet */
  }
  if (!antwort.ok || daten === undefined) {
    const kontingent = antwort.status === 503 || text.includes('1101')
    const hinweis = kontingent ? ' (D1-Tageslimit erreicht, Reset 00:00 UTC)' : ''
    return { meldung: `Status-Worker antwortet ${antwort.status}${hinweis} — nichts aufgeräumt` }
  }
  return { liste: Array.isArray(daten) ? daten : (daten.laeufe ?? []), verlauf: daten.verlauf ?? {} }
}

/** `--erledigt <id> --notiz <text>`: `{ laufId, notiz }`, `{}` ohne `--erledigt`, sonst `{ fehler }`. */
export function erledigtArgumente(args) {
  const i = args.indexOf('--erledigt')
  if (i < 0) return {}
  const laufId = args[i + 1]
  if (!laufId || laufId.startsWith('--')) return { fehler: '--erledigt braucht eine lauf_id (steht in <Worker>?verlauf=<Art>).' }
  const j = args.indexOf('--notiz')
  const notiz = (args[j + 1] ?? '').trim()
  if (j < 0 || !notiz || notiz.startsWith('--')) return { fehler: '--erledigt braucht --notiz "<Text>" (z. B. "behoben durch #1690, Nachprüfung 26.10.").' }
  return { laufId, notiz }
}

/** Verlaufseinträge einer Lauf-Art (öffentlicher GET, mit `lauf_id`); `{ laeufe }` oder `{ meldung }`. */
export async function holeVerlauf(abruf, url, art) {
  const ergebnis = await holeLaeufe(abruf, `${url}?verlauf=${encodeURIComponent(art)}&n=50`)
  return ergebnis.meldung ? { laeufe: [], meldung: ergebnis.meldung } : { laeufe: ergebnis.liste }
}

/** Der Eintrag mit genau dieser ID, nur wenn er rot ist (fehler/warnung); sonst `undefined`. */
export function findeRotenLauf(eintraege, laufId) {
  return eintraege.find((e) => String(e.lauf_id) === String(laufId) && (e.zustand === 'fehler' || e.zustand === 'warnung'))
}

/**
 * Lauf-Arten, deren letzter beendeter Lauf rot oder gelb endete. Die Liste `laeufe` führt seit 28.09.2026 nur noch, was
 * läuft (worker/src/lauf.ts); ein roter Lauf steht dort nie, nur im `verlauf` (je Art aufsteigend, neuester zuletzt).
 * `abgebrochen` (der Deploy bricht den vorigen ab) verdeckt keinen Fehler; ein späterer grüner Lauf des Workflows
 * (`letzterGruen`: Workflow -> Zeitpunkt, wie bei `rote` in laeufe-aufraeumen.mjs) hebt die Zeile auf.
 */
export function roteArten(verlauf, letzterGruen = new Map(), jetztMs = Date.now()) {
  const rote = []
  for (const [art, eintraege] of Object.entries(verlauf ?? {})) {
    const letzter = eintraege.findLast((e) => e.z !== 'laeuft' && e.z !== 'abgebrochen')
    if (!letzter || (letzter.z !== 'fehler' && letzter.z !== 'warnung')) continue
    if ((letzterGruen.get(art) ?? '') > letzter.am) continue
    rote.push({ art, zustand: letzter.z, am: letzter.am, stunden: (jetztMs - Date.parse(letzter.am)) / 3_600_000 })
  }
  return rote
}

/**
 * Stunden Stillstand von `public/data` und ob die Grenze gerissen ist. Gemessen an den Commits 10.-17.10.2026: größte Lücke
 * eines gesunden Betriebs rund 6 h (nachts), der Stillstand vom 17.10. dauerte über 11 h; deshalb 8 h statt 3 h.
 */
export const STILLSTAND_GRENZE_STUNDEN = 8
export function stillstand(letzteAenderungIso, jetztMs) {
  const stunden = (jetztMs - Date.parse(letzteAenderungIso)) / 3_600_000
  return { stunden, zuLang: !(stunden <= STILLSTAND_GRENZE_STUNDEN) }
}

/** Zeitpunkt des letzten Commits, der `public/data` berührt (GitHub-API, öffentlich); `undefined`, wenn nicht lesbar. */
export async function letzteDatenAenderung(abruf, repo) {
  try {
    const antwort = await abruf(`https://api.github.com/repos/${repo}/commits?path=public/data&per_page=1`)
    const daten = await antwort.json()
    return daten[0].commit.committer.date
  } catch {
    return undefined
  }
}
