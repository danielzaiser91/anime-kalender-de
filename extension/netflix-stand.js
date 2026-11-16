/*
  **Der Stand des Briefkastens liegt im Speicher der Erweiterung, nicht im Abruf beim Öffnen** (#4059, 16.11.2026).

  Dialog und Knopf lesen `MELDUNGEN` (melder.js), das aus `chrome.storage.local` gefüllt wird; ein Abruf geschieht nie beim Öffnen
  oder Schließen und nie je Titel. Geholt wird (`akNetflixStand.neu().auffrischen`): von Hand über „↻“, von selbst alle
  `STAND_FRIST_MS` und einmal nach der Übernahme des stündlichen Datenlaufs (`:23`, fertig gegen `:28`) — und nur von **einem** Tab
  (Sperre im Speicher), solange ein Tab eines Anbieters offen ist (der Takt läuft im Inhaltsskript; kein Service Worker, keine neue
  Berechtigung). Der eine Abruf ist der Sammelabruf aus #4058 (`akGemeldetSammel`). Eigene Meldungen trägt `eigene` sofort in den
  Stand ein, ohne Abruf. Lädt vor `melder.js`.

  Nicht enthalten: eine Marke (Hash des Worker-Stands), mit der die Erweiterung vor dem Abruf fragt, ob er sich lohnt — dafür
  bräuchte der Worker eine Zeile, die jede Meldung mitschreibt (Migration und Schreibweg), siehe PR #4059.
*/
const STAND_SCHLUESSEL = 'netflixStand'
const STAND_SPERRE = 'netflixStandSperre'
/** Von selbst höchstens dreimal je Stunde (dazu einmal nach der Übernahme = höchstens vier). */
const STAND_FRIST_MS = 20 * 60 * 1000
const STAND_SPERRE_MS = 60 * 1000
const STAND_MIN_ABSTAND_MS = 5 * 60 * 1000
const STAND_UEBERNAHME_FERTIG_MS = 5 * 60 * 1000
const standAdresse = (reihe) => `https://www.netflix.com/title/${reihe}`
const standUhrzeit = (am) => new Date(am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

/** Ist ein Abruf von selbst fällig? `am`: Zeitpunkt des Stands (ms) oder `null`; `uebernahme(jetzt: Date)` → nächste Übernahme. */
function standFaellig(am, jetzt, uebernahme) {
  if (am == null) return true
  if (jetzt - am < STAND_MIN_ABSTAND_MS) return false
  if (jetzt - am >= STAND_FRIST_MS) return true
  /* Die Übernahme dieser Stunde ist durch (:23 + 5 min), der Stand ist älter: einmal neu. */
  const fertig = uebernahme(new Date(jetzt)).getTime() - 3600000 + STAND_UEBERNAHME_FERTIG_MS
  return jetzt >= fertig && am < fertig
}

/** Der Sammelabruf für alle Reihen, nur von einem Tab. `z`: `{ kontext, jetzt, tab, worker, reihen, abrufen }`; `true` = Stand `reihenStand` (oder `null`: Einzelweg lief). */
async function standSammelHolen(z) {
  const sperre = (await z.kontext.lesen(STAND_SPERRE))?.[STAND_SPERRE]
  if (sperre && sperre.bis > z.jetzt() && sperre.tab !== z.tab) return undefined
  await z.kontext.schreiben({ [STAND_SPERRE]: { tab: z.tab, bis: z.jetzt() + STAND_SPERRE_MS } })
  if ((await z.kontext.lesen(STAND_SPERRE))?.[STAND_SPERRE]?.tab !== z.tab) return undefined
  const reihen = z.reihen()
  const antwort = await globalThis.akGemeldetSammel(z.worker, reihen.map(standAdresse))
  /* `false`: keine Auskunft (429, 5xx, Netz) — der alte Stand bleibt, kein Einzelweg bei gerissenem Deckel. */
  if (antwort === false) return undefined
  if (antwort === null) {
    await Promise.all(reihen.map((r) => z.abrufen(r)))
    return null
  }
  return Object.fromEntries(reihen.map((r) => [r, antwort.get(standAdresse(r)).paare ?? []]))
}

/**
 * `o`: `{ worker, reihen() (Kennungen), merken(reihe, paare), abrufen(reihe) (Einzelweg für einen Worker ohne Sammelroute),
 * geaendert(), uebernahme(Date) → Date, kontext?, jetzt?, tab?, takt? (ms, 0 = keiner) }`. Liest den Stand ein, hört auf Änderungen
 * anderer Tabs und startet den Takt. Ergebnis: `{ laden, auffrischen, eigene, takt, text(), laeuft() }`; auch `akNetflixStand.aktuell`.
 */
function standNeu(o) {
  const kontext = o.kontext ?? globalThis.akKontext
  const jetzt = o.jetzt ?? Date.now
  const tab = o.tab ?? `${jetzt()}-${Math.random().toString(36).slice(2)}`
  let am = null
  let laeuft = false
  let gespeichert = {}

  const einlesen = (stand) => {
    if (!stand || typeof stand !== 'object') return
    am = Math.max(am ?? 0, stand.am ?? 0) || null
    gespeichert = stand.reihen ?? {}
    for (const [reihe, paare] of Object.entries(gespeichert)) o.merken(reihe, paare)
    o.geaendert()
  }

  /** Ein Abruf für alle Reihen; `true`: es kam etwas an. Läuft schon einer (dieser oder ein anderer Tab): `false`, kein zweiter. */
  async function auffrischen() {
    if (laeuft) return false
    laeuft = true
    o.geaendert()
    try {
      const reihenStand = await standSammelHolen({ kontext, jetzt, tab, worker: o.worker, reihen: o.reihen, abrufen: o.abrufen })
      if (reihenStand === undefined) return false
      am = jetzt()
      if (reihenStand === null) return true
      gespeichert = reihenStand
      await kontext.schreiben({ [STAND_SCHLUESSEL]: { am, reihen: reihenStand } })
      for (const [r, paare] of Object.entries(reihenStand)) o.merken(r, paare)
      return true
    } finally {
      await kontext.schreiben({ [STAND_SPERRE]: null })
      laeuft = false
      o.geaendert()
    }
  }

  /** Eine eigene Meldung: sofort in den Stand, ohne Abruf (der Browser ist der einzige Schreiber des Briefkastens). */
  const eigene = (reihe, paare) => {
    if (laeuft) return
    const r = String(reihe)
    const alt = gespeichert[r] ?? []
    const neu = paare.filter((p) => !alt.some((a) => a.nummer === p.nummer && a.staffel === p.staffel && a.folge === p.folge && a.am === p.am))
    if (!neu.length) return
    gespeichert = { ...gespeichert, [r]: [...alt, ...neu] }
    void kontext.schreiben({ [STAND_SCHLUESSEL]: { am: am ?? jetzt(), reihen: gespeichert } })
  }

  const takt = () => {
    if (standFaellig(am, jetzt(), o.uebernahme)) void auffrischen()
  }
  const laden = async () => einlesen((await kontext.lesen(STAND_SCHLUESSEL))?.[STAND_SCHLUESSEL])
  const stand = { laden, auffrischen, eigene, takt, einlesen, text: () => (am ? `Stand von ${standUhrzeit(am)}` : 'noch kein Stand'), laeuft: () => laeuft }
  void laden()
  kontext.beiAenderung?.((aenderung, bereich) => {
    if (bereich === 'local' && aenderung[STAND_SCHLUESSEL]) einlesen(aenderung[STAND_SCHLUESSEL].newValue)
  })
  if (o.takt !== 0) setInterval(takt, o.takt ?? 60000)
  globalThis.akNetflixStand.aktuell = stand
  return stand
}

globalThis.akNetflixStand = { neu: standNeu, faellig: standFaellig, aktuell: null }
