/* global DURCHLAUF:readonly */
/*
  **Netflix: was der Kasten tut, ins Zustandsprotokoll** (4.24.22, 10.10.2026)

  Läuft nach `melder.js` und umhüllt dessen Funktionen von außen, damit die Messung `melder.js` nicht
  vergrößert. Jede Umhüllung reicht Aufruf und Ergebnis unverändert durch; ein Fehler beim Aufzeichnen
  wird verschluckt, nie weitergegeben. Der Puffer selbst steht in `protokoll.js`. Die Namen tragen
  `nfp`, weil alle Skripte einer Seite einen Scope teilen.
*/
const nfpMerk = { nummern: new WeakMap(), zaehler: 0, knopf: '', kasten: null }

/** `[1,2,3,5]` → „1–3, 5". */
function nfpBereiche(nummern) {
  const n = [...new Set(nummern.map(Number).filter(Number.isFinite))].sort((a, b) => a - b)
  const raus = []
  for (let i = 0; i < n.length; ) {
    let j = i
    while (n[j + 1] === n[j] + 1) j++
    raus.push(j > i ? `${n[i]}–${n[j]}` : String(n[i]))
    i = j + 1
  }
  return raus.join(', ')
}

/** Der Stand, an dem der Knopf hängt: Folgenliste, Gemeldet-Menge, Lauf. */
function nfpLage() {
  const folgen = DURCHLAUF.folgen ?? []
  const gemeldet = DURCHLAUF.gemeldet ?? new Set()
  return {
    reihe: String(globalThis.gemeinteReihe?.() ?? ''),
    folgen: folgen.length,
    alle: (DURCHLAUF.alleFolgen ?? []).length,
    nummern: nfpBereiche(folgen.map((f) => f.nummer)),
    ersteId: folgen[0]?.videoId ?? null,
    letzteId: folgen[folgen.length - 1]?.videoId ?? null,
    gemeldet: nfpBereiche(folgen.filter((f) => gemeldet.has(f.videoId)).map((f) => f.nummer)),
    gemeldetMenge: gemeldet.size,
    laeuft: Boolean(DURCHLAUF.laeuft),
    abbruch: Boolean(DURCHLAUF.abbruch),
    stoerung: DURCHLAUF.stoerung ?? null,
    randOffen: Boolean(DURCHLAUF.randOffen),
  }
}

/** Für `netflix-gemeldet.js`: aufzeichnen, ohne dass ein Fehler im Protokoll den Knopf trifft. */
function nfpAufzeichnen(art, daten) {
  try {
    globalThis.akProtokoll?.(art, daten)
  } catch {
    /* Messen darf nie stören. */
  }
}

/** Das Urteil am Lauf-Ende mit allem, woran es scheitern kann (einmal je Lauf, gerufen von `netflix-gemeldet.js`). */
function nfpUrteil(D, reihe, fertig) {
  const offen = D.folgen.filter((f) => !D.gemeldet.has(f.videoId)).map((f) => Number(f.nummer))
  nfpAufzeichnen('lauf-urteil', {
    reihe: String(reihe),
    fertig,
    abbruch: Boolean(D.abbruch),
    stoerung: D.stoerung ?? null,
    randOffen: Boolean(D.randOffen),
    folgen: D.folgen.length,
    ungemeldet: nfpBereiche(offen),
    staffeln: new Set((D.alleFolgen ?? []).map((f) => String(f.seasonId ?? ''))).size,
  })
}

/** Eine laufende Nummer je Element — so erkennt man, dass es neu gebaut wurde. */
function nfpKennung(el) {
  if (!el) return null
  if (!nfpMerk.nummern.has(el)) nfpMerk.nummern.set(el, ++nfpMerk.zaehler)
  return nfpMerk.nummern.get(el)
}

/** Nach jedem Zeichnen des Knopfes: Kasten neu gebaut? Knopf oder Lage anders? Nur Änderungen kommen ins Protokoll. */
function nfpKnopfAufzeichnen() {
  const kasten = nfpKennung(document.querySelector('.ak-netflix-kasten'))
  if (kasten !== nfpMerk.kasten) {
    nfpMerk.kasten = kasten
    globalThis.akProtokoll('kasten', { nr: kasten })
  }
  const daten = {
    ...nfpLage(),
    pfad: location.pathname,
    text: DURCHLAUF.knopf?.textContent ?? null,
    aus: Boolean(DURCHLAUF.knopf?.disabled),
    knopfNr: nfpKennung(DURCHLAUF.knopf),
    knopfImDokument: DURCHLAUF.knopf?.isConnected ?? null,
  }
  const k = JSON.stringify(daten)
  if (k === nfpMerk.knopf) return
  nfpMerk.knopf = k
  globalThis.akProtokoll('knopf', daten)
}

/**
 * Die Funktion `name` aus `melder.js` (globaler Scope) durch eine Umhüllung ersetzen. `vor` und `nach`
 * sehen die Argumente bzw. das Ergebnis; bei einer Promise-Rückgabe läuft `nach` nach dem Auflösen.
 */
function nfpUmhuellen(name, vor, nach) {
  const original = globalThis[name]
  if (typeof original !== 'function') return
  const sicher = (f, ...a) => {
    try {
      f?.(...a)
    } catch {
      /* Messen darf nie stören. */
    }
  }
  const fehler = (e) => {
    sicher(() => globalThis.akProtokoll('fehler', { in: name, fehler: String(e?.message ?? e) }))
    throw e
  }
  globalThis[name] = function (...args) {
    sicher(vor, args)
    const r = original.apply(this, args)
    if (!r || typeof r.then !== 'function') {
      sicher(nach, r, args)
      return r
    }
    return r.then((ok) => {
      sicher(nach, ok, args)
      return ok
    }, fehler)
  }
}

/** Die Folgenliste des Lesers; `melder.js` hat die Nachricht schon verarbeitet, die Lage ist die danach. */
function nfpListeAufzeichnen(e) {
  if (e.source !== window || e.data?.marke !== 'ak-folgenliste') return
  const folgen = Array.isArray(e.data.folgen) ? e.data.folgen : []
  globalThis.akProtokoll('liste', {
    fuerReihe: e.data.fuerReihe ?? null,
    anzahl: folgen.length,
    nummern: nfpBereiche(folgen.map((f) => f.nummer)),
    staffeln: new Set(folgen.map((f) => String(f.seasonId ?? ''))).size,
    ...nfpLage(),
  })
}

/** Eine Antwort des Workers auf eine Meldung: Status und wie viele Einträge des Stapels bestätigt sind. */
function nfpPostAufzeichnen(antwort, anzahl, ms) {
  const kopie = typeof antwort.clone === 'function' ? antwort.clone() : antwort
  const daten = { anzahl, status: antwort.status ?? null, ok: Boolean(antwort.ok), ms }
  Promise.resolve(kopie.json())
    .then((j) => {
      const e = Array.isArray(j?.ergebnisse) ? j.ergebnisse : null
      const fehl = e ? [...new Set(e.filter((x) => !x?.ok).map((x) => x?.status ?? null))] : null
      nfpAufzeichnen('worker-post', { ...daten, bestaetigt: e ? e.filter((x) => x?.ok).length : null, fehlstatus: fehl })
    })
    .catch(() => nfpAufzeichnen('worker-post', { ...daten, bestaetigt: null }))
}

/** Jede Meldung an den Worker ins Protokoll — der Rücksprung hing an einem Stapel, den der Worker nicht bestätigte. */
function nfpFetchUmhuellen() {
  const original = globalThis.fetch
  if (typeof original !== 'function') return
  globalThis.fetch = async function (url, opt) {
    if (opt?.method !== 'POST' || !String(url).endsWith('/pruefung')) return original.call(this, url, opt)
    const t0 = Date.now()
    let anzahl = 1
    try {
      anzahl = JSON.parse(opt.body)?.stapel?.length ?? 1
    } catch {
      /* Keine Zahl, kein Problem. */
    }
    try {
      const antwort = await original.call(this, url, opt)
      try {
        nfpPostAufzeichnen(antwort, anzahl, Date.now() - t0)
      } catch {
        /* Messen darf nie stören. */
      }
      return antwort
    } catch (fehler) {
      nfpAufzeichnen('worker-post', { anzahl, fehler: String(fehler?.message ?? fehler), ms: Date.now() - t0 })
      throw fehler
    }
  }
}

function nfpInstallieren() {
  const log = globalThis.akProtokoll
  if (!log || typeof DURCHLAUF === 'undefined') return
  nfpUmhuellen('durchlaufKnopfZeigen', null, nfpKnopfAufzeichnen)
  nfpUmhuellen('durchlaufStarten', () => log('lauf-start', nfpLage()), () => log('lauf-ende', nfpLage()))
  nfpUmhuellen('durchlaufMelden', null, (ok, [folge]) =>
    log('melden', { nr: folge?.nummer ?? null, id: folge?.videoId ?? null, ok: Boolean(ok) }),
  )
  nfpUmhuellen(
    'randMelden',
    ([folgen, , bis, gemessen]) => log('rand-start', { anzahl: folgen?.length ?? 0, bis, gemessen }),
    (anzahl) => log('rand-ende', { anzahlGemeldet: anzahl, ...nfpLage() }),
  )
  nfpUmhuellen(
    'durchlaufStandLaden',
    ([reihe]) => log('stand-laden', { reihe: String(reihe ?? '') }),
    () => log('stand-geladen', { worker: nfpBereiche([...(DURCHLAUF.gemeldeteNummern ?? [])]), ...nfpLage() }),
  )
  nfpUmhuellen('durchlaufStandVergessen', null, () => log('stand-verworfen', nfpLage()))
  /* Ein Bericht trägt das Protokoll mit (der Merker steht darin als „merker-gelesen“ und „merker-gesetzt“). */
  nfpUmhuellen('nfBericht', null, (bericht) => {
    bericht.zustandsprotokoll = log.liste()
  })
  nfpFetchUmhuellen()
  window.addEventListener('message', nfpListeAufzeichnen)
  log('start', { version: chrome.runtime.getManifest?.().version ?? null, pfad: location.pathname })
}

nfpInstallieren()
