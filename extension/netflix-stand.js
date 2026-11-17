/*
  **Der Stand des Briefkastens liegt im Speicher der Erweiterung, nicht im Abruf beim Öffnen** (#4059, 16.11.2026).

  Dialog und Knopf lesen `MELDUNGEN` (melder.js), das aus `chrome.storage.local` gefüllt wird; ein Abruf geschieht nie beim Öffnen
  oder Schließen und nie je Titel. Geholt wird (`akNetflixStand.neu().auffrischen`): von Hand über „↻“, von selbst alle
  `STAND_FRIST_MS` (20 Minuten; ein Versuch zählt auch, wenn er scheitert) und einmal nach der Übernahme des stündlichen Datenlaufs
  (`:23`, fertig gegen `:28`) — also höchstens vier Abrufe je Stunde — und nur von **einem** Tab (Sperre im Speicher), solange ein Tab
  eines Anbieters offen ist (der Takt läuft im Inhaltsskript; kein Service Worker, keine neue Berechtigung). Der eine Abruf ist der
  Sammelabruf aus #4058 (`akGemeldetSammel`). Eigene Meldungen trägt `eigene` sofort in den Stand ein, ohne Abruf; ein Abruf vereinigt
  die Antwort mit dem Stand und ersetzt ihn nie (die Antwort kann bis 120 s alt sein und eine eigene Meldung noch nicht kennen).

  Nicht enthalten: eine Marke (Hash des Worker-Stands), mit der die Erweiterung vor dem Abruf fragt, ob er sich lohnt — dafür
  bräuchte der Worker eine Zeile, die jede Meldung mitschreibt (Migration und Schreibweg), siehe PR #4069.
*/
const STAND_SCHLUESSEL = 'netflixStand'
const STAND_SPERRE = 'netflixStandSperre'
/** Der letzte Versuch eines beliebigen Tabs (ms), auch ein gescheiterter: sonst holte bei einem Fehler jeder Tab für sich. */
const STAND_VERSUCH = 'netflixStandVersuch'
/** Von selbst höchstens dreimal je Stunde (dazu einmal nach der Übernahme = höchstens vier). */
const STAND_FRIST_MS = 20 * 60 * 1000
const STAND_SPERRE_MS = 60 * 1000
const STAND_MIN_ABSTAND_MS = 5 * 60 * 1000
const STAND_UEBERNAHME_FERTIG_MS = 5 * 60 * 1000
const STAND_ALT_MS = 24 * 60 * 60 * 1000
const standAdresse = (reihe) => `https://www.netflix.com/title/${reihe}`
const standUhrzeit = (am) => new Date(am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

/** „Stand von 20:15“; ist er älter als ein Tag, mit Datum („Stand vom 15.11., 20:15“). */
function standText(am, jetzt) {
  if (!am) return 'noch kein Stand'
  if (jetzt - am < STAND_ALT_MS) return `Stand von ${standUhrzeit(am)}`
  return `Stand vom ${new Date(am).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}, ${standUhrzeit(am)}`
}

/**
 * Ist ein Abruf von selbst fällig? `am`: Zeitpunkt des Stands (ms) oder `null`; `versuch`: Zeitpunkt des letzten Versuchs, auch eines
 * gescheiterten (sonst holte ein Tab bei jedem Fehler jede Minute neu); `uebernahme(jetzt: Date)` → nächste Übernahme.
 */
function standFaellig(am, versuch, jetzt, uebernahme) {
  const letzter = Math.max(am ?? 0, versuch ?? 0)
  if (!letzter) return true
  if (jetzt - letzter < STAND_MIN_ABSTAND_MS) return false
  if (jetzt - letzter >= STAND_FRIST_MS) return true
  /* Die Übernahme dieser Stunde ist durch (:23 + 5 min), Stand und Versuch sind älter: einmal neu. */
  const fertig = uebernahme(new Date(jetzt)).getTime() - 3600000 + STAND_UEBERNAHME_FERTIG_MS
  return jetzt >= fertig && (am ?? 0) < fertig && (versuch ?? 0) < fertig
}

const standPaarSchluessel = (p) => `${p.staffel ?? ''}|${p.nummer}|${p.folge ?? ''}`

/** Zwei Stände vereinigt (je Reihe die Paare beider, das spätere `am` gewinnt); nie ersetzt, kaputte Einträge fallen weg. */
function standVereinige(a, b) {
  const aus = {}
  for (const quelle of [a, b]) {
    for (const [reihe, paare] of Object.entries(quelle && typeof quelle === 'object' ? quelle : {})) {
      if (!Array.isArray(paare)) continue
      const je = (aus[reihe] ??= new Map())
      for (const p of paare) {
        if (!p || !Number.isFinite(Number(p.nummer))) continue
        const k = standPaarSchluessel(p)
        const alt = je.get(k)
        if (!alt || String(p.am ?? '') > String(alt.am ?? '')) je.set(k, p)
      }
    }
  }
  return Object.fromEntries(Object.entries(aus).filter(([, je]) => je.size).map(([reihe, je]) => [reihe, [...je.values()]]))
}

/** Der Sammelabruf für alle Reihen, nur von einem Tab. `z`: `{ kontext, jetzt, tab, worker, reihen, abrufen, einzeln }`; `undefined`: keine Auskunft oder ein anderer Tab holt, `null`: Einzelweg lief. */
async function standSammelHolen(z) {
  const sperre = (await z.kontext.lesen(STAND_SPERRE))?.[STAND_SPERRE]
  if (sperre && sperre.bis > z.jetzt() && sperre.tab !== z.tab) return undefined
  await z.kontext.schreiben({ [STAND_SPERRE]: { tab: z.tab, bis: z.jetzt() + STAND_SPERRE_MS } })
  if ((await z.kontext.lesen(STAND_SPERRE))?.[STAND_SPERRE]?.tab !== z.tab) return undefined
  await z.kontext.schreiben({ [STAND_VERSUCH]: z.jetzt() })
  const reihen = z.reihen()
  const antwort = await globalThis.akGemeldetSammel(z.worker, reihen.map(standAdresse), z.holen)
  /* `false`: keine Auskunft (429, 5xx, Netz) — der alte Stand bleibt, kein Einzelweg bei gerissenem Deckel. */
  if (antwort === false) return undefined
  if (antwort === null) {
    await z.einzeln(() => Promise.all(reihen.map((r) => z.abrufen(r))))
    return null
  }
  return Object.fromEntries(reihen.map((r) => [r, antwort.get(standAdresse(r)).paare ?? []]))
}

/** Schreibt den Stand, vereinigt mit dem im Speicher und mit dessen Zeitpunkt, falls der neuer ist (zwei Schreiber überholen sich nicht). */
async function standSchreiben(kontext, am, reihen) {
  const imSpeicher = (await kontext.lesen(STAND_SCHLUESSEL))?.[STAND_SCHLUESSEL]
  const amSpeicher = Number.isFinite(imSpeicher?.am) ? imSpeicher.am : 0
  await kontext.schreiben({ [STAND_SCHLUESSEL]: { am: Math.max(am ?? 0, amSpeicher) || null, reihen: standVereinige(imSpeicher?.reihen, reihen) } })
}

/** Der letzte Versuch eines beliebigen Tabs (ms), 0 ohne Eintrag. */
async function standGeteilterVersuch(kontext) {
  const v = (await kontext.lesen(STAND_VERSUCH))?.[STAND_VERSUCH]
  return Number.isFinite(v) ? v : 0
}

/** Trägt das Ergebnis eines Abrufs ein: vereinigt mit dem Speicher (andere Tabs, andere Listen) und dem eigenen Stand, nie ersetzt. */
async function standAbrufEintragen(kontext, am, eigen, reihenStand) {
  const imSpeicher = (await kontext.lesen(STAND_SCHLUESSEL))?.[STAND_SCHLUESSEL]?.reihen
  const vereint = standVereinige(standVereinige(imSpeicher, eigen), reihenStand)
  await kontext.schreiben({ [STAND_SCHLUESSEL]: { am, reihen: vereint } })
  return vereint
}

/** Die Sperre gehört dem Tab, der sie hält: ein abgewiesener Tab löscht die eines anderen nicht. */
async function standSperreLoesen(kontext, tab) {
  if ((await kontext.lesen(STAND_SPERRE))?.[STAND_SPERRE]?.tab === tab) await kontext.schreiben({ [STAND_SPERRE]: null })
}

/** Ein Stand, den ein anderer Tab schreibt, kommt über `onChanged` an. */
function standHoeren(kontext, einlesen) {
  kontext.beiAenderung?.((aenderung, bereich) => {
    if (bereich === 'local' && aenderung[STAND_SCHLUESSEL]) einlesen(aenderung[STAND_SCHLUESSEL].newValue)
  })
}

/**
 * `o`: `{ worker, reihen() (Kennungen), merken(reihe, paare), abrufen(reihe) (Einzelweg für einen Worker ohne Sammelroute),
 * geaendert(), uebernahme(Date) → Date, kontext?, jetzt?, tab?, takt? (ms, 0 = keiner), holen? (fetch, nur Tests) }`. Liest den Stand ein, hört auf Änderungen
 * anderer Tabs und startet den Takt. Ergebnis: `{ laden, auffrischen, eigene, takt, text(), laeuft() }`; auch `akNetflixStand.aktuell`.
 */
function standNeu(o) {
  const kontext = o.kontext ?? globalThis.akKontext
  const jetzt = o.jetzt ?? Date.now
  const tab = o.tab ?? `${jetzt()}-${Math.random().toString(36).slice(2)}`
  let am = null
  let versuch = null
  let laeuft = false
  /** Wahr, solange der Abruf selbst `merken` aufruft: das sind keine eigenen Meldungen (kein Schreiben je Reihe). */
  let intern = false
  let gespeichert = {}

  const mitIntern = async (fn) => {
    intern = true
    try {
      return await fn()
    } finally {
      intern = false
    }
  }
  const merkeAlle = (reihen) => {
    intern = true
    try {
      for (const [reihe, paare] of Object.entries(reihen)) o.merken(reihe, paare)
    } finally {
      intern = false
    }
  }

  const einlesen = (stand) => {
    if (!stand || typeof stand !== 'object') return
    const reihen = standVereinige(stand.reihen, {})
    am = Math.max(am ?? 0, Number.isFinite(stand.am) ? stand.am : 0) || null
    gespeichert = standVereinige(gespeichert, reihen)
    merkeAlle(reihen)
    o.geaendert()
  }

  /** Ein Abruf für alle Reihen; `true`: es kam etwas an. Läuft schon einer (dieser oder ein anderer Tab): `false`, kein zweiter. */
  async function auffrischen() {
    if (laeuft) return false
    laeuft = true
    versuch = jetzt()
    o.geaendert()
    try {
      const reihenStand = await standSammelHolen({ kontext, jetzt, tab, worker: o.worker, reihen: o.reihen, abrufen: o.abrufen, einzeln: mitIntern, holen: o.holen })
      if (reihenStand === undefined) return false
      am = jetzt()
      if (reihenStand === null) return true
      gespeichert = await standAbrufEintragen(kontext, am, gespeichert, reihenStand)
      merkeAlle(gespeichert)
      return true
    } finally {
      await standSperreLoesen(kontext, tab)
      laeuft = false
      o.geaendert()
    }
  }

  /** Eine eigene Meldung: sofort in den Stand, ohne Abruf (der Browser ist der einzige Schreiber des Briefkastens); `am` bleibt, wie es ist. */
  const eigene = (reihe, paare) => {
    if (intern) return
    const vereint = standVereinige(gespeichert, { [reihe]: paare })
    if (JSON.stringify(vereint[String(reihe)]) === JSON.stringify(gespeichert[String(reihe)])) return
    gespeichert = vereint
    void standSchreiben(kontext, am, gespeichert)
  }

  /** Der Takt liest zuerst den letzten Versuch aller Tabs, dann entscheidet er. */
  const takt = async () => {
    versuch = Math.max(versuch ?? 0, await standGeteilterVersuch(kontext)) || null
    if (standFaellig(am, versuch, jetzt(), o.uebernahme)) void auffrischen()
  }
  const laden = async () => einlesen((await kontext.lesen(STAND_SCHLUESSEL))?.[STAND_SCHLUESSEL])
  const stand = { laden, auffrischen, eigene, takt, einlesen, text: () => standText(am, jetzt()), laeuft: () => laeuft }
  void laden().catch(() => {})
  standHoeren(kontext, einlesen)
  if (o.takt !== 0) setInterval(takt, o.takt ?? 60000)
  globalThis.akNetflixStand.aktuell = stand
  return stand
}

globalThis.akNetflixStand = { neu: standNeu, faellig: standFaellig, vereinige: standVereinige, text: standText, aktuell: null }
