/**
 * Einen Knopf einblenden, der die vorhandenen Tonspuren meldet.
 *
 * Warum das kein Scraper ist: Die Seite öffnet Daniel selbst. Diese Erweiterung
 * ruft nichts ab — sie liest, was der Player ohnehin geladen hat, und schickt es
 * erst auf einen Klick weg. `robots.txt` richtet sich an automatische Clients;
 * ein Mensch mit einer Erweiterung ist keiner. Ein Programm, das dieselben
 * Adressen von sich aus abklappert, wäre einer — und deshalb bleibt Netflix für
 * unsere Abrufe gesperrt.
 *
 * Der Ablauf (Daniels Zuschnitt, 21.08.2026): Zeile in der Prüfliste anklicken,
 * Folge öffnen, Knopf drücken, weiter zur nächsten.
 *
 * **Zwei Skripte, eine Aufgabe:** `leser.js` läuft in der Seitenwelt und kommt
 * an `window.netflix`; dieses hier läuft abgeschottet, hat dafür Token und
 * Netzzugriff. Verbunden sind sie über `window.postMessage`.
 */

/**
 * Lebt die Verbindung zur Erweiterung noch?
 *
 * Chrome trennt beim Neuladen der Erweiterung alle laufenden
 * Content-Scripts von ihr. Sie laufen weiter, aber jeder `chrome.*`-Zugriff
 * wirft „Extension context invalidated" (Daniel, 23.08.2026, mit Bild aus
 * der Fehlerkonsole). Das trifft jede offene Seite nach jedem Neuladen.
 *
 * `chrome.runtime.id` ist der zuverlässige Prüfstein: Sie verschwindet mit
 * der Verbindung.
 */
function verbindungLebt() {
  try {
    return Boolean(chrome?.runtime?.id)
  } catch {
    return false
  }
}

/**
 * Ein Speicherzugriff, der einen toten Kontext überlebt.
 *
 * Gibt `null` zurück, statt zu werfen — der Aufrufer entscheidet, was das
 * heißt. Wichtig ist, dass die Oberfläche stehen bleibt und sagen kann, was
 * los ist, statt mitten im Aufbau abzubrechen.
 */
async function speicherLesen(schluessel) {
  if (!verbindungLebt()) return null
  try {
    return await chrome.storage.local.get(schluessel)
  } catch {
    return null
  }
}

async function speicherSchreiben(werte) {
  if (!verbindungLebt()) return false
  try {
    await chrome.storage.local.set(werte)
    return true
  } catch {
    return false
  }
}

const WORKER = 'https://newsletter.animekalender.workers.dev/pruefung'

/**
 * Audiodeskription ist keine Synchronfassung.
 *
 * Netflix führt sie in derselben Liste: „Japanisch – Audiodeskription",
 * „Französisch – Audiodeskription". Das ist eine gesprochene Bildbeschreibung
 * für Blinde, keine Übersetzung. Wer sie mitzählt, hält jede Serie mit deutscher
 * Audiodeskription für synchronisiert.
 */
const IST_BESCHREIBUNG = /audiodeskription|audio description|descriptive/i

/** Deutsch in allen Schreibweisen, die die Anbieter verwenden. */
const IST_DEUTSCH = (code, name) =>
  /^de(-|$)/i.test(String(code ?? '')) || /^deutsch|^german/i.test(String(name ?? '').trim())

// --- Was die Seite gerade hergibt -------------------------------------------

let stand = { spuren: null, reihe: null, folge: null, folgeNr: null, staffel: null, staffeln: null, serientitel: null, titel: '' }
/** Reihen, die in dieser Sitzung schon gemeldet wurden. */
const gemeldet = new Set()
/** Netzfunde, die noch nicht weitergereicht wurden. */
const funde = []

/**
 * Die Titel, bei denen eine Prüfung noch etwas bringt.
 *
 * Daniel am 22.08.2026, während er eine Serie sah: „die extension stört beim
 * gucken und will ich da nicht sehen" — kurz zuvor war ein Befund zu „Heroes"
 * angekommen, einer amerikanischen Serie.
 *
 * Ohne Treffer in dieser Liste bleibt die Erweiterung vollständig still: kein
 * Knopf, keine Meldung, keine Spur auf der Seite. Das ist der Normalfall — 256
 * Titel stehen darin, Netflix führt Zehntausende.
 *
 * Die Liste liegt im Paket (`tools/extension-offene-liste.mjs` erzeugt sie),
 * nicht im Netz: Ein Abruf je Seitenaufruf wäre Last ohne Gewinn, und die
 * Erweiterung wird ohnehin neu geladen, wenn sich etwas ändert.
 */
/**
 * Die Liste liegt als eigenes Content-Script bei und setzt `AK_OFFENE_TITEL`.
 *
 * Der erste Anlauf holte sie per `fetch(chrome.runtime.getURL(…))` — und
 * scheiterte still an Netflix' Sicherheitsregeln: Die Seite lässt keine Abrufe
 * auf `chrome-extension://` zu. Die Erweiterung blieb stumm, kein Knopf, keine
 * Meldung (Daniel, 22.08.2026, mit Bild von netflix.com/browse).
 *
 * Ein Content-Script lädt der Browser dagegen selbst, bevor die Seite etwas
 * dazu sagen kann. `offene-netflix.js` steht im Manifest **vor** dieser Datei,
 * die Liste ist hier also schon da.
 */
const offeneTitel = globalThis.AK_OFFENE_TITEL ?? {}

/**
 * **Welches Werk meint diese Meldung — der Auftrag weiß es, die Adresse nicht.**
 *
 * Anbieter führen denselben Anime unter mehreren Kennungen; Jujutsu Kaisen
 * meldete sich als `title/80237957`, im Datensatz steht `title/81278456`.
 * Findet der Bau die gemeldete Adresse nicht, fällt er auf einen Namensvergleich
 * zurück, der ausdrücklich kein Beleg ist — am 02.09.2026 warteten 36 Meldungen
 * in `daniel-zum-abarbeiten/11-meldungen-ohne-zuordnung.md` auf Daniels
 * Bestätigung, obwohl jede einzelne aus einem Auftrag stammte, der seinen Titel
 * kennt.
 *
 * Gesucht wird **staffelgenau**: Eine Serienseite trägt alle Staffeln unter
 * derselben Adresse, und die Kennung gehört zum Werk, nicht zur Seite. Ohne
 * Staffelangabe wird nur geantwortet, wenn der Auftrag genau ein Werk führt —
 * geraten wird nicht, denn eine falsche Kennung ist schlimmer als keine: Sie
 * sieht aus wie ein Beleg.
 */
function titelIdFuer(reihe, staffelNr) {
  try {
    const staffeln = offeneTitel[String(reihe)]?.staffeln ?? []
    if (!staffeln.length) return null
    if (staffelNr != null) {
      /*
        **Nicht der erste Eintrag der Staffel, sondern der offene.** Bei Haikyu!!
        steht unter Netflix' Staffel 1 zuerst die Hauptstaffel (belegt) und dann
        die OVA (offen). `find()` nahm die Hauptstaffel — ein ✕ an der Pille
        hätte die falsche als „hier nicht vorhanden" gemeldet (11.09.2026).
        Mehrere offene: dann keiner, eine Meldung ohne sicheres Ziel richtet mehr
        Schaden an als der fehlende Knopf.
      */
      const inStaffel = staffeln.filter((st) => Number(st.nr) === Number(staffelNr))
      if (inStaffel.length === 1) return inStaffel[0].id ?? null
      const offene = inStaffel.filter((st) => st.offen)
      return offene.length === 1 ? (offene[0].id ?? null) : null
    }
    const ids = [...new Set(staffeln.map((st) => st.id).filter((x) => x != null))]
    return ids.length === 1 ? ids[0] : null
  } catch {
    return null
  }
}

/**
 * Was Netflix beim Prüfen über seine Staffeln gesagt hat — sofort verwendbar.
 *
 * Die mitgelieferte Liste kennt nur unsere Aufteilung, bis ein Datenlauf die
 * gemeldete übernimmt. Bis dahin standen dort falsche Kürzel: „2e01 2e12" bei
 * Forest of Piano, wo Netflix „2e13" bis „2e24" zählt — die Meldung war
 * richtig, das Zeichen blieb rosa (Daniel, 22.08.2026).
 *
 * Was der Player meldet, wird deshalb hier behalten und schlägt die
 * mitgelieferte Angabe. Wirksam ab der ersten geprüften Folge, ohne Neuladen.
 */
let anbieterStaffeln = {}
/** Wo der Leser die Folgen gefunden hat — nur für den Diagnosebericht. */
let letzteHerkunft = null

/** Die Staffeln eines Titels — was der Anbieter sagte, sonst was wir wissen. */
/**
 * **Passt diese Folgennummer überhaupt in diese Staffel?**
 *
 * Netflix' `Season`-Knoten trägt keine Nummer (gemessen 31.08.2026); der Leser
 * vergibt sie nach der Reihenfolge, in der die Staffeln eintreffen, und die ist
 * nicht die des Anbieters. `staffelnBereinigen()` wirft eine geratene Nummer
 * weg, **solange die Folgennummern durchlaufen** — dann sagt die Nummer selbst,
 * welche Folge gemeint ist. Fängt der Anbieter je Staffel wieder bei 1 an,
 * greift das nicht, und die geratene Nummer geht mit der Meldung raus.
 *
 * Genau das ist am 06.09.2026 bei „Sword Art Online" passiert: 48 Meldungen,
 * darunter eine **S2 E25** — Staffel 2 hat 24 Folgen, die Kombination kann es
 * nicht geben. Gleichzeitig fehlte S1 E25.
 *
 * Der Anbieter liefert die Folgenzahl je Staffel gleich mit
 * (`[{seq:1,folgen:25},{seq:2,folgen:24}]`), also ist die Frage entscheidbar,
 * ohne irgendetwas zu raten:
 *
 * - Die genannte Staffel deckt die Nummer ab → sie bleibt.
 * - Genau **eine** andere deckt sie ab → die gilt; das ist eine Ableitung aus
 *   der Liste des Anbieters, keine Vermutung.
 * - Sonst → `null`. Ohne Staffel ordnet die Pipeline über die Folgennummer zu;
 *   mit falscher Staffel schreibt sie einen falschen Bereich in den Datensatz.
 *   Das ist dieselbe Wahl wie am 31.08.2026, als 132 Meldungen ihre
 *   Staffelnummer verloren haben statt eine berichtigte zu bekommen.
 */
function staffelGeprueft(reihe, nummer, staffel) {
  if (!Number.isFinite(nummer)) return staffel
  const liste = anbieterStaffeln[String(reihe)] ?? stand.staffeln
  if (!Array.isArray(liste) || liste.length < 2) return staffel
  const deckt = (st) => {
    const erste = Number.isFinite(st?.erste) ? st.erste : 1
    const folgen = Number(st?.folgen)
    if (!Number.isFinite(folgen) || folgen < 1) return false
    return nummer >= erste && nummer <= erste + folgen - 1
  }
  const genannt = liste.find((st) => Number(st?.seq) === Number(staffel))
  if (genannt && deckt(genannt)) return staffel
  const passend = liste.filter(deckt)
  if (passend.length === 1) return Number(passend[0].seq)
  return null
}

/**
 * **Die Folgenkennungen bleiben in der Erweiterung.** Der Worker kappt
 * `staffeln` bei 4000 Zeichen; bei One Piece wären es über 20.000, und in den
 * Briefkasten käme abgeschnittenes JSON. Gebraucht werden sie nur hier, auf der
 * Titelseite (`staffelJeFolge()`).
 */
function ohneKennungen(staffeln) {
  return Array.isArray(staffeln) ? staffeln.map(({ ids, ...rest }) => rest) : (staffeln ?? null)
}

/**
 * **Eine Pille je Anbieterstaffel** (Daniel, 11.09.2026, mit Bild: „warum liegt
 * es ausserhalb der s1 pill? das soll bitte in 1 pill alle episoden pro staffel,
 * 1 pill je staffel").
 *
 * Die gerechnete Liste führt je **Titel** einen Eintrag — bei Haikyu!! neun, in
 * Netflix' vier Staffeln einsortiert. Für den Dialog ist das die falsche
 * Einheit: Daniel sieht dort eine Staffel des Anbieters und will wissen, welche
 * Folgen darin durch sind. Neun Pillen für vier Staffeln zerlegen, was auf dem
 * Bildschirm zusammengehört — „S1 ✓ E26" stand neben „S1 E2–25".
 *
 * Gruppiert wird über `nr`, die Anbieterstaffel. Die Spanne reicht von der
 * kleinsten ersten bis zur größten letzten Folge; offen ist die Staffel, sobald
 * **ein** Eintrag darin offen ist. Welche Folgen genau offen sind, braucht der
 * Dialog nicht von hier — er färbt sie nach dem Meldestand.
 *
 * **Der Knopf liest die feine Liste weiter selbst** (`durchlaufAuftrag()`): Er
 * braucht „Episode 26", nicht „Staffel 1". Zwei Fragen, zwei Listen — dieselbe
 * Regel wie in `CLAUDE.md`, „Wer über einen Index zugreift, braucht eine andere
 * Liste als wer rechnet".
 */
function staffelnGruppiert(eintraege) {
  const jeNr = new Map()
  for (const st of eintraege ?? []) {
    const nr = Number(st.nr)
    const erste = Number.isFinite(st.erste) ? st.erste : 1
    const letzte = erste + (st.folgen ?? 0) - 1
    const da = jeNr.get(nr)
    if (!da) {
      jeNr.set(nr, { ...st, nr, erste, letzte, name: st.name, ids: [st.id], offenIds: st.offen ? [st.id] : [] })
      continue
    }
    da.erste = Math.min(da.erste, erste)
    da.letzte = Math.max(da.letzte, letzte)
    da.offen = da.offen || st.offen
    da.film = da.film && st.film
    da.ids.push(st.id)
    if (st.offen) da.offenIds.push(st.id)
  }
  return [...jeNr.values()]
    .sort((a, b) => a.nr - b.nr)
    .map((g) => ({
      nr: g.nr,
      name: g.name,
      erste: g.erste,
      folgen: g.letzte - g.erste + 1,
      film: g.film,
      offen: g.offen,
      /*
        Die Kennung nur, wo sie eindeutig ist: Das ✕ an der Pille meldet
        titelgenau, und bei mehreren Titeln je Staffel wüsste es nicht, welcher.
        Ist genau einer offen, ist er gemeint — die übrigen sind belegt.
      */
      id: g.offenIds.length === 1 ? g.offenIds[0] : g.ids.length === 1 ? g.ids[0] : null,
    }))
}

/**
 * **Drei Zustände je Folge — und eine Stelle, die sie ausrechnet.**
 *
 * Daniel am 11.09.2026, nach einem Tag mit vier Fassungen am selben Knopf:
 * „verbesser und simplifizier die logik … zustände sind schließlich nur:
 * gemeldet (+datum wann zuletzt), zu melden, erneut melden". Und dazu: „das
 * muss übrigens pro episode so implementiert werden … abgeleitete zustände
 * gelten als echte zustände".
 *
 * Bis dahin rechneten Dialog und Knopf je für sich: Der Dialog hielt alles
 * Ungemeldete für offen (aus dem lokalen Speicher `erledigt`), der Knopf las
 * die Prüfliste und den Briefkasten. Bei Haikyu!! zeigte der Knopf „✓ E26
 * geprüft", die Pille daneben „E2–25" offen — beide aus eigener Quelle, beide
 * überzeugt. Daniel: „single source of truth pattern sicherstellen".
 *
 * Jetzt gibt es genau zwei Quellen, und jede sagt nur, was nur sie weiß:
 *
 * | Quelle | sagt |
 * |---|---|
 * | Briefkasten (`?gemeldet=`) | gemeldet, mit Datum der letzten Meldung |
 * | Prüfliste (aus dem Bestand) | zu melden · erneut melden · belegt |
 *
 * `folgeZustand()` führt beide zusammen, und Dialog wie Knopf lesen nur sie.
 * Eine Stichprobe meldet jede abgeleitete Folge einzeln (`randMelden()`), sie
 * steht damit im Briefkasten wie eine gemessene — ohne Sonderfall hier.
 */
const MELDUNGEN = new Map()

/**
 * Was der Briefkasten zu einer Reihe weiß, zusammengeführt, nie ersetzt. Eine
 * Meldung verschwindet dort nicht; wer ersetzt, verliert die Überbrückung nach
 * einem eigenen Klick (CLAUDE.md, „Eine Überbrückung gehört nicht in den
 * Speicher, den sie überbrückt").
 */
function meldungenMerken(reihe, paare) {
  if (!reihe) return
  const r = String(reihe)
  const m = MELDUNGEN.get(r) ?? { jeFolge: new Map(), jePaar: new Map(), jeNummer: new Map() }
  const spaeter = (alt, neu) => (alt === undefined || (neu && neu > alt) ? neu : alt)
  for (const p of paare ?? []) {
    const nr = Number(p.nummer)
    if (!Number.isFinite(nr)) continue
    const am = p.am ? String(p.am) : ''
    /* Nur eine Zahl ist eine Folgenkennung — alles andere wäre geraten. */
    if (p.folge != null && /^\d+$/.test(String(p.folge))) {
      const k = String(p.folge)
      m.jeFolge.set(k, {
        am: spaeter(m.jeFolge.get(k)?.am, am),
        staffel: p.staffelBekannt === false ? null : Number(p.staffel ?? 1),
      })
    }
    if (p.staffelBekannt !== false) {
      const k = `${Number(p.staffel ?? 1)}|${nr}`
      m.jePaar.set(k, spaeter(m.jePaar.get(k), am))
    }
    m.jeNummer.set(nr, spaeter(m.jeNummer.get(nr), am))
  }
  MELDUNGEN.set(r, m)
}

/** Den Briefkasten zu einer Reihe fragen — der Dialog braucht alle, der Knopf eine. */
async function meldungenLaden(reihe) {
  if (!reihe) return
  try {
    const adresse = `https://www.netflix.com/title/${reihe}`
    const antwort = await fetch(`${WORKER}?gemeldet=${encodeURIComponent(adresse)}`, { cache: 'no-store' })
    const daten = await antwort.json()
    meldungenMerken(reihe, Array.isArray(daten.paare) ? daten.paare : [])
  } catch {
    /* Ohne Netz bleibt, was schon bekannt ist. */
  }
}

/**
 * Wie der Anbieter die Reihe teilt: aus dem Player, sonst aus der gerechneten
 * Liste (sie **ist** seine Aufteilung), sonst aus der Liste selbst.
 */
function anbieterAufteilung(reihe) {
  const gespeichert = anbieterStaffeln[String(reihe)] ?? []
  if (gespeichert.length) {
    return gespeichert.map((st) => ({
      nr: Number(st.seq),
      erste: Number.isFinite(st.erste) ? st.erste : 1,
      folgen: Number(st.folgen),
      film: Boolean(st.film),
    }))
  }
  const eintrag = offeneTitel[String(reihe)]
  if (!eintrag) return []
  if (eintrag.laut === 'anbieter-gerechnet') return staffelnGruppiert(eintrag.staffeln)
  return (eintrag.staffeln ?? []).map((st) => ({
    nr: Number(st.nr),
    erste: Number.isFinite(st.erste) ? st.erste : 1,
    folgen: Number(st.folgen),
    film: Boolean(st.film),
  }))
}

/**
 * **Zählt der Anbieter durch, oder fängt jede Staffel bei 1 an?** Nur im
 * zweiten Fall braucht eine Meldung ihre Staffel — bei Kakegurui (zweimal
 * 1–12) machte eine Meldung von S2 E5 sonst S1 E5 zu „gemeldet" (01.09.2026).
 */
function zaehltDurch(reihe) {
  const a = anbieterAufteilung(reihe).filter((st) => !st.film && st.folgen > 0)
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) {
      const ueberlappt = a[i].erste <= a[j].erste + a[j].folgen - 1 && a[j].erste <= a[i].erste + a[i].folgen - 1
      if (ueberlappt) return false
    }
  }
  return true
}

/**
 * Wann eine Folge zuletzt gemeldet wurde — `undefined`: gar nicht. Ein leerer
 * Text heißt gemeldet, aber ohne Datum (ein Worker vor dem 11.09.2026).
 *
 * Die Folgenkennung trifft exakt; Staffel und Nummer sind der Rückfall.
 */
function meldungAm(reihe, staffel, nummer, videoId) {
  const m = MELDUNGEN.get(String(reihe))
  if (!m) return undefined
  if (videoId != null && m.jeFolge.has(String(videoId))) return m.jeFolge.get(String(videoId)).am
  if (zaehltDurch(reihe)) return m.jeNummer.get(Number(nummer))
  return staffel == null ? undefined : m.jePaar.get(`${Number(staffel)}|${Number(nummer)}`)
}

/** Was die Prüfliste zu einer Folge sagt: melden, erneut oder belegt. */
function listenZustand(reihe, staffel, nummer) {
  const eintrag = offeneTitel[String(reihe)]
  const inStaffel = (eintrag?.staffeln ?? []).filter((st) => Number(st.nr) === Number(staffel) && !st.film)
  const deckt = inStaffel.find((st) => {
    const erste = Number.isFinite(st.erste) ? st.erste : 1
    return nummer >= erste && nummer < erste + (st.folgen ?? 0)
  })
  /* Ohne gerechnete Grenzen gilt der eine Eintrag der Staffel für alle ihre Folgen. */
  const st = deckt ?? (inStaffel.length === 1 && eintrag?.laut !== 'anbieter-gerechnet' ? inStaffel[0] : null)
  /* Was die Liste nicht nennt, verlangt sie nicht. */
  if (!st) return { zustand: 'belegt', am: null }
  return { zustand: st.zustand ?? (st.offen ? 'melden' : 'belegt'), am: st.am ?? null, seit: st.seit ?? null }
}

/**
 * **Der eine Zustand einer Folge: `gemeldet`, `melden` oder `erneut`.**
 *
 * - Eine Meldung im Briefkasten macht sie zu `gemeldet`, mit ihrem Datum. Ein
 *   „erneut" löst nur eine Meldung ab, die **nach** der Wiedervorlage kam.
 * - Belegt der Bestand sie, gilt sie ebenfalls als `gemeldet` — mit dem Datum
 *   des Belegs, wo er eines trägt (`ausBestand` sagt, woher).
 * - Sonst gilt, was die Prüfliste verlangt.
 */
function folgeZustand(reihe, staffel, nummer, videoId) {
  const liste = listenZustand(reihe, staffel, nummer)
  const am = meldungAm(reihe, staffel, nummer, videoId)
  if (am !== undefined && (liste.zustand !== 'erneut' || !liste.seit || am > liste.seit)) {
    return { zustand: 'gemeldet', am: am || null }
  }
  if (liste.zustand === 'belegt') return { zustand: 'gemeldet', am: liste.am, ausBestand: true }
  return { zustand: liste.zustand }
}

/** `2026-09-11T…` oder `2026-09-11` → `11.09.` */
function datumKurz(am) {
  const t = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(am ?? ''))
  return t ? `${t[3]}.${t[2]}.` : ''
}

/**
 * Die Auskunft über eine Reihe von Folgen, als Tooltip-Zeilen — dieselben im
 * Dialog und am Knopf, damit beide dasselbe sagen.
 */
function zustandZeilen(zustaende) {
  const zeilen = []
  const jeHerkunft = new Map()
  for (const z of zustaende) {
    if (z.zustand !== 'gemeldet') continue
    const k = z.ausBestand
      ? z.am
        ? `✓ belegt ${datumKurz(z.am)}`
        : '✓ im Bestand belegt'
      : z.am
        ? `✓ gemeldet ${datumKurz(z.am)}`
        : '✓ gemeldet'
    jeHerkunft.set(k, [...(jeHerkunft.get(k) ?? []), z.n])
  }
  for (const [k, n] of jeHerkunft) zeilen.push(`${k}: E${alsBereiche(n).join(', ')}`)
  const melden = zustaende.filter((z) => z.zustand === 'melden').map((z) => z.n)
  const erneut = zustaende.filter((z) => z.zustand === 'erneut').map((z) => z.n)
  if (melden.length) zeilen.push(`zu melden: E${alsBereiche(melden).join(', ')}`)
  if (erneut.length) zeilen.push(`↻ erneut melden: E${alsBereiche(erneut).join(', ')}`)
  return zeilen
}

function staffelnVon(id, eintrag) {
  /*
    **Die gerechnete Liste zuerst — vor der Frage, ob Netflix schon etwas
    gemeldet hat.** Die Zeile stand darunter, und bei „Dorohedoro", „Hi Score
    Girl" und „BAKI-DOU" — Titeln ohne gespeicherte Anbieterzählung — kam
    deshalb die feine Liste zurück: zwei Pillen für Netflix' Staffel 1, genau
    das, was Daniel am 11.09.2026 bei Haikyu!! beanstandet hat.
  */
  if (eintrag.laut === 'anbieter-gerechnet') return staffelnGruppiert(eintrag.staffeln)
  const gemeldet = anbieterStaffeln[String(id)]
  if (!gemeldet?.length) return eintrag.staffeln
  /**
   * **Eine gerechnete Liste kennt die Anbieterzählung schon.**
   *
   * `laut: 'anbieter-gerechnet'` heißt: Die Pipeline hat unsere Titel bereits in
   * die Staffeln des Anbieters einsortiert — `nr` ist **seine** Staffelnummer,
   * `erste` die Folgennummer darin. Bei Haikyu!! sind das neun Einträge in
   * Netflix' vier Staffeln, „Lev ist hier!" als `nr 1, erste 26`.
   *
   * Sie danach durch die Anbieterzählung zu **ersetzen** wirft genau die
   * Auflösung weg, für die gerechnet wurde — und weil die Zuordnung über den
   * **Index** lief (`eintrag.staffeln[i]`), erbte Netflix' Staffel 1 dabei den
   * Offen-Status des zweiten Eintrags. Ergebnis am 10.09.2026: Der Knopf zeigte
   * „nur F2 + F25" statt „Folge 26 prüfen", und die vier offenen Nebenausgaben
   * waren über die Leiste gar nicht erreichbar.
   *
   * **Position gegen Position ist keine Zuordnung** — dieselbe Lehre, die am
   * selben Tag schon die Haikyu-Verweise gekostet hat (CLAUDE.md, „Der Anbieter
   * zählt kumulativ"). Neun Einträge auf vier Staffeln zu legen, indem man sie
   * durchnummeriert, geht nicht auf, und niemand merkt es: Die Liste sieht
   * danach vollständig aus.
   *
   * Das Feld stand seit dem 09.09.2026 in der Datei und wurde nie gelesen.
   * Die Abfrage steht seit dem 11.09.2026 ganz oben in der Funktion.
   */
  /**
   * Die Anbieterzählung übernehmen, den Offen-Status behalten.
   *
   * Der Anbieter sagt, **wie** er teilt — was wir schon geprüft haben, steht
   * nur in unserer Liste. Reicht sie nicht so weit, gilt die Staffel als offen.
   */
  /**
   * **Was außerhalb der Anbieterzählung steht, überlebt sie.**
   *
   * Die Zeile darüber sagt, der Anbieter bestimme die Aufteilung — und das
   * stimmt für seine eigenen Staffeln. Seit dem 09.09.2026 hängt die Prüfliste
   * aber Einträge an, die es bei ihm gar **nicht** als Staffel gibt: OVAs und
   * Specials, die bei uns eigene Titel sind (`ausserhalb: true`). Sie stehen
   * genau deshalb dort, weil die Anbieterzählung sie nicht kennt.
   *
   * Bis 4.17.5 ersetzte die Meldung die Liste vollständig, und damit
   * verschwanden sie. Daniel am 10.09.2026 mit Bild: Bei „Haikyu!!" zeigte der
   * Dialog vier Pillen (S1–S4, Netflix' Zählung), bei „Dorohedoro" und drei
   * weiteren dagegen die Nebenausgabe — dort hatte Netflix noch nichts
   * gemeldet. Vier offene Einträge waren nicht erreichbar.
   *
   * Angehängt statt eingemischt: Die Nebenausgaben tragen Nummern hinter der
   * Anbieterzählung, und ihre Reihenfolge im Dialog soll das auch zeigen.
   */
  const ausserhalb = (eintrag.staffeln ?? []).filter((st) => st?.ausserhalb)
  return [
    ...gemeldet.map((s, i) => ({
      nr: s.seq,
      name: s.name || `Staffel ${s.seq}`,
      folgen: s.folgen,
      erste: s.erste ?? 1,
      // `film` kann aus der Meldung kommen (Netflix nannte weder Staffel noch
      // Folge) oder aus unserem Datensatz.
      film: s.film ?? eintrag.staffeln[i]?.film ?? false,
      offen: eintrag.staffeln[i]?.offen ?? true,
    })),
    ...ausserhalb,
  ]
}

/**
 * Welche Kürzel gehören zu diesen Folgennummern?
 *
 * Der Worker führt die Meldungen als blanke Folgennummern — 1089, 1124, 1156.
 * Der Dialog denkt in Staffelkürzeln („39e1124"). Übersetzt wird über die
 * Staffelgrenzen der Prüfliste, denn nur die kennen jede Staffel; was Netflix
 * gerade geladen hat, ist immer nur eine davon.
 */
function kuerzelFuerNummern(staffeln, nummern) {
  const raus = []
  for (const nummer of nummern) {
    const staffel = staffeln.find(
      (st) => nummer >= (st.erste ?? 1) && nummer < (st.erste ?? 1) + (st.folgen ?? 0),
    )
    if (!staffel) continue
    raus.push(`${staffel.nr}e${String(nummer).padStart(2, "0")}`)
  }
  return raus
}

/**
 * Wann übernimmt der nächste Lauf die Meldungen?
 *
 * `refresh-hourly.yml` läuft zur Minute 23 jeder Stunde und ruft dort
 * `data:pruefungen` auf — das ist der Schritt, der den Briefkasten leert und
 * die Meldungen in den Datensatz schreibt. Danach sind die Titel aus der
 * Prüfliste verschwunden, und genau daran lässt sich ablesen, ob der Lauf
 * seine Arbeit getan hat (Daniel, 26.08.2026).
 *
 * GitHub startet geplante Läufe regelmäßig einige Minuten später als
 * eingetragen; die Zeile sagt deshalb „ab", nicht „um".
 */
function naechsteUebernahme(jetzt = new Date()) {
  const ziel = new Date(jetzt)
  ziel.setSeconds(0, 0)
  ziel.setMinutes(23)
  if (ziel <= jetzt) ziel.setTime(ziel.getTime() + 3600000)
  return ziel
}/**
 * Was zuletzt aus der Liste heraus geöffnet wurde — für zehn Minuten.
 *
 * Der Tab, in dem geklickt wurde, hinterlegt es; `chrome.storage.local` teilen
 * alle Tabs.
 */
let zuletztGeoeffnet = null

/**
 * Steht dieser Titel auf der Liste?
 *
 * **Auch dann, wenn Netflix eine andere Kennung nennt als wir führen.** Bei
 * „Ranma1/2" blieb die Erweiterung stumm: Der Player meldete eine Kennung, die
 * in unserer Liste nicht vorkommt, also galt der Titel als nicht gesucht — und
 * vier Prüfungen gingen verloren, ohne dass irgendwo etwas stand (Daniel,
 * 22.08.2026: „alle gemeldet, alle bleiben weiß").
 *
 * Wer aus der Liste heraus geklickt hat, meint den Titel, den er angeklickt
 * hat. Das zählt.
 */
/**
 * Welche Kennung gemeint ist — unsere, wenn Netflix eine fremde nennt.
 *
 * Kennt die Liste die Kennung des Players, ist sie es. Sonst gilt, was zuletzt
 * aus der Liste heraus geöffnet wurde.
 */
/** Zwei Titel auf ihren Kern bringen, um sie vergleichen zu können. */
function namensKern(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/**
 * Trägt die geöffnete Zeile denselben Namen wie das, was gerade läuft?
 *
 * **Diese Prüfung ist der Unterschied zwischen Hilfe und Schaden.** Ohne sie
 * galt jeder Titel als gesucht, solange irgendwann in den letzten zehn Minuten
 * aus der Liste geklickt worden war — und Daniel bekam eine Meldung zu
 * „Heroes" untergeschoben, während er die Serie einfach ansah (22.08.2026,
 * zum zweiten Mal an diesem Tag).
 *
 * Verglichen werden die Namen ohne Sonder- und Leerzeichen, und es genügt,
 * wenn einer im anderen steckt: Netflix nennt „Ranma1/2 (2024)", unsere Liste
 * „Ranma1/2 (2024)" — aber auch „HAIKYU!!" gegen „Haikyu!! To The Top" soll
 * passen.
 */
function nameStimmt() {
  const eintrag = zuletztGeoeffnet?.id ? offeneTitel[zuletztGeoeffnet.id] : null
  if (!eintrag) return false
  const laufend = namensKern(stand.serientitel || stand.titel)
  const gemeint = namensKern(eintrag.titel)
  if (!laufend || !gemeint) return false
  return laufend.includes(gemeint) || gemeint.includes(laufend)
}

/**
 * Welche Kennung gemeint ist — unsere, wenn Netflix eine fremde nennt.
 *
 * Kennt die Liste die Kennung des Players, ist sie es. Sonst gilt, was zuletzt
 * aus der Liste heraus geöffnet wurde — **aber nur, wenn der Name dazu passt**
 * und der Klick nicht länger als fünf Minuten her ist.
 */
/**
 * **Eine Weiterleitung binnen einer Minute gehört noch zum Klick.**
 *
 * „Pokémon: Blauer Himmel in der Ferne!" liegt bei uns unter `81670593`; wer
 * dort klickt, landet auf `81706101` — „Pokémon: Ultimative Reisen: Die Serie".
 * Das sah nach einem falschen Titel aus, ist aber richtig: Der Titel ist Folge
 * 46a und wird international als Abschluss der 25. Staffel geführt, und genau
 * diese Teilstaffel nennt Netflix im deutschsprachigen Raum so
 * (fernsehserien.de, PokéWiki, 30.08.2026 nachgeschlagen).
 *
 * `nameStimmt()` kann das nicht erkennen — die Namen sind verschieden, und das
 * ist bei einer Folge innerhalb einer Reihe der Normalfall. Dasselbe Problem
 * war bei Disney+ schon gelöst (CLAUDE.md, 26.08.2026): Wer aus der Prüfliste
 * heraus öffnet, hinterlegt, welcher Titel gemeint war, und die Zielseite erbt
 * ihn.
 *
 * **Eine Minute statt fünf**, und nur bei einer *anderen* Kennung: Eine
 * Weiterleitung passiert im selben Atemzug wie der Klick. Was Daniel danach
 * selbst ansteuert, ist keine mehr.
 */
function ausWeiterleitung() {
  try {
    /* Einmal erkannt, gilt sie weiter — auch nach einem Reload. */
    const gemerkt = netflixWeiterleitungen[String(stand.reihe)]
    if (gemerkt && offeneTitel[String(gemerkt)] !== undefined) return true
    /*
      **Dieselbe Frist wie `gemeinteReihe()` — fünf Minuten, nicht eine.**

      Eine Minute war gedacht als „eine Weiterleitung passiert im selben Atemzug
      wie der Klick". Das stimmt für die Weiterleitung, nicht für ihre
      **Erkennung**: Wer die Erweiterung neu lädt, startet `melder.js` neu, und
      der Zeitstempel des Klicks ist dann Minuten alt. Bei Daniel waren es 5,5 —
      die Weiterleitung wurde nie erkannt und konnte deshalb auch nie gemerkt
      werden (30.08.2026, dritter Bericht in Folge).

      Der eigentliche Riegel ist ein anderer und bleibt: Die Adresse muss eine
      **andere** Kennung tragen als der Auftrag. Was Daniel selbst ansteuert,
      trägt seine eigene und fällt nicht darunter.
    */
    /*
      **Eine Weiterleitung führt zu genau einer Seite — nicht zu allen der
      nächsten fünf Minuten.**

      Bis zum 06.09.2026 galt hier nur eine Frist. Wer aus der Liste öffnete und
      danach irgendetwas anderes ansah, vererbte den Auftrag auf **jede** Seite,
      die er in diesem Fenster aufrief — und weil der Vermerk anschließend
      dauerhaft in `netflixWeiterleitungen` landet, blieb die Falschzuordnung
      auch danach stehen.

      Daniel an diesem Abend, auf „The Gentlemen": „wieso kann ich das melden,
      das ist weder auf prüfliste noch ein anime". Er hatte Minuten zuvor einen
      Fate-Auftrag geöffnet; die Serie erbte ihn und hätte eine Meldung unter
      einer fremden Kennung erzeugt.

      Zwei Riegel statt einem:

      - **Einmalig.** Der erste Titel nach dem Klick erbt, danach ist der
        Vermerk verbraucht. Genau ein Sprung ist eine Weiterleitung; der zweite
        ist eine eigene Entscheidung.
      - **Eine Minute.** So lange dauert eine Weiterleitung, nicht fünf — die
        größere Frist stammt aus einem Bericht über einen langsamen Seitenaufbau
        und war für den Erbfall nie gemeint.
    */
    const frisch = Boolean(
      zuletztGeoeffnet?.id &&
        !zuletztGeoeffnet.verbraucht &&
        offeneTitel[zuletztGeoeffnet.id] !== undefined &&
        String(zuletztGeoeffnet.id) !== String(stand.reihe) &&
        Date.now() - (zuletztGeoeffnet.zeit ?? 0) < 60 * 1000,
    )
    if (frisch && stand.reihe) {
      netflixWeiterleitungen = { ...netflixWeiterleitungen, [String(stand.reihe)]: String(zuletztGeoeffnet.id) }
      zuletztGeoeffnet = { ...zuletztGeoeffnet, verbraucht: true, zielReihe: String(stand.reihe) }
      void chrome.storage.local.set({ netflixWeiterleitungen, zuletztGeoeffnet })
    }
    return frisch
  } catch {
    return false
  }
}

function gemeinteReihe() {
  if (stand.reihe && offeneTitel[String(stand.reihe)] !== undefined) return stand.reihe
  /* Eine gemerkte Weiterleitung gilt ohne Frist — sie ändert sich nicht. */
  try {
    const gemerkt = netflixWeiterleitungen[String(stand.reihe)]
    if (gemerkt && offeneTitel[String(gemerkt)] !== undefined) return gemerkt
  } catch {
    /* Vor dem Laden des Speichers gilt der Weg darunter. */
  }
  if (
    zuletztGeoeffnet?.id &&
    offeneTitel[zuletztGeoeffnet.id] !== undefined &&
    /* Dieselbe Minute wie in `ausWeiterleitung` — zwei Fristen für denselben
       Vorgang laufen zwangsläufig auseinander. */
    Date.now() - (zuletztGeoeffnet.zeit ?? 0) < 60 * 1000 &&
    (nameStimmt() || ausWeiterleitung())
  ) {
    return zuletztGeoeffnet.id
  }
  return stand.reihe
}

function istGesucht() {
  if (stand.reihe && offeneTitel[String(stand.reihe)] !== undefined) return true
  return Boolean(
    zuletztGeoeffnet?.id &&
      offeneTitel[zuletztGeoeffnet.id] !== undefined &&
      Date.now() - (zuletztGeoeffnet.zeit ?? 0) < 60 * 1000 &&
      (nameStimmt() || ausWeiterleitung()),
  )
}

/**
 * **Eine geratene Staffelnummer ist schlechter als keine.**
 *
 * Netflix' `Season`-Knoten trägt keine Nummer, nur eine `videoId` (gemessen
 * 31.08.2026). Der Leser vergibt sie deshalb nach der Reihenfolge, in der die
 * Staffeln eintreffen — und die ist nicht die des Anbieters. Bei Black Clover
 * kamen 168 Meldungen an als „St. 2: Folge 1–50, St. 3: 52–101, St. 1: 104–155".
 * Die Folgennummern stimmten alle, die Staffeln keine einzige; im Kasten stand
 * danach „✓ E104–155" neben „E1–103" schwarz, obwohl alles gemeldet war.
 *
 * **Wo die Nummern durchlaufen, wird die Staffel gar nicht gebraucht.** 1 bis
 * 171 ohne Wiederholung sagt selbst, welche Folge gemeint ist; die Zuordnung
 * zu unseren Einträgen macht ohnehin die Pipeline über die Folgennummer.
 * Gebraucht wird sie nur dort, wo der Anbieter je Staffel neu bei 1 anfängt —
 * und genau daran ist der Fall erkennbar.
 */
function staffelnBereinigen(folgen) {
  const nummern = folgen.map((f) => f.nummer).filter((n) => Number.isFinite(n))
  const jeStaffelNeu = nummern.length !== new Set(nummern).size
  if (jeStaffelNeu) return folgen
  return folgen.map((f) => (f.staffel == null ? f : { ...f, staffel: null }))
}

window.addEventListener('message', (e) => {
  if (e.source === window && e.data?.marke === 'ak-folgenliste') {
    /*
      Die Liste gilt für eine Reihe. Passt sie nicht zur Seite, gehört sie
      nicht hierher — beim Wechsel von One Piece zu Kakegurui stand sonst „61
      Folgen prüfen" auf einer Seite mit zwölf.
    */
    if (Array.isArray(e.data.herkunft) && e.data.herkunft.length) letzteHerkunft = e.data.herkunft
    /*
      **Während eines Durchlaufs wird die Liste nicht ausgetauscht.**

      Ein Durchlauf springt für jede Folge in den Player und zurück. Netflix
      wählt auf der Übersicht danach **selbst** eine Staffel aus — die zuletzt
      gesehene, nicht die, aus der der Auftrag stammt. Der Leser schickt dann
      eine neue Folgenliste, und ab da tragen die Folgen die Nummern und
      Staffeln einer anderen Staffel.

      Daniel hat es am 06.09.2026 gesehen und benannt: „bei meldung von s1 e1-25
      ist beim sprung zwischen player und overview von netflix automatisch s2
      ausgewählt worden … darauf darf man sich nicht verlassen." Im Briefkasten
      standen danach 48 Meldungen zu „Sword Art Online", darunter eine **S2
      E25** — Staffel 2 hat 24 Folgen, die Kombination kann es nicht geben —
      während S1 E25 fehlte.

      Die Liste, mit der ein Durchlauf begonnen hat, gilt deshalb bis zu seinem
      Ende. Was Netflix zwischendurch anzeigt, ändert den Auftrag nicht.
    */
    if (DURCHLAUF.laeuft) return
    const hier = String(gemeinteReihe() ?? '')
    const neu =
      e.data.fuerReihe && hier && String(e.data.fuerReihe) !== hier
        ? []
        : Array.isArray(e.data.folgen)
          ? staffelnBereinigen(e.data.folgen)
          : []
    /* Welche Staffel eben dazukam — sie ist die angeklickte, solange die Seite nichts anderes zeigt. */
    const bekannt = new Set((DURCHLAUF.alleFolgen ?? []).map((f) => f.videoId))
    const dazu = neu.find((f) => !bekannt.has(f.videoId))
    if (dazu) DURCHLAUF.zuletztGeladen = dazu.seasonId ?? null
    DURCHLAUF.alleFolgen = neu
    angezeigteFolgenSetzen()
    void durchlaufStandLaden(gemeinteReihe()).then(durchlaufKnopfZeigen)
    durchlaufKnopfZeigen()
    return
  }
  if (e.source !== window) return
  if (e.data?.marke === 'ak-spuren') {
    stand = {
      spuren: e.data.spuren,
      reihe: e.data.reihe,
      folge: e.data.folge,
      folgeNr: e.data.folge_nr ?? e.data.folgeNr ?? null,
      staffel: e.data.staffel ?? null,
      staffeln: e.data.staffeln ?? null,
      serientitel: e.data.serientitel ?? null,
      titel: e.data.titel,
      folgeRoh: e.data.folgeRoh ?? null,
      reiheRoh: e.data.reiheRoh ?? null,
    }
    /*
      **Beide Fälle zeichnet `knopfZeigen()` selbst — hier wird nichts mehr
      entfernt.**

      Bis 3.107 stand hier ein eigenes `knopfEntfernen()` für Titel, die nicht
      auf der Liste stehen. Seit `knopfZeigen()` dort „Steht nicht auf der
      Prüfliste" zeigt, sind das zwei Stellen mit gegensätzlicher Regel: Der
      Sekundentakt baute den Knopf, die nächste Leser-Nachricht riss ihn wieder
      ab. Ergebnis war ein Blinken im Sekundenrhythmus (Daniel, 30.08.2026: „der
      button blinkt, er ist sichtbar für <1sek und nach paar sekunden kommt er
      wieder").

      Der ursprüngliche Zweck bleibt erfüllt — `knopfZeigen()` zeichnet den
      Zustand der **aktuellen** Seite, und ein Knopf des vorigen Titels
      überlebt das nicht.
    */
    knopfZeigen()
    /* Im Player zeichnet `knopfZeigen()` nichts — dort ist das hier zuständig. */
    playerZeigen()
    /*
      Die automatische Meldung beim Abspielen ist seit dem 26.08.2026 aus.
      Gemeldet wird nur noch über den Durchlauf oder von Hand — dann ist immer
      klar, woher eine Meldung stammt.
    */
    // vielleichtSenden()
    return
  }
  if (e.data?.marke === 'ak-netzfund') {
    funde.push(e.data)
    void fundSchicken(e.data)
  }
})

/**
 * Was Netflix im Hintergrund lädt, einmal je Adresse an den Kalender melden.
 *
 * Der Zweck ist eine einzige Frage: Steht in diesen Antworten schon, welche
 * Sprachen eine Reihe hat? Wenn ja, erspart das die Handarbeit — dann liest die
 * Erweiterung beim Öffnen mit, statt dass jemand jede Folge startet.
 * Geschickt werden nur Feldnamen und kurze Fundstellen, nicht die Antwort.
 */
/**
 * **Was auffällt, wird gemeldet — nicht in die Konsole geschrieben.**
 *
 * Daniel am 10.09.2026: „info bringt nix, du liest nix aus der console aus, ich
 * lese auch nix aus … du musst informiert werden über issues." Er hat recht,
 * und der Punkt geht weiter als das eine Log: Jede Diagnose, die in der
 * Browserkonsole endet, ist tote Information. Er schaut dort nicht hin, ich
 * komme nicht daran — sie existiert nur, wenn er zufällig hinsieht und ein Bild
 * schickt.
 *
 * Der Weg ist derselbe, den die Meldungen ohnehin gehen: an den Worker, von
 * dort holt ihn ein Datenlauf ab und legt ihn unter `daniel-zum-abarbeiten/`.
 *
 * **Drei Riegel**, damit der Melder nicht selbst zur Störquelle wird:
 * dieselbe Art je Seite nur einmal pro Sitzung, höchstens zwanzig insgesamt,
 * und jeder Fehler beim Melden bleibt stumm. Ein Fahrtenschreiber, der die
 * Fahrt stört, ist keiner.
 */
const VORFALL_GEMELDET = new Set()
let vorfallZahl = 0
async function vorfallMelden(art, daten = {}) {
  try {
    const schluessel = `${art}|${location.pathname}`
    if (VORFALL_GEMELDET.has(schluessel) || vorfallZahl >= 20) return
    VORFALL_GEMELDET.add(schluessel)
    vorfallZahl++
    const { token } = await chrome.storage.sync.get('token')
    if (!token) return
    await fetch(WORKER.replace('/pruefung', '/vorfall'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
      body: JSON.stringify({
        plattform: 'netflix',
        art,
        url: location.href.split('?')[0],
        version: chrome.runtime?.getManifest?.()?.version ?? null,
        ...daten,
      }),
    })
  } catch {
    /* Ein Vorfallbericht darf nie im Weg stehen. */
  }
}

async function fundSchicken(fund) {
  const { token } = await chrome.storage.sync.get('token')
  if (!token) return
  try {
    await fetch(WORKER.replace('/pruefung', '/netzfund'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
      body: JSON.stringify(fund),
    })
  } catch {
    /* Ein Fundbericht darf nie im Weg stehen. */
  }
}

/**
 * Von selbst melden, sobald alles beisammen ist.
 *
 * Daniels Zuschnitt (22.08.2026): „sobald daten gesammelt, soll die extension
 * die daten abschicken … so beschränkt sich mein manueller aufwand auf link
 * anklicken -> episode auswählen und warten."
 *
 * Beisammen heißt: eine Reihe aus Netflix' Metadaten **und** eine Tonspurliste
 * aus dem Abspieler. Beides trifft ein paar Sekunden nach dem Start ein; bis
 * dahin sagt der Knopf, worauf er wartet.
 *
 * Je Folge wird genau einmal gesendet. Der Schlüssel ist Reihe plus
 * Folgennummer — wer dieselbe Folge noch einmal öffnet, löst nichts aus, wer
 * zur nächsten springt, schon.
 */
const gesendet = new Map()

/**
 * Was eine Meldung eindeutig macht — Reihe, **Staffel** und Folge.
 *
 * Ohne die Staffel trugen Staffel 3 Folge 1 und Staffel 4 Folge 1 denselben
 * Schlüssel. Die zweite galt damit als längst gesendet und ging nie raus,
 * während der Knopf den Erfolgstext der ersten weiterzeigte: „Deutsch gesendet
 * (St. 4, Flg. 1)" stand da, im Briefkasten lag nur Staffel 3 (Daniel,
 * 22.08.2026, mit Bild).
 *
 * Das ist die schlimmste Sorte Fehler: Er meldet Erfolg und tut nichts.
 */
function schluessel() {
  return `${stand.reihe}:${stand.staffel ?? '—'}:${stand.folgeNr ?? '—'}`
}

function vielleichtSenden() {
  /*
    **Auch das Warten gehört auf den Bildschirm.** Zwischen „Player offen" und
    „gemeldet" liegen ein paar Sekunden, in denen die Erweiterung auf die
    Tonspurliste wartet. Ohne ein Zeichen sieht das aus wie nichts.
  */
  if (!stand.reihe || !stand.spuren) {
    /*
      **Erst wenn die Reihe steht, ist klar, ob uns die Folge angeht.** Vorher
      wäre jede Zeile geraten — und im Player einer fremden Serie wäre sie
      schlicht falsch. `playerAnzeige()` prüft das selbst; der Aufruf hier
      trägt nur den Text, auf den gewartet wird.
    */
    playerAnzeige(
      stand.reihe
        ? 'Anime-Kalender: wartet auf die Tonspuren …'
        : 'Anime-Kalender: wartet auf die Folgendaten …',
      'laeuft',
    )
    /*
      **Bleibt es dabei, ist das ein Vorfall.** Fünfundzwanzig Sekunden reichen
      dem Player unter allen bisher gesehenen Bedingungen; danach kommt nichts
      mehr. Ohne diese Meldung bliebe es beim Schweigen — und genau das war der
      Fall, den niemand sehen konnte.
    */
    if (!playerStummFrist) {
      playerStummFrist = setTimeout(() => {
        playerStummFrist = null
        if (stand.reihe && stand.spuren) return
        playerAnzeige(
          stand.reihe
            ? 'Anime-Kalender: keine Tonspuren gelesen — nicht gemeldet'
            : 'Anime-Kalender: keine Folgendaten gelesen — nicht gemeldet',
          'fehler',
        )
        void vorfallMelden('player_stumm', {
          reihe: stand.reihe ?? null,
          folge_nr: stand.folgeNr ?? null,
          staffel: stand.staffel ?? null,
          text: stand.reihe
            ? 'Reihe gelesen, aber binnen 25 Sekunden keine Tonspuren — nichts gemeldet'
            : 'Binnen 25 Sekunden weder Reihe noch Tonspuren gelesen — nichts gemeldet',
        })
      }, 25_000)
    }
    return
  }
  /* Es hat geklappt — die Frist hat sich erledigt. */
  clearTimeout(playerStummFrist)
  playerStummFrist = null
  const k = schluessel()
  if (gesendet.has(k)) return
  gesendet.set(k, 'unterwegs')
  playerAnzeige(`Anime-Kalender: meldet Folge ${stand.folgeNr ?? '?'} …`, 'laeuft')
  void melden({ automatisch: true })
}

// --- Knopf ------------------------------------------------------------------

let knopf = null

function urteil(spuren) {
  const echte = spuren.filter((s) => !IST_BESCHREIBUNG.test(s.name))
  const deutsch = echte.some((s) => IST_DEUTSCH(s.code, s.name))
  return { deutsch, echte }
}

/**
 * Was der Knopf anbietet, hängt davon ab, wo er steht.
 *
 * Drei Lagen, und die mittlere hat gefehlt:
 *
 * 1. **Im Player, Tonspuren gelesen** — melden, was dasteht.
 * 2. **Auf der Titelseite mit Folgen** — hier gibt es nichts zu lesen. Der
 *    Knopf sagt, was zu tun ist, und bleibt untätig. Vorher bot er „als nicht
 *    abrufbar melden" an, und das ist bei einer Reihe mit 24 Folgen schlicht
 *    falsch (Daniel, 22.08.2026, bei „Die Tagebücher der Apothekerin").
 * 3. **Auf einer Titelseite ohne Folgen** — erkennbar an „Erinnern": Netflix
 *    bietet dort nur an, zu benachrichtigen. Das ist ein Befund, und nur dann
 *    ist die Meldung „nicht abrufbar" richtig.
 *
 * Der Abspielknopf taugt nicht als Unterscheidung: Auf Netflix liegt die
 * Titelkarte als Überlagerung über der Startseite, und deren Abspielknopf zählt
 * mit — daran ist die erste Fassung gescheitert.
 */
function keineFolgeVorhanden() {
  const text = document.body.innerText || ''
  return /\bErinnern\b|\bRemind me\b/.test(text)
}

/**
 * Was der Knopf anzeigt — er meldet inzwischen von selbst.
 *
 * Vier Lagen, und keine davon verlangt noch einen Klick, solange alles läuft:
 *
 * 1. **Schon gesendet** — das Ergebnis steht da, damit sichtbar ist, was ankam.
 * 2. **Im Player, Tonspuren gelesen** — wird gerade geschickt.
 * 3. **Titelseite mit Folgen** — hier gibt es nichts zu lesen; der Knopf sagt,
 *    was zu tun ist.
 * 4. **Titelseite ohne Folgen** — erkennbar an „Erinnern". Das ist ein Befund,
 *    und den meldet ein Klick, weil hier nichts von selbst eintrifft.
 */
function beschriftung(spuren) {
  if (!stand.reihe) {
    return { text: 'Über die Titelseite öffnen — sonst fehlt die Reihe', klasse: 'ak-leer', aktiv: false }
  }
  const stand_ = gesendet.get(schluessel())
  if (stand_ && stand_ !== 'unterwegs') {
    const wo = stand.folgeNr ? ` (${stand.staffel && stand.staffeln?.length > 1 ? `St. ${stand.staffel}, ` : ''}Flg. ${stand.folgeNr})` : ''
    return {
      text: stand_ === 'deutsch' ? `Deutsch gesendet${wo} ✓` : `Kein Deutsch gesendet${wo} ✓`,
      klasse: stand_ === 'deutsch' ? 'ak-ja' : 'ak-nein',
      aktiv: false,
    }
  }
  if (!spuren) {
    /**
     * **Schon als tot gemeldet — dann steht das da, kein Knopf.**
     *
     * Daniel am 26.08.2026: „ich hab es 2x gemeldet, ich kann weiterhin melden,
     * warum? da sollte bereits gemeldet oder so stehen."
     *
     * `gesendet` ist eine Map im Speicher der Seite; ein Neuladen leert sie,
     * und der Knopf lud wieder zum Melden ein. Der Vermerk `tot` liegt dagegen
     * im dauerhaften Speicher und überlebt den Reload — er wird jetzt gelesen.
     *
     * Die zweite Meldung war deshalb nicht folgenlos, sondern schlimmer:
     * Sie überschrieb im Briefkasten die erste, und die Zahl in der
     * Statusanzeige rührte sich nicht („ich reporte, reloade, steht weiterhin
     * 10").
     */
    if (istErledigt(gemeinteReihe(), 'tot')) {
      return { text: 'Als nicht abrufbar gemeldet ✓', klasse: 'ak-nein', aktiv: false }
    }
    if (keineFolgeVorhanden()) {
      // Nennt die Seite einen Termin, gehoert er an den Knopf — dann sieht
      // man vor dem Klick, was gemeldet wird.
      const termin = erscheinungsdatum()
      return {
        text: termin
          ? `Noch nicht da — „ab ${termin}" melden`
          : 'Keine Folge da — als nicht abrufbar melden',
        klasse: 'ak-nein',
        aktiv: true,
      }
    }
    /*
      **Kein Hinweis mehr auf die alte Automatik.**

      Daniel am 26.08.2026: „button entfernen, hier läuft es nicht von selbst,
      soll es zumindest nicht, automatische prüfung bei play auch entfernen, es
      soll nur noch mit der neuen logik funktionieren."

      Der Durchlauf über den Knopf ist der Weg. Ein zweiter, der beim Abspielen
      von selbst meldet, macht die Herkunft einer Meldung unklar — und war der
      Grund, warum bei einem Titelwechsel fremde Sprachen ankamen.
    */
    /*
      **Ohne Tonspur gibt es nichts zu melden — aber der Knopf sagt jetzt, wie
      man dahin kommt.**

      Bis zum 26.08.2026 stand hier „Auf Abspielen klicken, dann läuft es von
      selbst", und das war nach dem Abschalten der Automatik falsch: Es lief
      nichts von selbst. Der Hinweis wurde ersatzlos gestrichen — und damit
      verschwand der Knopf auf der Titelseite ganz.

      Für einen **Film** ist das die einzige Stelle, an der jemand steht: Es gibt
      keine Folgenliste, aus der heraus man in den Player käme. Daniel am
      30.08.2026 an „Gintama the Movie 2026" und „Pokémon: Blauer Himmel in der
      Ferne!": „beide titel lassen sich immer noch nicht melden."

      Der neue Text verspricht keine Automatik, er nennt den Weg: Netflix gibt
      seine Tonspuren nur an einer laufenden Wiedergabe heraus (viermal
      gemessen, siehe CLAUDE.md), also muss abgespielt werden. Gemeldet wird
      danach weiterhin von Hand, über diesen Knopf.
    */
    return { text: null, klasse: null, aktiv: false }
  }
  const { deutsch } = urteil(spuren)
  const wo = stand.folgeNr
    ? ` (${stand.staffel && stand.staffeln?.length > 1 ? `St. ${stand.staffel}, ` : ''}Flg. ${stand.folgeNr})`
    : ''
  /*
    **Im Player wird nichts mehr angeboten.**

    Bis zum 26.08.2026 stand hier „Deutsche Tonspur (St. 1, Flg. 1) — wird
    gesendet …" — und das war nach dem Abschalten der Automatik eine
    Falschaussage: Es wurde nichts gesendet. Daniel mit Bild: „das wird
    automatisch bei abspielen von ep 1 eingeblendet, ich hab gesagt diesen
    automatismus raus, nur wenn man es über den button neben limit button macht
    soll es klappen."

    Gemeldet wird über den Durchlauf auf der Titelseite. Ein zweiter Weg im
    Player macht die Herkunft einer Meldung unklar — und war der Grund, warum
    bei einem Titelwechsel einmal fremde Sprachen ankamen.
  */
  void deutsch
  return { text: null, klasse: null, aktiv: false }
}

async function melden({ automatisch = false } = {}) {
  const spuren = stand.spuren
  const ohneFolge = !spuren && keineFolgeVorhanden()
  if (!stand.reihe) return zeigeErgebnis('Kein Titel erkannt — Titelseite öffnen', false)
  if (!spuren && !ohneFolge) return zeigeErgebnis('Erst auf Abspielen klicken', false)

  const { deutsch, echte } = spuren ? urteil(spuren) : { deutsch: false, echte: [] }
  const { token } = await chrome.storage.sync.get('token')
  if (!token) return zeigeErgebnis('Kein Token — Rechtsklick aufs Symbol, dann Optionen', false)

  try {
    const antwort = await fetch(WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
      body: JSON.stringify({
        plattform: 'netflix',
        /**
         * Die Titelseite, nicht die Abspieladresse — danach sucht die Pipeline.
         *
         * **Und die Kennung, unter der wir den Titel führen**, wenn Netflix eine
         * andere nennt: Bei „Ranma1/2" meldete der Player eine Kennung, die
         * unser Datensatz nicht kennt. Die Meldung wäre angekommen und hätte
         * niemandem gehört. Wer aus der Liste heraus geklickt hat, meint den
         * Titel, den er angeklickt hat.
         */
        url: `https://www.netflix.com/title/${gemeinteReihe()}`,
        /* Welches Werk gemeint ist — der Auftrag weiß es, die Adresse nicht. */
        titelId: titelIdFuer(gemeinteReihe(), stand.staffel ?? null),
        sprachen: echte.map((s) => `${s.code}|${s.name}`),
        befund: ohneFolge ? 'weg' : deutsch ? 'dub' : 'kein_dub',
        titel: (stand.titel || '').replace(/\s*-\s*Netflix\s*$/i, '').trim() || null,
        // Die laufende Folge als Beleg, nie als Ersatz fuer die Reihe.
        folge: stand.folge,
        // Die Nummer der laufenden Folge — daraus leitet die Pipeline ab, für
        // welchen Bereich die Auskunft gilt.
        folge_nr: stand.folgeNr,
        staffel: stand.staffel,
        // Wie die Reihe beim Anbieter aufgeteilt ist: je Staffel die Zahl der
        // Folgen. Damit lässt sich eine Meldung später einer unserer Staffeln
        // zuordnen, auch wenn der Anbieter anders einteilt.
        staffeln: ohneKennungen(stand.staffeln),
        /**
         * **Wie viele Folgen der Anbieter überhaupt führt.**
         *
         * „Eyeshield 21" hat 145 Folgen; Netflix zeigt 36. Nach dem Melden
         * standen 1–36 als geprüft in der Liste und 37–145 als offen — obwohl
         * es sie dort gar nicht gibt. Daniel am 31.08.2026: „145 erwartet, 36
         * existieren, was jetzt?"
         *
         * Ohne diese Zahl kann der Bau die beiden Fälle nicht auseinanderhalten:
         * „noch nicht geprüft" und „führt der Anbieter nicht". Der erste ist
         * Arbeit, der zweite eine Auskunft — und beide sehen in der Liste
         * gleich aus.
         *
         * Gezählt wird, was die Folgenliste der Seite hergibt, nicht was wir
         * erwarten. Steht dort nichts, bleibt das Feld leer.
         */
        folgen: DURCHLAUF.folgen.length || undefined,
        serientitel: stand.serientitel,
        /**
         * Der Termin, den Netflix selbst nennt.
         *
         * Steht bei kuenftigen Titeln ueber der Beschreibung, neben dem
         * Erinnern-Knopf. Ohne Jahr: Netflix nennt nur Tag und Monat, weil
         * ein solcher Termin immer voraus liegt.
         */
        erscheint: ohneFolge ? erscheinungsdatum() : undefined,
        notiz: ohneFolge
          ? erscheinungsdatum()
            ? `Noch nicht abrufbar — Netflix nennt „${erscheinungsdatum()}"`
            : 'Titelseite ohne abspielbare Folge — nur „Erinnern"'
          : `${echte.length} Tonspuren, ${spuren.length - echte.length} Audiodeskriptionen`,
      }),
    })
    const daten = await antwort.json().catch(() => ({}))
    if (!antwort.ok) {
      gesendet.delete(schluessel())
      return zeigeErgebnis(daten.error ?? `Fehler ${antwort.status}`, false)
    }
    gemeldet.add(stand.reihe)
    if (stand.folgeNr) {
      meldungenMerken(gemeinteReihe(), [
        {
          nummer: stand.folgeNr,
          staffel: stand.staffel,
          staffelBekannt: stand.staffel != null,
          folge: stand.folge,
          am: new Date().toISOString(),
        },
      ])
    }
    // Für die Übersicht: Diese Folge ist durch. Kein Beleg — der steht im
    // Datensatz —, sondern eine Gedächtnisstütze beim Abarbeiten.
    /**
     * Eine „keine Folge abrufbar"-Meldung trägt keine Folgennummer.
     *
     * Sie fiel deshalb durch `merkeErledigt`, das eine Folge verlangt — Daniel
     * meldete Batman Ninja von der Übersichtsseite und sah den Eintrag
     * unverändert weiß (22.08.2026). Vermerkt wird jetzt dasselbe wie beim
     * Tot-Knopf der Liste: Der Verweis führt zu nichts Abspielbarem.
     */
    if (ohneFolge) void merkeTot(gemeinteReihe())
    else void merkeErledigt(gemeinteReihe(), stand.staffel, stand.folgeNr)
    // Was Netflix über seine Staffeln sagt, gilt ab sofort — nicht erst nach
    // dem nächsten Datenlauf.
    // Unter **unserer** Kennung ablegen, nicht unter Netflix'. Sonst sucht die
    // Liste vergeblich: Bei „Ranma1/2" nennt der Player eine andere, und die
    // Kürzel blieben in unserer Zählung stehen (2e01 statt 2e13).
    const reihe = gemeinteReihe()
    if (stand.staffeln?.length && reihe) {
      anbieterStaffeln[String(reihe)] = stand.staffeln
      void speicherSchreiben({ anbieterStaffeln })
    } else if (reihe && !stand.staffeln && !stand.folgeNr && spuren) {
      /**
       * Weder Staffelliste noch Folgennummer, aber Tonspuren — das ist ein Film.
       *
       * „Pokémon: The Arceus Chronicles" führen wir als Serie mit vier Folgen;
       * bei Netflix ist es ein Film von einer Stunde, und die Liste schickte
       * Daniel zu „1e04", die es dort nicht gibt (22.08.2026). Der Player
       * schweigt in genau diesem Fall zu Staffeln **und** Folgen — daraus lässt
       * sich die Sache ablesen, ohne dass jemand sie melden muss.
       */
      anbieterStaffeln[String(reihe)] = [{ seq: 1, name: 'Film', folgen: 1, erste: 1, film: true }]
      void speicherSchreiben({ anbieterStaffeln })
    }
    gesendet.set(schluessel(), deutsch ? 'deutsch' : 'kein_deutsch')
    /* Die Meldung liegt jetzt im Briefkasten — die Zahl am Knopf muss fallen. */
    void standHolen()
    const kopf = ohneFolge ? 'Als nicht abrufbar gemeldet' : deutsch ? 'Deutsche Tonspur gemeldet' : 'Kein Deutsch gemeldet'
    zeigeErgebnis(kopf, true)
  } catch (err) {
    gesendet.delete(schluessel())
    zeigeErgebnis(`Nicht erreichbar: ${err.message}`, false)
  }
}

/**
 * **Im Player war die Erweiterung unsichtbar — und damit stumm.**
 *
 * Seit dem 22.08.2026 räumt `zeigeUebersicht()` im Player alles ab: „dort ist
 * die Erweiterung unsichtbar". Der Gedanke war richtig — eine Bedienleiste über
 * einem laufenden Video stört. Der Schluss war zu weit: Gemeldet wird **genau
 * hier**, und das Ergebnis ging an `knopf`, den es im Player nicht gibt.
 * `zeigeErgebnis()` fiel also still auf die erste Zeile zurück.
 *
 * Daniel am 10.09.2026, nachdem er eine Folge geöffnet hatte: „player hat sich
 * durch link geöffnet, nix ist weiter passiert. wurde es gemeldet ohne das ich
 * etwas visuell sehe? — wenn ja, dann ist das klarer verstoß gegen offene
 * kommunikation regel." Es war nicht gemeldet, und **auch das** war nicht zu
 * sehen: Zwischen „liest gerade", „fertig" und „gescheitert" konnte er nicht
 * unterscheiden.
 *
 * Die Anzeige ist deshalb klein und oben links, wo Netflix nur den Zurück-Pfeil
 * hat — sie stört nicht, aber sie ist da. Sie verschwindet nicht von selbst:
 * Wer nach zwanzig Sekunden hinsieht, will wissen, was passiert ist.
 */
let playerFeld = null
/** Läuft die Frist, nach der ein stummer Player als Vorfall gilt? */
let playerStummFrist = null

/**
 * **Steht diese Folge auf der Prüfliste?**
 *
 * Daniel am 10.09.2026, nachdem die Anzeige zuerst immer erschien: „im player
 * darf nichts zu sehen sein, was nicht relevant ist, wenn es hier konkret darum
 * geht die episode zu melden, dann ist es ein gewollter zustand, entsprechend
 * darf dort etwas zu sehen sein."
 *
 * Der Schalter ist deshalb nicht die Herkunft des Links, sondern die Sache
 * selbst: `gemeinteReihe()` gibt genau dann eine Reihe zurück, wenn sie in der
 * Prüfliste steht — und nur dann meldet die Erweiterung überhaupt etwas. Wo sie
 * nichts tut, zeigt sie auch nichts.
 *
 * Das deckt beide Wege ab, ohne einen dritten zu erfinden: den Durchlauf, der
 * selbst hinnavigiert, und den Direktlink auf eine Folge, die auf der Liste
 * steht. Beim freien Schauen einer Serie, die wir nicht führen, bleibt der
 * Player leer.
 */
/**
 * **Der Kasten auf der Netflix-Seite — dasselbe Gerüst wie bei Prime.**
 *
 * Daniel am 10.09.2026: „mach so eine schicke extension box ähnlich wie bei
 * prime … am besten selbe extension design auf allen seiten fürs reporten, aber
 * jede seite hat eigenheiten, also eigene melde elemente."
 *
 * Bis dahin schwebten hier drei getrennte Elemente am Bildschirmrand — der
 * Melde-Knopf, die Durchlauf-Leiste und der Übersichts-Knopf. Sie entstanden zu
 * verschiedenen Zeitpunkten, standen übereinander und hatten je eigene
 * Abstände; auf dem Bild vom 10.09.2026 sind es drei Rechtecke in drei
 * Fluchtlinien.
 *
 * Jetzt gilt für alle drei Anbieter derselbe Aufbau (`box.js`), und was Netflix
 * eigen ist, steht in seinen Zeilen: der Durchlauf, der nur hier existiert, und
 * die Staffelwahl, die Prime nicht kennt.
 *
 * **Auf einer Seite ohne Auftrag entsteht er nicht** — dieselbe Regel wie für
 * die Player-Anzeige, und aus demselben Grund: „i am just watching something,
 * there should be no elements from the extension on screen" (30.08.2026).
 */
function netflixKasten() {
  /*
    Der Pfad genügt als Schlüssel: Netflix hängt an eine Titeladresse keine
    Parameter, die den Kasten angingen — anders als Prime, das `ref_` und `qid`
    laufend umschreibt.
  */
  return akBox('ak-netflix-kasten', location.pathname)
}

/**
 * Die Debug-Zeile — Bericht und Ruhemodus, wie bei Prime.
 *
 * Sie stand auf Netflix bisher gar nicht zur Verfügung: Der Bericht hing an
 * einem Ereignis am `document`, und das setzt eine offene Konsole voraus.
 * Daniel am 10.09.2026: „pack dort auch unten ne trennlinie für debug icons
 * rein, und pack dort das ak-report rein."
 */
function netflixDebugZeile(kasten) {
  akDebugLeiste(kasten, [
    {
      an: '⏸',
      aus: '▶',
      text: 'Ruhemodus',
      titel: 'Hintergrundvideo und Animationen anhalten (für Aufnahmen)',
      aktiv: () => document.documentElement?.classList?.contains('ak-ruhig') ?? false,
      schalten: () => document.dispatchEvent(new CustomEvent('ak-ruhig')),
    },
    /*
      Der Bericht hängt seit dem 30.08.2026 an einem Ereignis am Dokument —
      der Knopf löst genau das aus, statt den Weg ein zweites Mal zu bauen.
      Zwei Fassungen desselben Berichts laufen auseinander.
    */
    akBerichtSchalter(() => document.dispatchEvent(new CustomEvent('ak-report'))),
  ])
}

function playerAuftragOffen() {
  /*
    **`?ak=1` in der Adresse ist die zweite Antwort auf dieselbe Frage.**

    `gemeinteReihe()` weiß erst Bescheid, wenn der Player seine Metadaten
    herausgerückt hat — bis dahin vergehen Sekunden, und wenn sie **gar nicht**
    kommen, weiß es die Erweiterung nie. Genau das ist am 10.09.2026 passiert:
    Daniel öffnete Folge 26 über den Direktlink, und es blieb still. Ob die
    Erweiterung wartete, scheiterte oder die Folge für fremd hielt, war von außen
    nicht zu unterscheiden.

    Der Parameter beantwortet es unabhängig davon: Wer ihn setzt, hat die Folge
    **zum Melden** geöffnet — Daniels eigener Vorschlag („du kannst es auch per
    url parameter zB lösen"). Die Aufträge in der Prüfliste tragen ihn seitdem.
  */
  try {
    if (new URLSearchParams(location.search).get('ak')) return true
  } catch {
    /* Ohne lesbare Adresse entscheidet die Prüfliste allein. */
  }
  /*
    **`gemeinteReihe()` beantwortet eine andere Frage — und sagt nie nein.**

    Sie löst auf, **welche** Reihe gemeint ist, und fällt am Ende auf
    `stand.reihe` zurück: die Reihe, die gerade läuft. Als Ja/Nein-Test ist sie
    damit auf **jeder** Player-Seite wahr. Am 10.09.2026 stand deshalb über
    „Heroes", Staffel 3, Folge 17 der Kasten „Folge 17: kein Deutsch gefunden" —
    kein Anime, nicht auf der Prüfliste, Daniel wollte einfach fernsehen: „wieso
    ist die extension hier??? fail."

    Es ist derselbe Titel wie am 30.08.2026 („i am just watching something,
    there should be no elements from the extension on screen") und dieselbe
    Regel — nur an einer zweiten Stelle, die es damals noch nicht gab. Eine
    Regel, die für einen Anzeigeweg aufgeschrieben wurde, gilt nicht von selbst
    für den nächsten.

    `istGesucht()` steht zwanzig Zeilen darüber und stellt genau die richtige
    Frage: Steht die Reihe in `offeneTitel`? Sie war die ganze Zeit da.

    **Die allgemeine Form:** Eine Funktion, die einen Wert **auflöst**, ist kein
    Test. Sie hat einen Rückfall, und ein Rückfall liefert immer etwas — sonst
    wäre er keiner. `Boolean(x())` über einer solchen Funktion ist deshalb
    fast immer `true`.
  */
  try {
    return istGesucht()
  } catch {
    return false
  }
}

/**
 * **Hat der Kasten auf dieser Seite etwas zu suchen?** Eine Regel für den ganzen
 * Kasten, nicht eine je Inhalt.
 *
 * Daniel am 11.09.2026 mit Bild, im Player von „Heroes": „wenn ich von overview
 * zur serie wechsele die nicht in prüfliste der extension ist -> extension
 * verstecken." Die Inhalte des Kastens verschwanden dort alle einzeln — Melde-
 * Knopf, Leiste, Prüflisten-Knopf —, übrig blieb der Rahmen mit der Debug-Zeile.
 * Jede Anzeigestelle hatte ihre Regel, der Kasten selbst keine.
 *
 * - Auf der Stöberseite bleibt er: Dort sitzt der Weg zur Prüfliste.
 * - Im Player gilt, was `playerAuftragOffen()` sagt.
 * - Auf einer Titelseite zählt die Kennung der Seite: Steht sie auf der Liste,
 *   leitet eine gemerkte Weiterleitung dorthin, oder wurde sie eben aus der
 *   Liste heraus geöffnet?
 *
 * Nicht über `gemeinteReihe()`: Sie fällt auf `stand.reihe` zurück, und das ist
 * auf einer Titelseite oft die Reihe der vorigen Seite (CLAUDE.md, „Eine
 * Auflösefunktion ist kein Test").
 */
function seiteGehtUnsAn() {
  if (imPlayer()) return playerAuftragOffen()
  const hier =
    /\/title\/(\d+)/.exec(location.pathname)?.[1] ?? new URLSearchParams(location.search).get('jbv') ?? null
  if (!hier) return true
  if (offeneTitel[hier] !== undefined) return true
  const weiter = netflixWeiterleitungen?.[hier]
  if (weiter && offeneTitel[String(weiter)] !== undefined) return true
  return Boolean(
    zuletztGeoeffnet?.id &&
      offeneTitel[zuletztGeoeffnet.id] !== undefined &&
      Date.now() - (zuletztGeoeffnet.zeit ?? 0) < 60 * 1000,
  )
}

function playerAnzeige(text, art = 'laeuft', knopfText = null) {
  try {
    if (!imPlayer()) return
    if (!playerAuftragOffen()) {
      /* Kein Auftrag, keine Anzeige — und eine schon stehende verschwindet. */
      if (playerFeld?.isConnected) playerFeld.remove()
      playerFeld = null
      return
    }
    if (!playerFeld?.isConnected) {
      playerFeld = document.createElement('div')
      playerFeld.className = 'ak-player-anzeige'
      document.body.appendChild(playerFeld)
    }
    playerFeld.dataset.art = art
    playerFeld.replaceChildren(document.createTextNode(text))
    /*
      **Der Knopf, der im Player gefehlt hat.**

      Die selbsttätige Meldung beim Abspielen ist seit dem 26.08.2026 aus:
      „Gemeldet wird nur noch über den Durchlauf oder von Hand — dann ist immer
      klar, woher eine Meldung stammt." Der Satz stimmt, nur gab es die Hand
      nicht: `zeigeUebersicht()` räumt im Player alles ab, und der Durchlauf
      nimmt Anfang und Ende, nicht eine bestimmte Folge.

      Für einen Auftrag wie „Haikyu!! S1 Folge 26" blieb damit kein Weg. Daniel
      am 10.09.2026, nachdem er die Folge über den Direktlink geöffnet hatte:
      „nix ist weiter passiert."

      Der Knopf ändert daran genau eine Sache — die Meldung bleibt eine bewusste
      Handlung, sie ist nur endlich möglich.
    */
    if (knopfText) {
      const knopfHier = document.createElement('button')
      knopfHier.type = 'button'
      knopfHier.className = 'ak-player-knopf'
      knopfHier.textContent = knopfText
      knopfHier.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        playerAnzeige('Anime-Kalender: meldet …', 'laeuft')
        void melden({ automatisch: false })
      })
      playerFeld.appendChild(knopfHier)
      /* Nur der Knopf nimmt Klicks an — die Fläche daneben gehört dem Player. */
      playerFeld.classList.add('ak-player-bedienbar')
    } else {
      playerFeld.classList.remove('ak-player-bedienbar')
    }
  } catch {
    /* Eine Anzeige, die den Player stört, ist keine. */
  }
}

/**
 * **Was im Player zu sehen ist — einmal je Takt entschieden.**
 *
 * Vier Lagen, und jede hat ihren eigenen Satz: Es fehlen noch Daten, es fehlen
 * die Tonspuren, es ist alles da (dann steht der Knopf bereit), oder die Folge
 * ist bereits gemeldet.
 */
function playerZeigen() {
  if (!imPlayer() || !playerAuftragOffen()) return
  if (gesendet.has(schluessel())) {
    const wie = gesendet.get(schluessel())
    if (wie === 'deutsch') playerAnzeige('Anime-Kalender: als deutsch gemeldet', 'gut')
    else if (wie === 'kein_deutsch') playerAnzeige('Anime-Kalender: als „kein Deutsch" gemeldet', 'gut')
    return
  }
  if (!stand.reihe) {
    playerAnzeige('Anime-Kalender: wartet auf die Folgendaten …', 'laeuft')
    return
  }
  if (!stand.spuren) {
    playerAnzeige('Anime-Kalender: wartet auf die Tonspuren — Abspielen drücken', 'laeuft')
    return
  }
  const { deutsch } = urteil(stand.spuren)
  playerAnzeige(
    `Folge ${stand.folgeNr ?? '?'}: ${deutsch ? 'deutsche Tonspur gefunden' : 'kein Deutsch gefunden'}`,
    'laeuft',
    deutsch ? 'Als deutsch melden' : 'Als „kein Deutsch" melden',
  )
}

function zeigeErgebnis(text, gutgegangen) {
  /* Im Player gibt es keinen Knopf — dort sagt es die eigene Anzeige. */
  playerAnzeige(text, gutgegangen ? 'gut' : 'fehler')
  if (!knopf) return
  knopf.textContent = text
  knopf.classList.add(gutgegangen ? 'ak-erfolg' : 'ak-fehler')
  clearTimeout(zurueckstellen)
  /**
   * Danach den **jetzigen** Zustand zeigen, nicht den gemerkten alten.
   *
   * Vorher hielt diese Funktion den Text fest, der beim Melden dastand, und
   * setzte ihn dreieinhalb Sekunden später zurück — inzwischen hatte der Nutzer
   * aber längst die Folge gewechselt, und der Knopf log für die nächste Runde.
   */
  zurueckstellen = setTimeout(() => {
    knopf?.classList.remove('ak-erfolg', 'ak-fehler')
    knopfZeigen()
  }, 2000)
}
let zurueckstellen = null

function knopfEntfernen() {
  if (knopf) {
    knopf.remove()
    knopf = null
  }
}

function knopfZeigen() {
  const { spuren, reihe } = stand
  // Zweite Sicherung an der Stelle, die tatsächlich in die Seite schreibt: Wer
  // hier ankommt, ohne dass der Titel gesucht ist, hat einen Weg gefunden, den
  // niemand vorgesehen hat.
  /*
    **Ein Titel, der nicht auf der Liste steht, sagt das — statt zu schweigen.**

    Daniel am 30.08.2026 an „Pokémon: Blauer Himmel in der Ferne!": Der
    Listen-Eintrag führt `81670593`, geöffnet war `81706101` — eine andere
    Pokémon-Reihe. Die Erweiterung entfernte ihren Knopf, und damit stand er
    auf einer Seite, die von außen genauso aussieht wie eine richtige, ohne
    jede Auskunft: „lässt sich nicht melden".

    Ein Hinweis kostet nichts und beantwortet die Frage sofort. Ganz weg bleibt
    der Knopf nur, wo ohnehin niemand meldet — auf der Startseite und überall,
    wo keine Titelkennung in der Adresse steht.
  */
  if (!istGesucht()) {
    const aufTitelseite = /^\/(title|watch)\/\d+/.test(location.pathname)
    if (!aufTitelseite) {
      knopfEntfernen()
      return
    }
    /*
      **Der Hinweis gilt einem Auftrag, nicht jedem Netflix-Abend.**

      Der Absatz darüber hat die eine Hälfte richtig gesehen und die andere
      übersehen: Wer aus der Prüfliste kommt und von Netflix woandershin
      geleitet wird, braucht eine Auskunft. Wer einfach etwas anschaut, braucht
      sie nicht — und bekam sie trotzdem, quer über dem laufenden Bild.

      Daniel am 30.08.2026, mit Bild aus „Heroes", Folge 4, mitten im Player:
      „i am just watching something, there should be no elements from the
      extension on screen."

      `kamAusListe` ist genau diese Unterscheidung, und sie stand schon da — sie
      entschied bisher nur über den **Text** des Knopfes statt über sein Dasein.
      Ohne Auftrag ist die Erweiterung unsichtbar.
    */
    const kamAusListe = (() => {
      try {
        return Boolean(
          zuletztGeoeffnet?.id &&
            !zuletztGeoeffnet.verbraucht &&
            offeneTitel[zuletztGeoeffnet.id] !== undefined &&
            String(zuletztGeoeffnet.id) !== String(stand.reihe) &&
            /* Dieselbe Minute und derselbe Verbrauch wie in `ausWeiterleitung()`:
               Ein Hinweis über einer fremden Serie ist genauso falsch wie eine
               Meldung darüber. */
            Date.now() - (zuletztGeoeffnet.zeit ?? 0) < 60 * 1000,
        )
      } catch {
        return false
      }
    })()
    if (!kamAusListe) {
      knopfEntfernen()
      return
    }
    if (!knopf) {
      knopf = document.createElement('button')
      knopf.className = 'ak-melder'
      knopf.addEventListener('click', melden)
      /* Der Melde-Knopf sitzt im Kasten, wie bei Prime — siehe netflixKasten(). */
      netflixKasten().querySelector('.ak-z-melden')?.appendChild(knopf)
    }
    knopf.hidden = false
    knopf.disabled = true
    knopf.className = 'ak-melder ak-leer'
    /*
      **Netflix leitet um — und dann sah es aus, als hätte Daniel falsch
      geklickt.**

      Der Bericht vom 30.08.2026 zeigt beides nebeneinander: `zuletztGeoeffnet`
      steht auf `81670593` (dem Auftrag aus der Liste), die Adresse auf
      `81706101` — einer anderen Pokémon-Reihe. Der Klick war also richtig, die
      Weiterleitung kam von Netflix. Dazu `stoerung: "M7355"`, Netflix' Code für
      „nicht verfügbar".

      Deshalb steht hier, was wirklich passiert ist. Wer **nicht** aus der
      Liste kam, sieht diesen Knopf gar nicht mehr — siehe oben.
    */
    knopf.textContent = 'Weitergeleitet — Auftrag abgelaufen'
    /*
      **Der Klick aus der Liste ist der einzige Weg — gemessen, nicht gewählt.**

      Am 30.08.2026 versucht, die Weiterleitung selbst zu finden: ein `fetch`
      auf `/title/<id>`, der dem Redirect folgt. Netflix leitet aber **nicht**
      per HTTP um — der Abruf landet auf `/de-en/unsupportedbrowser`, und die
      Zuordnung entsteht erst im Browser, im JavaScript. Derselbe Befund wie
      beim Player-Manifest: Was Netflix im Client entscheidet, ist von außen
      nicht zu lesen.

      Also bleibt der Klick, und der Tooltip sagt es geradeheraus statt eine
      Automatik anzudeuten, die es nicht gibt.
    */
    knopf.title = kamAusListe
      ? `Geöffnet war „${offeneTitel[zuletztGeoeffnet.id]?.titel ?? zuletztGeoeffnet.id}", und Netflix hat ` +
        'auf eine andere Kennung geleitet — das ist oft richtig, wenn der Titel eine Folge innerhalb ' +
        'einer Reihe ist. Einmal über den Link in der Prüfliste öffnen; danach ist die Zuordnung ' +
        'dauerhaft gemerkt.'
      : 'Zu dieser Netflix-Kennung gibt es keinen offenen Auftrag. Häufigster Grund: Der Titel aus ' +
        'der Liste liegt unter einer anderen Kennung — einmal über den Link in der Prüfliste öffnen, ' +
        'dann sitzt die Zuordnung dauerhaft.'
    return
  }
  if (!reihe && !spuren) {
    knopfEntfernen()
    return
  }
  if (!knopf) {
    knopf = document.createElement('button')
    knopf.className = 'ak-melder'
    knopf.addEventListener('click', melden)
    netflixKasten().querySelector('.ak-z-melden')?.appendChild(knopf)
  }
  const { text, klasse, aktiv } = beschriftung(spuren)
  /*
    **Ohne Text kein Knopf.**

    Seit dem 26.08.2026 gibt es den Hinweis „Auf Abspielen klicken, dann läuft
    es von selbst" nicht mehr — er beschrieb eine Automatik, die abgeschaltet
    ist. Ein leerer Knopf an ihrer Stelle wäre schlimmer als keiner: Er sähe
    aus, als ließe sich etwas anklicken.
  */
  knopf.hidden = !text
  if (!text) return
  knopf.hidden = false
  knopf.disabled = !aktiv
  if (!knopf.classList.contains('ak-erfolg') && !knopf.classList.contains('ak-fehler')) {
    knopf.textContent = text
    knopf.classList.remove('ak-ja', 'ak-nein', 'ak-leer')
    knopf.classList.add(klasse)
  }
}

// --- Die Übersicht: was noch zu prüfen ist -----------------------------------

/**
 * Ein zweiter Knopf, der nur **außerhalb** des Players erscheint.
 *
 * Daniels Wunsch vom 22.08.2026: Beim Fernsehen soll nichts stören, aber auf
 * den Übersichts- und Stöberseiten will er sehen, wie viel noch offen ist —
 * und von dort direkt losarbeiten können, statt eine Liste in einer Datei zu
 * suchen.
 *
 * Die Trennung läuft über die Adresse: `/watch/` heißt, der Player läuft.
 */
/**
 * Der Termin, den Netflix auf einer noch nicht abrufbaren Titelseite nennt.
 *
 * Gemessen am 23.08.2026 an "Mononoke – The Movie: Chapter III": ueber der
 * Beschreibung steht "Ab 29. September", daneben "Erinnern". Das Jahr fehlt —
 * Netflix nennt nur Tag und Monat, weil ein solcher Termin immer voraus liegt.
 *
 * **Gelesen wird der sichtbare Text, nicht geraten.** Was hier herauskommt,
 * geht unveraendert in die Meldung; das Jahr abzuleiten ist Sache der
 * Pipeline, die weiss, welcher Tag heute ist.
 */
function erscheinungsdatum() {
  const text = document.body?.innerText ?? ''
  // Ab 29. September / Ab 3. Oktober 2026
  const treffer = /\bAb\s+(\d{1,2}\.\s*[A-Za-z\u00c4\u00d6\u00dc\u00e4\u00f6\u00fc]+(?:\s+\d{4})?)/.exec(text)
  return treffer ? treffer[1].replace(/\s+/g, ' ').trim() : null
}

function imPlayer() {
  return location.pathname.startsWith('/watch/')
}

/** Was diese Installation schon gemeldet hat — überlebt einen Neustart. */
let erledigt = {}
/**
 * **Erkannte Weiterleitungen, dauerhaft.**
 *
 * `{ Zielkennung: Auftragskennung }` — bei „Pokémon: Blauer Himmel in der
 * Ferne!" also `{ '81706101': '81670593' }`.
 *
 * Die Erkennung über `zuletztGeoeffnet` gilt nur eine Minute; nach einem Reload
 * stand deshalb wieder „Steht nicht auf der Prüfliste" auf einer Seite, die
 * eine Minute vorher noch richtig zugeordnet war (Daniel, 30.08.2026, mit zwei
 * Bildern). Eine Weiterleitung ändert sich aber nicht — was einmal erkannt
 * wurde, gilt weiter.
 *
 * Dasselbe Vorgehen wie bei Disney+ (CLAUDE.md, 26.08.2026), nur haltbar
 * gemacht: Dort erbt die Zielseite den Auftrag über den Klick, hier zusätzlich
 * über das Gedächtnis.
 */
let netflixWeiterleitungen = {}
const erledigtGeladen = chrome.storage.local
  .get(['erledigt', 'anbieterStaffeln', 'zuletztGeoeffnet', 'netflixWeiterleitungen'])
  .then((x) => {
    erledigt = x.erledigt ?? {}
    anbieterStaffeln = x.anbieterStaffeln ?? {}
    zuletztGeoeffnet = x.zuletztGeoeffnet ?? null
    netflixWeiterleitungen = x.netflixWeiterleitungen ?? {}
  })
  .catch(() => {
    erledigt = {}
  })

/** Eine Folge in Daniels Kurzform: Staffel, `e`, zweistellige Folge. */
function folgenKuerzel(staffel, folge) {
  return `${staffel}e${String(folge).padStart(2, '0')}`
}

/**
 * Welche Folgen einer Adresse sich lohnen.
 *
 * **Erste und letzte je Staffel.** Sind beide gleich, ist die Staffel
 * einheitlich; weichen sie ab, liegt die Grenze dazwischen — bei Black Clover
 * nach Folge 155, bei My Hero Academia in Staffel 7. Eine Staffel mit einer
 * einzigen Folge braucht nur einen Eintrag.
 */
function empfohleneFolgen(eintrag) {
  const raus = []
  for (const s of eintrag.staffeln) {
    if (!s.offen) continue
    // Ein Film hat keine Folgen — „1e01" wäre dort eine Anweisung ins Leere
    // (Daniel, 22.08.2026: „filme in der liste werden als 1e01 gemeldet,
    // obwohl es filme und keine serien sind").
    //
    // **Nur das Format entscheidet, nicht die Folgenzahl.** „ONE PIECE" läuft
    // noch und hat bei AniList gar keine — in der Liste stand `folgen: 0`, und
    // die alte Bedingung „höchstens eine Folge" machte daraus einen Film
    // (Daniel, 22.08.2026: „one piece da steht film, aber ist serie").
    if (s.film) {
      raus.push(eintrag.staffeln.length > 1 ? `Film ${s.nr}` : 'Film')
      continue
    }
    /**
     * Die Nummern des **Anbieters**, nicht unsere.
     *
     * Netflix zählt bei manchen Reihen über die Staffeln hinweg durch: My Hero
     * Academia beginnt Staffel 7 bei Folge 146 und endet bei 170. Eine
     * Empfehlung „7e01" schickt dorthin, wo nichts ist — und der Vermerk nach
     * der Meldung heißt „7e170" und trifft nie auf „7e01". Genau daran ist die
     * Einfärbung gescheitert (Daniel, 22.08.2026).
     *
     * `erste` steht erst da, wenn der Anbieter selbst gesprochen hat. Bis dahin
     * ist unsere Aufteilung die beste Schätzung, und die beginnt bei 1.
     */
    const erste = s.erste ?? 1
    raus.push(folgenKuerzel(s.nr, erste))
    // Die letzte Folge nur, wenn wir wissen, welche das ist. Bei einer
    // laufenden Serie ohne Folgenzahl bliebe sonst „1e00" stehen.
    if (s.folgen > 1) raus.push(folgenKuerzel(s.nr, erste + s.folgen - 1))
  }
  return raus
}

function istErledigt(id, kuerzel) {
  return Boolean(erledigt[String(id)]?.includes(kuerzel))
}

/**
 * Wurde aus dieser Staffel überhaupt schon etwas gemeldet?
 *
 * Die Kürzel in der Liste sind **Empfehlungen** — erste und letzte Folge. Wer
 * einen Titel öffnet, bekommt von Netflix aber oft eine andere Folge angeboten,
 * etwa die zuletzt gesehene. Dann wird „1e03" gespeichert, während in der Liste
 * „1e01" steht, und nichts färbt sich. Daniel am 22.08.2026: „ich click drauf,
 * es öffnet sich neuer tab, ich prüfe es, schließe den tab, die liste bleibt wie
 * vorher."
 *
 * Deshalb zwei Stufen: Die genaue Folge färbt sich grün, die übrigen Kürzel
 * derselben Staffel bekommen einen Rahmen — „hier war schon jemand".
 */
/**
 * Die Staffelnummer hinter einem Kürzel — auch hinter „Film 2".
 *
 * Gemeldet wird immer als Folge: Ein Film ist für den Player die erste Folge
 * seiner Staffel, also steht im Speicher „1e01". In der Liste steht „Film".
 * Ohne diese Übersetzung färbte sich das Zeichen nie (Daniel, 22.08.2026).
 */
function staffelAusKuerzel(kuerzel) {
  const film = /^Film(?:\s+(\d+))?$/.exec(kuerzel)
  if (film) return Number(film[1] ?? 1)
  const zahl = Number(kuerzel.split('e')[0])
  return Number.isFinite(zahl) ? zahl : null
}

/** Gilt dieses Kürzel als erledigt — egal ob Folge oder Film? */
function kuerzelErledigt(id, kuerzel) {
  if (istErledigt(id, kuerzel)) return true
  if (!kuerzel.startsWith('Film')) return false
  const nr = staffelAusKuerzel(kuerzel)
  return nr !== null && staffelAngefasst(id, nr)
}

function staffelAngefasst(id, staffel) {
  const vorsatz = String(staffel) + 'e'
  return (erledigt[String(id)] ?? []).some((k) => k.startsWith(vorsatz))
}

/**
 * Eine Meldung als erledigt vermerken — für die Anzeige, nicht als Beleg.
 *
 * **Die Staffel darf fehlen.** Netflix nennt sie nicht überall: Bei einer Serie
 * mit nur einer Staffel steht in der Titelzeile bloß „Flg. 3", und der erste
 * Anlauf verwarf solche Meldungen still — Daniel meldete zwei Folgen von
 * 7SEEDS und sah die Liste danach unverändert (22.08.2026). Hat der Titel
 * genau **eine** offene Staffel, ist sie gemeint; gibt es mehrere, bleibt es
 * ohne Vermerk, denn dann wäre jede Wahl geraten.
 */
/**
 * Einen Verweis als „führt zu nichts" vermerken.
 *
 * Zwei Wege enden hier: der Knopf im Player, wenn die Titelseite keine
 * abspielbare Folge hat, und der Knopf in der Liste. Beide sagen dasselbe, also
 * soll auch dasselbe dastehen.
 */
async function merkeTot(id) {
  if (!id) return
  const schluessel = String(id)
  if ((erledigt[schluessel] ?? []).includes('tot')) return
  erledigt[schluessel] = [...(erledigt[schluessel] ?? []), 'tot']
  try {
    await speicherSchreiben({ erledigt })
  } catch {
    /* Ohne Speicher bleibt die Anzeige unvollständig, mehr nicht. */
  }
}

async function merkeErledigt(id, staffel, folge) {
  if (!id) return
  /**
   * Ein Film hat keine Folgennummer — und braucht auch keine.
   *
   * Netflix nennt bei „Castle in the Sky" weder Staffel noch Folge; die Meldung
   * kam mit beidem leer an und fiel deshalb durch. Das Zeichen „Film" blieb
   * weiß, obwohl die Auskunft im Briefkasten lag (Daniel, 22.08.2026).
   *
   * Hat der Titel genau eine offene Staffel mit einer einzigen Folge, ist klar,
   * was gemeint war.
   */
  if (!folge) {
    const offene = (offeneTitel[String(id)]?.staffeln ?? []).filter((x) => x.offen)
    /**
     * Bei einem Film zählt nicht, wie viele Folgen wir führen.
     *
     * „Flavors of Youth" ist ein Anthologie-Film und steht bei AniList mit drei
     * Episoden — die Bedingung „höchstens eine Folge" schloss ihn deshalb aus,
     * und die Meldung blieb ohne Vermerk (Daniel, 22.08.2026). Wer einen Film
     * meldet, meint den Film; eine Auswahl gibt es dort nicht.
     */
    /**
     * Nennt der Anbieter keine Folge, gibt es dort auch keine Auswahl.
     *
     * „Pokémon: The Arceus Chronicles" führen wir als Serie mit vier Folgen —
     * bei Netflix ist es ein Film (Daniel, 22.08.2026). Die Meldung kam ohne
     * Folgennummer, und die alte Bedingung „nur bei Filmen" verwarf sie: Der
     * Eintrag blieb weiß, obwohl die Auskunft im Briefkasten lag.
     *
     * Bei genau einer offenen Staffel ist trotzdem klar, was gemeint war —
     * wer keine Folgenauswahl vorfindet, hat gesehen, was es dort gibt. Der
     * Vermerk ist ohnehin nur eine Gedächtnisstütze; der Befund selbst liegt
     * beim Worker.
     */
    if (offene.length !== 1) return
    staffel = staffel || offene[0].nr
    folge = offene[0].erste ?? 1
  }
  /**
   * Kennt die Liste diese Kennung nicht, war es vielleicht eine andere.
   *
   * Der Tab, aus dem heraus geklickt wurde, hat die Kennung hinterlegt. Sie
   * gilt nur kurz — nach zehn Minuten ist nicht mehr plausibel, dass beides
   * zusammengehört, und dann lieber gar kein Vermerk als ein falscher.
   */
  if (offeneTitel[String(id)] === undefined) {
    try {
      const { zuletztGeoeffnet } = (await speicherLesen('zuletztGeoeffnet')) ?? {}
      if (
        zuletztGeoeffnet?.id &&
        offeneTitel[zuletztGeoeffnet.id] !== undefined &&
        Date.now() - (zuletztGeoeffnet.zeit ?? 0) < 10 * 60 * 1000
      ) {
        id = zuletztGeoeffnet.id
      }
    } catch {
      /* Ohne Speicher bleibt es beim eigenen Wert. */
    }
  }
  if (!staffel) {
    /*
      **Die Folgennummer sagt selbst, in welche Staffel sie gehört.**

      Bis 4.9.2 verlangte diese Stelle „genau eine offene Staffel" und stieg
      sonst aus. Bei Death Note (drei Staffeln) blieb Folge 31 deshalb schwarz,
      obwohl die Meldung angekommen war; bei Black Clover standen 168 gemeldete
      Folgen mit drei geratenen Staffelnummern im Speicher, und der Kasten zeigte
      nur ein Drittel als erledigt (Daniel, 31.08.2026).

      Die Prüfliste trägt je Staffel, wo ihre Zählung beginnt und wie weit sie
      reicht — bei durchgezählten Reihen ist das die Antwort, ohne zu raten.
    */
    const alle = offeneTitel[String(id)]?.staffeln ?? []
    const treffer = alle.find((x) => {
      const von = x.erste ?? 1
      return folge >= von && folge < von + (x.folgen ?? 0)
    })
    if (treffer) {
      staffel = treffer.nr
    } else {
      const offene = alle.filter((x) => x.offen)
      if (offene.length !== 1) return
      staffel = offene[0].nr
    }
  }
  const schluessel = String(id)
  const kuerzel = folgenKuerzel(staffel, folge)
  const bisher = erledigt[schluessel] ?? []
  if (bisher.includes(kuerzel)) return
  erledigt[schluessel] = [...bisher, kuerzel]
  try {
    await speicherSchreiben({ erledigt })
  } catch {
    /* Ohne Speicher bleibt die Anzeige unvollständig, mehr nicht. */
  }
}

/**
 * Ist an diesem Titel nichts mehr zu tun?
 *
 * Entweder als toter Verweis gemeldet, oder jede empfohlene Folge ist durch.
 * Dieselbe Frage stellen der Knopf mit seiner Zahl und die Liste mit ihrer
 * Sortierung — deshalb steht sie hier einmal und nicht zweimal.
 */
/**
 * **Fertig ist, wenn jede Folge gemeldet ist — nicht die erste und die letzte.**
 *
 * Daniel am 26.08.2026, mit Bild: „warum sind die noch als gemeldet
 * gelabeled? achso teilweise gemeldet. die sollten aber nicht hinter dem
 * toggle verschwinden, solange sie noch zu reportende episoden haben."
 *
 * Im Bild stand bei Beyblade X „gemeldet: E1, E49" neben „offen: E2-48" —
 * und der Titel galt trotzdem als erledigt und verschwand hinter dem
 * Umschalter. Der Grund: `empfohleneFolgen()` liefert je Staffel genau zwei
 * Kürzel, die erste und die letzte Folge. Das war eine sinnvolle Empfehlung,
 * solange eine Meldung für die ganze Staffel galt; seit der Durchlauf jede
 * Folge einzeln meldet, ist es die falsche Frage.
 *
 * Gezählt wird jetzt über alle Folgen der Staffeln. Ein toter Verweis bleibt
 * erledigt, und ein Titel ohne Folgenangabe gilt weiterhin nicht als fertig —
 * `[].every(…)` ist immer wahr, und daran ist der Zähler schon einmal
 * gescheitert (22.08.2026: von 11 auf 0 nach einer einzigen Meldung).
 */
/**
 * **Fertig ist, wenn jede Folge gemeldet ist — und die Prüfung hört beim
 * ersten Nein auf.**
 *
 * Daniel am 26.08.2026, mit Bild von Beyblade X („gemeldet: E1, E49" neben
 * „offen: E2-48", und trotzdem hinter dem Umschalter versteckt): „die sollten
 * aber nicht hinter dem toggle verschwinden, solange sie noch zu reportende
 * episoden haben."
 *
 * Der Grund war `empfohleneFolgen()`: Es liefert je Staffel zwei Kürzel, die
 * erste und die letzte Folge. Eine sinnvolle Empfehlung, solange eine Meldung
 * für die ganze Staffel galt — seit der Durchlauf jede Folge einzeln meldet,
 * die falsche Frage.
 *
 * **Und keine Liste bauen, bevor gefragt wird** (Daniel, im selben Zug): „some
 * reicht, sobald auch nur 1 nicht gemeldet wurde kann er returnen … oder noch
 * besser wenn es ein object mit flag ist, dann brauch gar nicht über ein array
 * gegangen zu werden."
 *
 * Beides umgesetzt. Der erste Anlauf sammelte alle Kürzel in ein Array und
 * rief dann `every` — das bricht zwar beim ersten Nein ab, aber das Array war
 * da schon fertig: bei One Piece 1.175 Zeichenketten, bevor die Prüfung
 * überhaupt begann. Jetzt wird in der Schleife gefragt und beim ersten
 * fehlenden Kürzel zurückgekehrt.
 *
 * Dazu ein `Set` statt der Liste: `erledigt[id]` ist ein Array, und
 * `kuerzelErledigt` sucht darin linear. Bei 1.175 Folgen gegen 1.175 Einträge
 * wären das über eine Million Vergleiche für eine Frage, die mit dem ersten
 * offenen Kürzel beantwortet ist.
 */
/**
 * Wie viele Titel der Liste noch etwas zu tun haben.
 *
 * **Eine Zahl, eine Stelle** — der Knopf und die Kopfzeile der Liste lesen
 * beide hier. Bis zum 06.09.2026 rechneten sie getrennt und in verschiedenen
 * Einheiten: Der Knopf zählte offene **Staffelkürzel**, die Kopfzeile offene
 * **Titel**. Auf Daniels Bildschirm stand deshalb „3 Titel zu prüfen" über
 * einem Knopf mit der Zahl 5 — Berserk 1 + Fate 1 + Sword Art Online 3.
 *
 * Das ist derselbe Fehler, den zwei Kommentare in dieser Datei schon
 * beschreiben (26.08. und 30.08.2026): „Zwei Zähler, zwei Einheiten, dieselbe
 * Frage — dann widersprechen sie sich zwangsläufig." Beide Male wurde die
 * Rechnung angeglichen, nicht zusammengelegt, und beide Male ist sie wieder
 * auseinandergelaufen. Eine gemeinsame Funktion kann das bauartbedingt nicht.
 *
 * Gezählt werden **Titel**, denn das ist es, was die Liste darunter zeigt. Wie
 * viele Staffeln darin stecken, steht im Tooltip des Knopfes.
 */
function offeneTitelZahl() {
  return Object.entries(offeneTitel).filter(([id, e]) => !fertig(id, e)).length
}

function fertig(id, eintrag) {
  if (istErledigt(id, 'tot')) return true
  const staffeln = staffelnVon(id, eintrag)
  const abgehakt = new Set(erledigt[String(id)] ?? [])
  let hatFolgen = false
  for (const st of staffeln) {
    /*
      **Ein Film wird unter „Film" gemeldet — und hier unter „1e01" gesucht.**

      `empfohleneFolgen()` gibt seit dem 22.08.2026 „Film" statt einer
      Folgennummer aus. Diese Schleife wusste davon nichts: Sie baut ihre
      Kürzel aus `folgen`, und bei einem Film ist das die Eins. Die beiden
      trafen nie aufeinander, also galt kein Film je als fertig — er stand nach
      jeder Meldung wieder in der Liste (Daniel, 30.08.2026, an „Gintama the
      Movie" und „Pokémon: Blauer Himmel in der Ferne!").
    */
    if (st.film) {
      hatFolgen = true
      const kuerzel = staffeln.length > 1 ? `Film ${st.nr}` : 'Film'
      if (!abgehakt.has(kuerzel) && !kuerzelErledigt(id, kuerzel)) return false
      continue
    }
    const erste = Number.isFinite(st.erste) ? st.erste : 1
    for (let n = 0; n < (st.folgen ?? 0); n++) {
      hatFolgen = true
      const kuerzel = `${st.nr}e${String(erste + n).padStart(2, "0")}`
      /* Beim ersten offenen Kürzel ist die Frage beantwortet. */
      if (!abgehakt.has(kuerzel) && !kuerzelErledigt(id, kuerzel)) return false
    }
  }
  /*
    Ohne Folgenangabe gilt nichts als fertig. `[].every(…)` ist immer wahr, und
    daran ist der Zähler schon einmal gescheitert: Nach einer einzigen Meldung
    fiel er von 11 auf 0 (Daniel, 22.08.2026).
  */
  return hatFolgen
}

/**
 * **Der Knopf zeigt dieselbe Zahl wie die Leiste in der Statusanzeige.**
 *
 * Daniel am 26.08.2026: „ich muss sehen wieviel zu reporten ist, bevor ich
 * draufklicke und die liste sehe."
 *
 * Bis dahin zählten beide Verschiedenes: der Knopf aus der **Abhakliste dieses
 * Browsers**, die Leiste aus dem **Datensatz** abzüglich der Meldungen im
 * Briefkasten. Wer alles angeklickt hatte, sah hier ein Häkchen und dort „10
 * offen" — beide Zahlen stimmten in ihrer Welt und widersprachen sich trotzdem.
 *
 * Gelesen wird deshalb dieselbe Quelle, nicht dieselbe Rechnung nachgebaut:
 * `pruefstand.json` sagt, was der Datensatz noch nicht hat, und die Zählroute
 * des Workers, was davon schon unterwegs ist. Zwei Fassungen einer Regel laufen
 * auseinander; eine Quelle tut das nicht.
 *
 * Schlägt einer der beiden Abrufe fehl, bleibt es bei der lokalen Zählung —
 * eine Zahl aus dem eigenen Speicher ist besser als keine.
 */
/**
 * **Der Stand kommt vom Worker — er ist die einzige Stelle, die ihn rechnet.**
 *
 * Vorher holte diese Datei `pruefstand.json` und die Zählroute getrennt und zog
 * beides voneinander ab. Die Statusanzeige tat dasselbe, die Liste rechnete aus
 * dem lokalen Speicher — drei Rechnungen, drei Ergebnisse. Der Knopf sagte „10
 * offen", die Liste daneben „Alles geprüft" (Daniel, 26.08.2026: „wo sind die
 * 10 einträge die es zu prüfen gilt?" — danach: „single source of truth").
 *
 * Jetzt rechnet der Worker: Er kennt den Briefkasten und lädt den Prüfstand.
 * Wer die Zahl braucht, liest sie.
 */
const STAND = 'https://newsletter.animekalender.workers.dev/pruefung?stand=1'

/** Was der Worker für Netflix als offen führt — `null`, solange unbekannt. */
let offenLautStand = null

async function standHolen() {
  try {
    const daten = await fetch(STAND, { cache: 'no-store' }).then((r) => r.json())
    const netflix = (daten.anbieter ?? []).find((a) => a.plattform === 'netflix')
    if (!netflix) return
    offenLautStand = netflix.offen
    uebersichtZeigen()
  } catch {
    /* Ohne Netz bleibt die lokale Zählung stehen. */
  }
}

/**
 * **Der Durchlauf: alle Folgen einer Reihe nacheinander lesen.**
 *
 * Daniel am 26.08.2026, nachdem der Weg gemessen war: „bau es in die extension,
 * ich lade die extension und one piece overview neu, dann sollten ja
 * automatisch alle folgen nacheinander durchgegangen und gemeldet werden."
 *
 * Der Ablauf je Folge, gemessen an One Piece:
 *
 * 1. Zur Folge navigieren (SPA, kein Neuladen — der Kontext bleibt).
 * 2. Warten, bis `getAudioTrackList()` etwas liefert. Rund drei Sekunden.
 * 3. Videodaten abdrehen: Der Leser weist Segmentabrufe ab.
 * 4. Melden, zurück zur Titelseite, nächste Folge.
 *
 * Kosten: 3,1 s je Folge, null bis acht Videosegmente. Die Gegenprobe hält —
 * East Blue meldet `de`, der Elbaph Arc nur `ja`.
 *
 * **Gestartet wird auf Knopfdruck, nicht von allein.** Jede Folge ist eine
 * echte Wiedergabe-Sitzung mit Lizenzabruf und landet in „Weiter ansehen";
 * bei One Piece wären das über tausend Einträge. Das gehört nicht in einen
 * versehentlichen Seitenaufruf.
 */
const DURCHLAUF = {
  /** Die Folgen der **angezeigten** Staffel — damit arbeiten Knopf und Durchlauf. */
  folgen: [],
  /** Alles, was der Leser gesammelt hat, über alle angeklickten Staffeln. */
  alleFolgen: [],
  /** Die Kennung der Staffel, die zuletzt dazukam — Rückfall für `angezeigteFolgenSetzen()`. */
  zuletztGeladen: null,
  /**
   * **Welche Folgen gemeldet sind — nach Kennung, nicht nach Kürzel.**
   *
   * Der erste Anlauf filterte über `istErledigt(reihe, "1")`, während die
   * Abhakliste Kürzel der Form `2e01` führt. Die beiden trafen sich nie: Nach
   * einem vollständigen Durchlauf stand weiter „12 Folgen prüfen" am Knopf
   * (Daniel, 26.08.2026).
   *
   * Die `videoId` ist eindeutig und braucht keine Staffelzuordnung. Sie
   * überlebt auch das Neuladen — der Durchlauf soll dort weitermachen, wo er
   * aufgehört hat.
   */
  gemeldet: new Set(),
  laeuft: false,
  abbruch: false,
  fertig: 0,
  gesamt: 0,
  knopf: null,
  /**
   * **Läuft gerade ein selbsttätiger Durchgang?**
   *
   * Er unterscheidet sich vom Klick-Durchlauf nur darin, wer ihn ausgelöst hat —
   * und darin, dass er danach zur nächsten offenen Adresse weitergeht.
   */
  selbst: false,
}

/**
 * **Der selbsttätige Durchgang — die Erweiterung wartet nicht mehr auf Klicks.**
 *
 * Daniel am 31.08.2026: „ziel soll vollautomatisierung sein, nicht meine manuelle
 * handarbeit … sodass du und ich beide nichts mehr manuell anpacken müssen."
 * Und am 01.09.2026, zur Freigabe für Netflix: „ja soll sie."
 *
 * `docs/autonomie-plan.md` (Phase 7) nennt den Grund, warum das die Lösung ist
 * und kein neuer Abrufweg: Netflix, Prime und Disney+ geben ihre Sprachangaben
 * nur einer **angemeldeten** Sitzung heraus. Ein Cloud-Lauf hat keine. Was es
 * gibt, ist Daniels Browser, in dem die Erweiterung ohnehin läuft.
 *
 * **Was hier steht, ist der Selbststart** — der Durchlauf selbst ist derselbe wie
 * beim Klick. Der Schritt danach (von allein zur nächsten offenen Adresse
 * weitergehen) steht in `status.md` und kommt getrennt; er berührt die
 * Navigation und gehört nicht in denselben Commit.
 *
 * **Angeschaltet wird er von Hand, nicht von selbst.** Ein Durchgang öffnet
 * Folgen in Daniels Konto und landet bei Netflix in „Weiter ansehen" — das ist
 * seine Entscheidung, jedes Mal.
 */
let selbstAn = false

/** Aus dem Speicher, damit die Wahl das Neuladen überlebt. */
void speicherLesen('netflixSelbst')
  .then((x) => {
    selbstAn = Boolean(x?.netflixSelbst)
    if (selbstAn) void vielleichtSelbstStarten()
  })
  .catch(() => {
    /* Ohne Speicher bleibt er aus — die vorsichtige Seite. */
  })

/**
 * **Startet den Durchgang, wenn hier wirklich etwas zu holen ist.**
 *
 * Drei Riegel, und jeder hat seinen Grund:
 *
 * - **Nur mit Auftrag.** Steht die Seite nicht auf der Prüfliste, ist der
 *   Besuch privat — dieselbe Regel wie beim Knopf (CLAUDE.md, 30.08.2026:
 *   „i am just watching something").
 * - **Nur auf der Titelseite.** Im Player läuft der Durchgang schon oder
 *   Daniel sieht etwas an.
 * - **Nur einmal je Seite.** Sonst startet der Sekundentakt ihn erneut,
 *   sobald der vorige fertig ist.
 */
let selbstVersucht = null

/**
 * **Wie viele Titel dieser Sitzung selbsttätig durchlaufen wurden.**
 *
 * Die Obergrenze ist kein Misstrauen gegen den Code, sondern gegen das
 * Unvorhergesehene: Ein Durchgang öffnet Folgen in Daniels Konto, und ein Lauf,
 * der sich verrennt, tut das ohne Ende. Dieselbe Lehre wie am 26.08.2026, als
 * der erste One-Piece-Durchlauf 42 falsche Meldungen erzeugte — damals fehlte
 * die Grenze, und Daniels einzige Antwort war „ich schließe mal den tab".
 *
 * Zwanzig Titel sind eine Stunde Arbeit; wer mehr will, lädt die Seite neu.
 */
let selbstGezaehlt = 0
const SELBST_HOECHSTENS = 20

/**
 * **Die nächste Adresse, die noch etwas zu holen hat.**
 *
 * Genommen wird die erste offene aus der Prüfliste, die nicht die aktuelle ist.
 * „Offen" heißt hier dasselbe wie im Kasten: mindestens eine Staffel ohne
 * Antwort, und der Titel nicht als toter Verweis abgehakt.
 */
function naechsterAuftrag() {
  const hier = String(gemeinteReihe() ?? '')
  for (const [kennung, eintrag] of Object.entries(offeneTitel)) {
    if (kennung === hier) continue
    if (istErledigt(kennung, 'tot')) continue
    const offen = (eintrag?.staffeln ?? []).filter((st) => st.offen)
    if (!offen.length) continue
    /* Was vollständig abgehakt ist, braucht keinen Besuch. */
    const kuerzel = empfohleneFolgen(eintrag)
    if (kuerzel.length && kuerzel.every((k) => kuerzelErledigt(kennung, k))) continue
    return kennung
  }
  return null
}

async function vielleichtSelbstStarten() {
  if (!selbstAn || DURCHLAUF.laeuft) return
  if (!/^\/(?:de-de\/)?title\//.test(location.pathname)) return
  const reihe = gemeinteReihe()
  if (!reihe || offeneTitel[String(reihe)] === undefined) return
  if (selbstVersucht === reihe) return
  if (!DURCHLAUF.folgen.length) return
  selbstVersucht = reihe
  console.log('[Anime-Kalender] Selbsttätiger Durchgang startet …')
  DURCHLAUF.selbst = true
  await durchlaufStarten(RAND)
  DURCHLAUF.selbst = false
}

/** Der Speicherplatz je Reihe — eine Reihe, eine Liste gemeldeter Kennungen. */
/**
 * **Folgennummern als Bereiche — „1-10, 12" statt zwölf Kästchen.**
 *
 * Daniel am 26.08.2026: „weil das evtl zu viele zum auflisten sind, sollte
 * ein von bis aufzählung sein, heißt wenn ich zb 1-10 reportet 11 nicht
 * reportet und 12 reportet habe, sollte dort stehen: reported (grün):
 * s1e1-e10, e12, to report (grau): s1e11."
 *
 * Bei One Piece wären es sonst über tausend Einträge in einer Zeile.
 */
function alsBereiche(nummern) {
  const sortiert = [...new Set(nummern)].filter(Number.isFinite).sort((a, b) => a - b)
  if (!sortiert.length) return []
  const raus = []
  let von = sortiert[0]
  let bis = sortiert[0]
  for (const n of sortiert.slice(1)) {
    if (n === bis + 1) {
      bis = n
      continue
    }
    raus.push(von === bis ? `${von}` : `${von}-${bis}`)
    von = n
    bis = n
  }
  raus.push(von === bis ? `${von}` : `${von}-${bis}`)
  return raus
}

/**
 * **Wie viele Folgen ein Klick prüft — umschaltbar und gemerkt.**
 *
 * Daniel am 26.08.2026: „mach toggle bar per console, oder innerhalb der
 * liste ein kleiner limit-icon button dann kann ich es selbst umstellen. im
 * localstore toggle state merken, sodass ich beim testen an und normale
 * prüfung aus machen kann."
 *
 * Zwei Folgen sind die Vorgabe, solange etwas erprobt wird. Wer eine Staffel
 * wirklich durcharbeiten will, stellt einmal um — und es bleibt so, bis er es
 * zurückstellt. Umschalt+Klick kehrt die Einstellung für einen Lauf um.
 */
const PROBE_SCHLUESSEL = 'ak-durchlauf-probe'
/** Wie viele Folgen ein Klick prüft — 0 heißt alle. */
let probeGrenze = 2

void (async () => {
  try {
    const gespeichert = await chrome.storage.local.get(PROBE_SCHLUESSEL)
    if (Number.isFinite(gespeichert[PROBE_SCHLUESSEL])) probeGrenze = gespeichert[PROBE_SCHLUESSEL]
  } catch {
    /* Ohne Speicher bleibt es bei zwei — der vorsichtigen Seite. */
  }
  durchlaufKnopfZeigen()
})()

/**
 * **Drei Zustände: zwei Folgen, alle, oder nur Anfang und Ende.**
 *
 * Daniel am 26.08.2026: „ich möchte nicht alle testen, ich will mich drauf
 * verlassen bei netflix das 1. und letzte test ausreicht … wenn diese prüfung
 * erkennt das 1. deutsch und letzte kein deutsch, dann meldung nicht
 * abschicken und gelbfärbung oder so um es zu kennzeichnen, dann input feld
 * anbieten wo ich manuell eine folge eingeben kann, bis zu der es deutsch ist."
 *
 * `RAND` prüft die erste und die letzte offene Folge. Stimmen beide überein,
 * gilt der Befund für die ganze Staffel — **als Annahme, nicht als Messung**,
 * und die Notiz sagt das. Unterscheiden sie sich, geht gar nichts raus: Dann
 * liegt die Grenze irgendwo dazwischen, und die kennt nur, wer nachsieht.
 */
const RAND = -1

/**
 * Die von Hand eingetragene Grenze übernehmen.
 *
 * Bis zur genannten Folge gilt der Befund der **ersten** Randprobe, danach
 * der der **letzten**. Beide sind gemessen; nur die Grenze dazwischen kommt
 * von Daniel, und genau das steht in der Notiz.
 */
async function grenzeUebernehmen() {
  const bis = Number(DURCHLAUF.grenzFeld?.value)
  const daten = DURCHLAUF.randOffen
  if (!daten || !Number.isFinite(bis) || bis < 1) return

  const vorne = daten.folgen.filter((f) => f.nummer <= bis)
  const hinten = daten.folgen.filter((f) => f.nummer > bis)
  await randMelden(vorne, daten.erste, bis)
  if (hinten.length) await randMelden(hinten, daten.letzte, daten.letzte.folge.nummer)

  DURCHLAUF.randOffen = null
  DURCHLAUF.grenzFeld.value = ''
  durchlaufKnopfZeigen()
  console.log(
    `[Anime-Kalender] Grenze bei Folge ${bis} übernommen: ` +
      `1–${bis} ${daten.erste.deutsch ? 'deutsch' : 'ohne Deutsch'}, ` +
      `ab ${bis + 1} ${daten.letzte.deutsch ? 'deutsch' : 'ohne Deutsch'}.`,
  )
}


const durchlaufSchluessel = (reihe) => `ak-durchlauf-${reihe}`

/**
 * **Der Stand kommt aus der Ferne, nicht aus dem Browser.**
 *
 * Daniel am 26.08.2026: „es sollte synchron zur remote liste sein, fix das
 * sodass die stände nie auseinander laufen können."
 *
 * Der erste Anlauf führte im Browser Buch. Das ging genau so lange gut, bis
 * die Erweiterung neu geladen wurde — dann stand der Zähler auf null, obwohl
 * zwölf Meldungen längst im Briefkasten lagen. Zwei Fassungen derselben
 * Wahrheit laufen auseinander; die Regel gilt für Zustände wie für Regeln.
 *
 * Gefragt wird der Worker, und der antwortet aus der Meldungstabelle —
 * unabhängig davon, ob ein Datenlauf sie schon übernommen hat.
 *
 * Fällt die Abfrage aus, bleibt der lokale Speicher als Rückfallebene. Er ist
 * dann veraltet, aber besser als eine Reihe, die von vorn beginnt.
 */
async function durchlaufStandLaden(reihe) {
  if (!reihe) return
  const adresse = `https://www.netflix.com/title/${reihe}`
  try {
    const antwort = await fetch(`${WORKER}?gemeldet=${encodeURIComponent(adresse)}`, { cache: 'no-store' })
    const daten = await antwort.json()
    /* Der Worker führt die Folgennummern; die Kennung steht hier daneben. */
    const nummern = new Set((daten.nummern ?? []).map(Number))
    DURCHLAUF.gemeldeteNummern = nummern
    /*
      **Wo jede Staffel bei 1 anfängt, trifft eine Nummer zweimal.**

      Bei Kakegurui führt Netflix zwei Staffeln zu je zwölf Folgen, beide von 1
      bis 12. Gemeldet waren die zwölf der zweiten — über `nummern` gefiltert
      galten damit **alle vierundzwanzig** als erledigt, und der Knopf sagte
      „✓ 24 Folgen geprüft" für eine Staffel, von der nichts im Briefkasten lag
      (Daniel, 01.09.2026, mit Bildschirmaufnahme).

      Der Worker liefert für genau diesen Fall `paare` mit Staffelnummer — der
      Kommentar dort nennt den Anlass bei Disney+ am 26.08.2026 („2e16? wo sind
      die ersten 15 von s2?"). `disney.js` nutzt sie seitdem, `melder.js` nie.

      Gebraucht werden sie nur, wo die Nummern sich wiederholen. Läuft die
      Zählung durch (One Piece: 1 bis 1174), ist die Nummer eindeutig, und die
      Staffelangabe der Meldung wäre dort die schlechtere Auskunft — sie steht
      bei durchlaufender Zählung bewusst auf `null` (siehe `staffelnBereinigen`).
    */
    const alleNummern = DURCHLAUF.folgen.map((f) => f.nummer)
    const jeStaffelNeu = alleNummern.length !== new Set(alleNummern).size
    const paare = Array.isArray(daten.paare) ? daten.paare : []
    meldungenMerken(reihe, paare)
    /*
      **„Gemeldet" kommt aus `folgeZustand()` — derselben Stelle wie im Dialog.**
      Vorher entschied hier die Nummer allein, sobald die geladene Liste keine
      doppelten Nummern hatte. Auf der Titelseite ist nur eine Staffel geladen,
      und eine Meldung von S2 E5 machte damit S1 E5 zu „gemeldet".
    */
    const geladen = geladeneZustaende()
    DURCHLAUF.gemeldet = new Set(
      geladen
        ? geladen.filter((z) => z.zustand === 'gemeldet' && !z.ausBestand).map((z) => z.f.videoId)
        : DURCHLAUF.folgen.filter((f) => nummern.has(f.nummer)).map((f) => f.videoId),
    )

    /*
      **Die Abhakliste kommt aus derselben Quelle — und über alle Staffeln.**

      Sie speist die Bereiche im Dialog. Ohne diesen Abgleich stand dort nach einer
      Randprobe über 61 Folgen weiter „gemeldet: E1-2, E61 | offen: E3-60", während
      der Knopf daneben „61 Folgen geprüft" sagte (Daniel, 26.08.2026).

      Der erste Anlauf ging über `DURCHLAUF.folgen` und hat den Widerspruch nur
      verschoben: Das sind die Folgen der Staffel, deren Liste Netflix gerade zeigt.
      Bei One Piece Staffel 38 waren das 34 von 216 gemeldeten; die übrigen 182
      blieben grau, obwohl der Worker sie führte („e1124-1154 sagt offen, button
      sagt alles geprüft").

      Die Staffelgrenzen stehen in der Prüfliste und gelten unabhängig davon, was
      gerade geladen ist. Die Ferne ist die Quelle; die lokale Liste folgt ihr.
    */
    const bekannt = new Set(erledigt[String(reihe)] ?? [])
    const vorher = bekannt.size
    const staffeln = staffelnVon(reihe, offeneTitel[String(reihe)] ?? {})
    /*
      Dieselbe Unterscheidung wie oben: Wiederholen sich die Nummern, sagt erst
      das Paar, welche Staffel gemeint ist. `kuerzelFuerNummern` nimmt sonst die
      erste passende — und die ist dann immer Staffel 1.
    */
    const kuerzel =
      jeStaffelNeu && paare.length
        ? paare.map((x) => `${Number(x.staffel ?? 1)}e${String(x.nummer).padStart(2, '0')}`)
        : kuerzelFuerNummern(staffeln, nummern)
    for (const k of kuerzel) bekannt.add(k)
    if (bekannt.size !== vorher) {
      erledigt[String(reihe)] = [...bekannt]
      try {
        await speicherSchreiben({ erledigt })
      } catch {
        /* Ohne Speicher gilt es nur für diese Sitzung. */
      }
    }
    await durchlaufStandSchreiben(reihe)
    return
  } catch {
    /* Kein Netz — dann der letzte bekannte Stand. */
  }
  try {
    const gespeichert = await chrome.storage.local.get(durchlaufSchluessel(reihe))
    DURCHLAUF.gemeldet = new Set(gespeichert[durchlaufSchluessel(reihe)] ?? [])
  } catch {
    DURCHLAUF.gemeldet = new Set()
  }
}

async function durchlaufStandSchreiben(reihe) {
  if (!reihe) return
  try {
    await chrome.storage.local.set({ [durchlaufSchluessel(reihe)]: [...DURCHLAUF.gemeldet] })
  } catch {
    /* Ohne Speicher fängt der nächste Durchlauf von vorn an, mehr nicht. */
  }
}

/**
 * **Netflix duldet nur einen Tab — und sagt es mit einem Fehlercode.**
 *
 * Daniel am 26.08.2026, mitten im Durchlauf: „netflix limitation mit 1 tab
 * stört. wenn das passiert soll das skript abbrechen statt weiter zu
 * versuchen." Auf dem Bild stand M7020: „Sie sehen Netflix scheinbar in mehr
 * als einem Browser oder Tab."
 *
 * Weiterzumachen bringt nichts: Jede weitere Folge läuft in dieselbe Wand,
 * zwanzig Sekunden lang, und am Ende steht ein Durchlauf ohne ein einziges
 * Ergebnis. Ein Abbruch mit Ansage ist ehrlicher — dann weiß Daniel, was zu
 * tun ist, und beginnt dort, wo er aufgehört hat.
 *
 * Gesucht wird nach dem Code, nicht nach dem Satz: Der steht in jeder Sprache
 * anders da, die Kennung überall gleich.
 */
function stoerung() {
  /*
    **`innerText`, nicht `textContent` — sonst liest man Netflix' Skripte mit.**

    `textContent` gibt auch den Inhalt von `<script>`-Elementen zurück, und dort
    stehen Netflix' Fehlercode-Vorlagen im Klartext. Auf der Pokémon-Titelseite
    fand das Muster deshalb ein `M7355`, obwohl die Seite keinen Fehler zeigt —
    dreimal in Folge im Diagnosebericht, und jedes Mal riet der Knopf, andere
    Tabs zu schließen (Daniel, 30.08.2026).

    `innerText` liefert, was ein Mensch sieht: kein Skript, nichts Verborgenes.
    Genau das ist gemeint, wenn hier nach einer Fehlermeldung gesucht wird.
  */
  const text = document.body?.innerText ?? ''
  /*
    `UI3003` kam am 26.08.2026 dazu — „Dieser Titel ist in Ihrem Land derzeit
    nicht verfügbar". Er erschien, weil eine Folge mit `videoId: 0` in die Liste
    geraten war und der Durchlauf `/watch/0` öffnete.
  */
  const treffer = /\bM7\d{3}\b|\bUI\d{4}\b|\bE\d{3}\b|\bNSES-[A-Z]{3}\b/.exec(text)
  if (treffer) return treffer[0]
  /*
    **Den Player fragen wir nur, solange einer läuft.**

    Seine Fehler überleben die Sitzung: Auf der Pokémon-Titelseite meldete er
    `M7355` aus einer Wiedergabe, die es längst nicht mehr gab — und der Knopf
    riet, andere Tabs zu schließen, während die Seite selbst gar keinen Fehler
    zeigte (Daniel, 30.08.2026, dreimal in Folge im Diagnosebericht).

    Auf einer Titelseite steht der Fehler im Seitentext, wenn es einen gibt; der
    Player ist dort keine zweite Meinung, sondern ein Gedächtnis.
  */
  if (!imPlayer()) return null
  try {
    const api = window.netflix?.appContext?.state?.playerApp?.getAPI?.()
    for (const id of api?.videoPlayer?.getAllPlayerSessionIds?.() ?? []) {
      const fehler = api.videoPlayer.getFatalErrorForSessionId?.(id)
      if (fehler) return String(fehler?.errorCode ?? fehler?.code ?? 'Player-Fehler')
    }
  } catch {
    /* Kein Zugriff — dann bleibt es beim Blick auf die Seite. */
  }
  return null
}

/**
 * Den Durchlauf-Stand dieser Reihe verwerfen — Rechtsklick auf den Knopf.
 *
 * Gebraucht wird das beim Erproben: Sonst ist eine Staffel nach dem ersten
 * Lauf für immer abgehakt und lässt sich nicht noch einmal messen.
 */
/**
 * Den Stand für **diesen einen Lauf** übergehen — Rechtsklick auf den Knopf.
 *
 * Seit der Stand aus der Ferne kommt, lässt er sich nicht mehr „vergessen":
 * Die Meldungen liegen beim Worker, und das ist richtig so. Zum Erproben
 * braucht es trotzdem einen Weg, dieselben Folgen noch einmal zu messen —
 * also wird der Stand für den nächsten Lauf beiseitegelegt, nicht gelöscht.
 */
async function durchlaufStandVergessen() {
  const reihe = gemeinteReihe()
  if (!reihe) return
  DURCHLAUF.gemeldet = new Set()
  DURCHLAUF.stoerung = null
  /*
    **Eine Folgenliste gehört zu genau einer Staffel.**

    Beim ersten Kakegurui-Durchlauf trug die Meldung zu Folge 1 `staffel: null`
    — der Player hatte seine Metadaten noch nicht geholt, als sie abging. Die
    Pipeline verteilte die zwölf Folgen daraufhin über zwei Staffeln: Folge 1
    zu „Kakegurui", 2 bis 12 zu „Kakegurui ××". Alle zwölf gehören zur zweiten.

    Die erste Staffelnummer, die während eines Durchlaufs auftaucht, gilt
    deshalb für alle Folgen dieser Liste. Sie stammt aus derselben Ansicht.
  */
  DURCHLAUF.staffel = null
  DURCHLAUF.ohneStaffel = []
  DURCHLAUF.uebergangen = true
  durchlaufKnopfZeigen()
  console.log(
    `[Anime-Kalender] Stand für Reihe ${reihe} übergangen — alle Folgen werden noch einmal geprüft. ` +
      'Beim nächsten Laden gilt wieder, was der Worker sagt.',
  )
}

/** Was in dieser Reihe noch aussteht. */
function durchlaufOffen() {
  return DURCHLAUF.folgen.filter((f) => !DURCHLAUF.gemeldet.has(f.videoId))
}

/**
 * **Welche Folgen die Prüfliste für diese Staffel wirklich will.**
 *
 * Bis zum 10.09.2026 entschied das ein Umschalter am Knopf: zwei Folgen, alle,
 * oder Anfang und Ende. Er stammte aus einer Zeit, in der die Prüfliste nur
 * „Staffel 3 ist offen" sagen konnte — welche Folge, wusste sie nicht.
 *
 * Seit heute Vormittag weiß sie es: Die kumulative Rechnung trägt je Eintrag
 * `erste` und `folgen` ein, und daraus wird „Haikyu!! S1 Folge 26" oder
 * „Hi Score Girl S1 F13–15". Ein Umschalter, der davor gewählt hätte, wäre
 * jetzt eine Frage an den Menschen, deren Antwort schon dasteht.
 *
 * Daniel am 10.09.2026: „ein button für alles je nach zustand und melde-item."
 *
 * Steht für die gerade gewählte Staffel ein Eintrag mit Folgengrenzen, gelten
 * genau die. Sonst bleibt es bei allen offenen — dort weiß die Liste es nicht
 * besser.
 */
function durchlaufAuftrag() {
  const geladen = geladeneZustaende()
  if (!geladen) return null
  const zuTun = geladen.filter((z) => z.zustand !== 'gemeldet').map((z) => z.f)
  /*
    **Ist eine ganze Staffel zu melden, gilt die Stichprobe** — erste und letzte
    Folge, der Rest als Annahme (`randMelden()`). Der Knopf sagt das seit
    4.19.1 ausdrücklich („→ gilt für E2-25").
  */
  const gruppen = folgenJeStaffel(DURCHLAUF.folgen)
  for (const gruppe of gruppen.values()) {
    const offen = gruppe.filter((f) => zuTun.includes(f))
    if (gruppe.length > 2 && offen.length === gruppe.length) return null
  }
  return zuTun
}

/** Je Netflix-Staffel eine Gruppe — der Leser sammelt alle, die angeklickt wurden. */
function folgenJeStaffel(folgen) {
  const gruppen = new Map()
  for (const f of folgen) {
    const k = String(f.seasonId ?? '')
    if (!gruppen.has(k)) gruppen.set(k, [])
    gruppen.get(k).push(f)
  }
  return gruppen
}

/**
 * **Zu welcher Anbieterstaffel gehört eine geladene Staffel?**
 *
 * Bis 4.19.0 las der Knopf `f.staffel`. Die vergibt `leser.js` nach der
 * **Reihenfolge**, in der Staffeln geladen wurden, und `staffelnBereinigen()`
 * löscht sie, sobald nur eine geladen ist — auf der Titelseite der Normalfall.
 * Bei Haikyu!! blieb sie leer, und der Knopf fiel auf „nur E2 + E25" zurück
 * (Daniel, 11.09.2026). Die Zusicherung vom Vortag hatte `staffel` von Hand
 * gesetzt und lief an genau dieser Löschung vorbei.
 *
 * Tragfähig ist die **Folgenkennung**, in dieser Reihenfolge:
 *
 * 1. Der Player nennt je Staffel ihre Kennungen (`ids`, `leser.js`).
 * 2. Eine Meldung aus dem Player trägt Kennung **und** Staffel.
 * 3. Rückfall: Folgenzahl, erste und letzte Nummer stimmen genau. Bei
 *    Haikyu!! passen S1 und S2 (je 26) — mehrdeutig, und `zustandDerFolge()`
 *    nimmt dann den strengeren Zustand.
 */
/**
 * **Die angezeigte Staffel — Knopf und Durchlauf arbeiten nur mit ihr.**
 *
 * Daniel am 11.09.2026 mit Video und Bericht, an Haikyu!!: „Bei staffelwechsel
 * wechselt extension button anzeige nicht, staffel 3 hat nur 11 episoden, da
 * steht weiterhin e1-26 erledigt."
 *
 * Der Leser sammelt jede Staffel, die angeklickt wird, und schickt die Summe:
 * im Bericht 63 Folgen aus drei Staffeln. Der Knopf rechnete über alle drei,
 * also stand dort „E1-26" — die Nummern aller geladenen Staffeln zusammen,
 * gleich welche gerade zu sehen war.
 *
 * Welche Staffel zu sehen ist, sagt Netflix nirgends in den Daten. Auf der
 * Seite stehen aber ihre Folgentitel („Ende und Anfang", „Die Begrüßung"), und
 * die kennt der Leser je Folge. Die Gruppe mit den meisten Titeln auf der Seite
 * ist die angezeigte. Findet sich keiner, gilt die zuletzt geladene Staffel —
 * wer eine neue anklickt, lädt sie.
 *
 * **Während eines Durchlaufs wird nicht gewechselt:** Netflix wählt nach der
 * Rückkehr aus dem Player selbst eine Staffel (06.09.2026, SAO), und der Auftrag
 * gilt bis zum Ende für die Staffel, mit der er begann.
 */
function angezeigteFolgenSetzen() {
  const alle = DURCHLAUF.alleFolgen ?? []
  /* Ein Film baut seine Liste selbst (durchlaufFilmAuftrag) — ohne Leserliste bleibt sie, wie sie ist. */
  if (DURCHLAUF.laeuft || !alle.length) return false
  const gruppen = folgenJeStaffel(alle)
  let wahl = alle
  if (gruppen.size > 1) {
    const text = document.body?.textContent ?? ''
    let beste = 0
    wahl = null
    for (const gruppe of gruppen.values()) {
      const treffer = gruppe.filter((f) => typeof f.titel === 'string' && f.titel.length > 3 && text.includes(f.titel))
        .length
      if (treffer > beste) {
        beste = treffer
        wahl = gruppe
      }
    }
    if (!wahl) wahl = gruppen.get(String(DURCHLAUF.zuletztGeladen ?? '')) ?? [...gruppen.values()].pop()
  }
  const vorher = DURCHLAUF.folgen
  const gleich = vorher.length === wahl.length && vorher.every((f, i) => f.videoId === wahl[i]?.videoId)
  if (!gleich) DURCHLAUF.folgen = wahl
  return !gleich
}

/**
 * **Die Staffel einer Folge für die Meldung — aus ihrer Zuordnung, nicht aus der
 * Ladereihenfolge.**
 *
 * Bis 4.19.4 galt: „Die Staffel der Folge schlägt die des Players." Die Staffel
 * der Folge vergibt `leser.js` aber in der Reihenfolge, in der Staffeln
 * angeklickt werden. Bei Haikyu!! kam Netflix' Staffel 3 als zweite — und die
 * Meldung zu „Haikyu! Season 3 OVA" ging als **S2 E11** raus (11.09.2026,
 * Briefkasten-Id 4396). Der Player hatte beim ersten Öffnen noch keine Staffel
 * genannt.
 *
 * Jetzt, in dieser Reihenfolge: die Zuordnung der ganzen geladenen Staffel
 * (`staffelnDerGruppe()`: Kennungen aus dem Player, dann Folgenzahl), dann der
 * Player — aber nur, wenn er genau diese Folge zeigt. Sonst keine Staffel: Eine
 * geratene ist schlechter als keine, die Pipeline ordnet dann über Nummer und
 * Titel zu.
 */
function staffelFuerFolge(reihe, f) {
  if (!f) return null
  const kennung = String(f.seasonId ?? '')
  const gruppe = (DURCHLAUF.alleFolgen ?? DURCHLAUF.folgen).filter((x) => String(x.seasonId ?? '') === kennung)
  const kandidaten = staffelnDerGruppe(reihe, gruppe.length ? gruppe : [f])
  if (kandidaten.length === 1) return kandidaten[0]
  if (String(stand.folge ?? '') === String(f.videoId) && Number.isFinite(Number(stand.staffel))) {
    const zeigt = Number(stand.staffel)
    if (!kandidaten.length || kandidaten.includes(zeigt)) return zeigt
  }
  return null
}

function staffelnDerGruppe(reihe, gruppe) {
  for (const st of anbieterStaffeln[String(reihe)] ?? []) {
    if (!Array.isArray(st?.ids) || !st.ids.length) continue
    const ids = new Set(st.ids.map(Number))
    if (gruppe.some((f) => ids.has(Number(f.videoId)))) return [Number(st.seq)]
  }
  /*
    **Eine Meldung verrät die Staffel — wenn ihre Folgenzahl passt.** Am
    11.09.2026 lag „S2 E11" für Netflix' Staffel 3 im Briefkasten, aus der
    Ladereihenfolge. Ohne diesen Riegel hätte die falsche Meldung die Gruppe auf
    Dauer zu Staffel 2 gemacht, und jede weitere Meldung daraus ebenso.
  */
  const m = MELDUNGEN.get(String(reihe))
  const aufteilung = anbieterAufteilung(reihe)
  for (const f of gruppe) {
    const bekannt = m?.jeFolge.get(String(f.videoId))?.staffel
    if (!Number.isFinite(bekannt)) continue
    const st = aufteilung.find((x) => x.nr === bekannt)
    if (!st || st.folgen === gruppe.length) return [bekannt]
  }
  const nummern = gruppe.map((f) => Number(f.nummer)).filter(Number.isFinite)
  if (nummern.length) {
    const kleinste = Math.min(...nummern)
    const groesste = Math.max(...nummern)
    const passend = anbieterAufteilung(reihe)
      .filter(
        (st) =>
          !st.film && st.folgen === gruppe.length && st.erste === kleinste && st.erste + st.folgen - 1 === groesste,
      )
      .map((st) => st.nr)
    if (passend.length) return passend
  }
  /* Im Player nennt Netflix die Staffel selbst. */
  if (imPlayer() && Number.isFinite(Number(stand.staffel))) return [Number(stand.staffel)]
  return []
}

/** Ist die Staffel mehrdeutig, gilt der strengere Zustand — lieber eine Folge zu viel geprüft. */
const STRENGE = { erneut: 2, melden: 1, gemeldet: 0 }
function zustandDerFolge(reihe, kandidaten, f) {
  let raus = null
  for (const nr of kandidaten) {
    const z = folgeZustand(reihe, nr, Number(f.nummer), f.videoId)
    if (!raus || STRENGE[z.zustand] > STRENGE[raus.zustand]) raus = z
  }
  return raus
}

/**
 * Der Zustand jeder geladenen Folge — `null`: Die Reihe steht nicht auf der
 * Liste, oder eine Staffel lässt sich nicht zuordnen.
 */
function geladeneZustaende() {
  try {
    const reihe = gemeinteReihe()
    if (!reihe || !offeneTitel[String(reihe)]) return null
    const gruppen = folgenJeStaffel(DURCHLAUF.folgen)
    if (!gruppen.size) return null
    const raus = []
    for (const gruppe of gruppen.values()) {
      const kandidaten = staffelnDerGruppe(reihe, gruppe)
      if (!kandidaten.length) return null
      for (const f of gruppe) raus.push({ f, n: Number(f.nummer), ...zustandDerFolge(reihe, kandidaten, f) })
    }
    return raus
  } catch {
    return null
  }
}

/** Dem Leser sagen, ob er Videodaten durchlassen soll. */
function videoAbdrehen(zu) {
  window.postMessage({ marke: 'ak-steuer', videoZu: zu }, '*')
}

/**
 * **Abgehaktes einzeln zurückholen — auch bei Netflix.**
 *
 * Den Griff gibt es in `amazon.js` seit dem 28.08.2026; für Netflix fehlte er.
 * Am 01.09.2026 habe ich Daniel genau diesen Befehl für eine Netflix-Seite
 * gegeben — `dispatchEvent` meldete `true`, und nichts geschah: Der Rückgabewert
 * sagt nur, dass niemand abgebrochen hat, nicht dass jemand zugehört hat.
 *
 *     document.dispatchEvent(new CustomEvent('ak-oeffnen', { detail: 'kakegurui' }))
 *
 * Gebraucht wird er, wo der lokale Vermerk und der Briefkasten auseinanderlaufen:
 * Bis 4.9.1 stempelte eine Randprobe alle Folgen mit der Staffel der einen
 * gemessenen, und die Kürzel im Speicher zeigen seitdem auf Staffeln, die nie
 * gemeldet wurden. Bei Kakegurui behauptete der Knopf „24 Folgen geprüft",
 * während im Briefkasten zwölf lagen.
 *
 * Der Speicher liegt in `chrome.storage`, an das die Seiten-Konsole nicht
 * herankommt — deshalb der Weg über ein Ereignis am gemeinsamen `document`.
 * Verglichen wird gegen den Titel aus der Prüfliste, ohne Groß-/Kleinschreibung.
 */
/**
 * **Eine falsch gemerkte Weiterleitung wieder loswerden.**
 *
 * `netflixWeiterleitungen` gilt bewusst ohne Frist — eine Weiterleitung ändert
 * sich nicht, und ein Vermerk spart beim nächsten Mal den Umweg. Genau deshalb
 * bleibt ein **falscher** Vermerk aber auch für immer stehen.
 *
 * Am 06.09.2026 ist einer entstanden: Der Erbfall galt fünf Minuten lang und
 * für jede Seite, also erbte „The Gentlemen" (81437051) den Fate-Auftrag
 * (81186102). Der Erbfall ist seitdem einmalig und auf eine Minute begrenzt —
 * für den Vermerk, der schon im Speicher liegt, braucht es trotzdem einen
 * Handgriff.
 *
 *     document.dispatchEvent(new CustomEvent('ak-weiterleitung-vergessen', { detail: '81437051' }))
 *     document.dispatchEvent(new CustomEvent('ak-weiterleitung-vergessen', { detail: 'alle' }))
 *
 * Ausgegeben wird, was entfernt wurde — ohne Ausgabe hätte man wieder nur ein
 * `true` vom `dispatchEvent`, und das sagt nichts.
 */
document.addEventListener('ak-weiterleitung-vergessen', async (e) => {
  const was = String(e?.detail ?? '').trim()
  const vorher = { ...netflixWeiterleitungen }
  if (was === 'alle') netflixWeiterleitungen = {}
  else if (was && netflixWeiterleitungen[was] !== undefined) {
    netflixWeiterleitungen = { ...netflixWeiterleitungen }
    delete netflixWeiterleitungen[was]
  } else {
    console.log('[Anime-Kalender] Gemerkte Weiterleitungen:', vorher)
    console.log("[Anime-Kalender] Zum Löschen: { detail: '<reihenId>' } oder { detail: 'alle' }")
    return
  }
  await chrome.storage.local.set({ netflixWeiterleitungen })
  console.log('[Anime-Kalender] vorher:', vorher, '→ jetzt:', netflixWeiterleitungen)
})

document.addEventListener('ak-oeffnen', async (e) => {
  const suche = String(e?.detail ?? '')
    .trim()
    .toLowerCase()
  if (!suche) {
    console.log("[Anime-Kalender] ak-oeffnen braucht einen Text, z. B. { detail: 'kakegurui' }")
    return
  }
  const treffer = []
  for (const kennung of Object.keys(erledigt)) {
    const titel = String(offeneTitel[kennung]?.titel ?? '').toLowerCase()
    if (titel.includes(suche) || kennung === suche) treffer.push(kennung)
  }
  if (!treffer.length) {
    console.log(
      `[Anime-Kalender] nichts Abgehaktes passt auf „${suche}" — ` +
        `${Object.keys(erledigt).length} Titel im Speicher`,
    )
    return
  }
  const weg = treffer.map((k) => `${offeneTitel[k]?.titel ?? k}: ${(erledigt[k] ?? []).join(', ')}`)
  for (const kennung of treffer) delete erledigt[kennung]
  await speicherSchreiben({ erledigt })
  knopfZeigen()
  durchlaufKnopfZeigen()
  console.log(`[Anime-Kalender] ${treffer.length} Titel lokal geöffnet.`, weg)
})

/** Die Navigation, die auch ein Klick auslöst — ohne Neuladen. */
function gehe(pfad) {
  history.pushState({}, '', pfad)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

document.addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Escape' && DURCHLAUF.laeuft) {
      DURCHLAUF.abbruch = true
      console.log('[Anime-Kalender] Durchlauf wird abgebrochen …')
    }
  },
  true,
)

/**
 * **Ein Probelauf über zwei Folgen — für alles, was noch nicht sitzt.**
 *
 * Daniel am 26.08.2026: „limitier es auf 2 episoden statt alle 12, sodass
 * der debug diagnose test schneller durchläuft und ich nicht so lange warten
 * muss."
 *
 * Das ist mehr als eine Bequemlichkeit für heute. Der erste Durchlauf lief
 * über alle Folgen und öffnete dabei fremde Serien; die Lehre daraus — an
 * fünf erproben, nicht an tausend — gehört als Griff in den Code, nicht in
 * einen guten Vorsatz.
 *
 * **Umschalt+Klick** startet ihn. Rechtsklick setzt den Stand einer Reihe
 * zurück, damit dieselben Folgen erneut prüfbar werden.
 */
async function durchlaufStarten(grenze) {
  if (DURCHLAUF.laeuft) {
    DURCHLAUF.abbruch = true
    return
  }
  const titelseite = location.pathname
  const reihe = gemeinteReihe()
  if (!DURCHLAUF.uebergangen) await durchlaufStandLaden(reihe)
  DURCHLAUF.uebergangen = false
  const alleOffen = durchlaufOffen()
  /**
   * **Der Auftrag entscheidet, sonst die Ränder.**
   *
   * Nennt die Prüfliste genaue Folgen („S1 Folge 26"), werden genau die geprüft
   * — vollständig, denn ein Ausschnitt von drei Folgen ist keine Stichprobe.
   *
   * Sagt sie nur „diese Staffel ist offen", bleibt es bei der sparsamen
   * Fassung: erste und letzte offene Folge. Sie in dieser Reihenfolge zu
   * prüfen ist Absicht — die Staffelnummer aus der ersten steht dann schon
   * fest, wenn die letzte gemeldet wird. Bei uneinheitlichem Ergebnis fragt die
   * Leiste nach der Grenze.
   */
  const ausAuftrag = durchlaufAuftrag()
  const offen = ausAuftrag
    ? ausAuftrag
    : alleOffen.length > 1
      ? [alleOffen[0], alleOffen[alleOffen.length - 1]]
      : alleOffen
  DURCHLAUF.randprobe = !ausAuftrag && alleOffen.length > 1 ? alleOffen : null
  if (!offen.length) return

  /*
    Ab hier bis zum `finally` unten: Wirft irgendetwas dazwischen, bliebe
    `laeuft` sonst auf `true` stehen — und der Knopf wäre für immer tot, weil
    er einen zweiten Start abweist.
  */
  DURCHLAUF.laeuft = true
  DURCHLAUF.abbruch = false
  DURCHLAUF.stoerung = null
  DURCHLAUF.angenommen = null
  /*
    **Hier gehört der Merker zurückgesetzt, nicht beim Rechtsklick.**

    Ein Patch-Skript hat die Zeile am 26.08.2026 in `durchlaufStandVergessen()`
    einsortiert — beide Funktionen enthielten `DURCHLAUF.stoerung = null`, und
    der Anker traf den falschen. `DURCHLAUF.staffel` blieb dadurch `undefined`,
    und jede Prüfung auf `=== null` lief daran vorbei. In der Diagnose stand
    „gemerkt=undefined".

    Aufgefallen ist es nur, weil die Ausgabe den Wert genannt hat statt eines
    Urteils darüber.
  */
  DURCHLAUF.staffel = null
  DURCHLAUF.ohneStaffel = []
  DURCHLAUF.protokoll = []
  DURCHLAUF.fertig = 0
  DURCHLAUF.gesamt = offen.length
  durchlaufKnopfZeigen()

  /*
    **Die erste Folge kommt zuletzt, wenn die Staffel noch unbekannt ist.**

    Der Player holt seine Metadaten beim ersten Öffnen; bis dahin weiß niemand,
    welche Staffel läuft. Wer zuerst gemeldet wird, trägt deshalb kein
    Staffelfeld — und genau die erste Folge ist die, bei der eine falsche
    Zuordnung am meisten anrichtet (sie passt der Nummer nach auch zu Staffel 1).

    Also wird sie ans Ende gestellt: Dann ist die Staffel längst bekannt.
  */
  const reihenfolge = offen.length > 1 ? [...offen.slice(1), offen[0]] : offen

  for (const f of reihenfolge) {
    if (DURCHLAUF.abbruch) break
    videoAbdrehen(false)
    gehe(`/watch/${f.videoId}`)

    /* Warten, bis der Player die Liste hat — höchstens 20 Sekunden. */
    let spuren = null
    for (let i = 0; i < 100 && !spuren && !DURCHLAUF.abbruch; i++) {
      await new Promise((r) => setTimeout(r, 200))
      spuren = stand.spuren?.length ? stand.spuren : null
      /*
        Eine Störung beendet den Durchlauf sofort. Erst nach zwei Sekunden
        nachsehen: Beim Aufbau steht kurz alles Mögliche auf der Seite.
      */
      if (i > 10 && !spuren) {
        const code = stoerung()
        if (code) {
          DURCHLAUF.stoerung = code
          DURCHLAUF.abbruch = true
          /*
            Eine Stoerung bricht den Durchlauf ab — und ist damit genau das, wovon
            ich erfahren muss, ohne dass jemand die Konsole oeffnet.
          */
          void vorfallMelden('stoerung', {
            reihe: gemeinteReihe(),
            folge_nr: f.nummer,
            text: `Netflix meldet ${code} — Durchlauf abgebrochen`,
          })
          break
        }
      }
    }
    /*
      **Auf die Staffel warten, nicht nur auf die Tonspur.**

      Die Tonspur steht nach rund drei Sekunden im Player, die Metadaten mit
      der Staffelnummer brauchen länger. Wer sofort meldet, schickt
      `staffel: null` — und die Pipeline verteilt die Folgen dann über zwei
      Staffeln (Kakegurui, 26.08.2026: Folge 1 zu Staffel 1, der Rest zu 2).

      Die erste Folge des Durchlaufs wartet deshalb bis zu fünf Sekunden
      länger. Danach steht die Nummer für alle übrigen fest, und keine muss
      mehr warten.
    */
    if (spuren && !Number.isFinite(DURCHLAUF.staffel) && !Number.isFinite(stand.staffel)) {
      for (let i = 0; i < 25 && !Number.isFinite(stand.staffel) && !DURCHLAUF.abbruch; i++) {
        await new Promise((r) => setTimeout(r, 200))
      }
    }
    videoAbdrehen(true)

    /*
      **Zweiter Riegel: Gehört die laufende Folge überhaupt zu dieser Reihe?**

      Der erste Riegel ist die Typ-Prüfung im Leser. Dieser hier fängt, was
      trotzdem durchkommt — und am 26.08.2026 kam einiges durch: Heroes,
      Lucifer und Ozark wurden als One Piece gemeldet, weil niemand nachfragte.

      `stand.reihe` kommt aus dem Player und meint die Reihe der laufenden
      Folge. Stimmt sie nicht mit der Seite überein, wird nichts gemeldet.
    */
    const gehoertDazu = !stand.reihe || String(stand.reihe) === String(gemeinteReihe())
    if (spuren && gehoertDazu) {
      const { deutsch, echte } = urteil(spuren)
      /* Die erste erkannte Staffel gilt für die ganze Liste. */
      if (!Number.isFinite(DURCHLAUF.staffel) && Number.isFinite(stand.staffel)) {
        DURCHLAUF.staffel = stand.staffel
      }
      /**
       * **Die Staffel der Folge schlägt die des Players.**
       *
       * Der Player nennt die Staffel der gerade laufenden Folge — nur hinkt er
       * hinterher, und Netflix zählt jede Staffel neu bei 1. Bei „7 Seeds"
       * landeten dadurch 22 von 24 geprüften Folgen unter Staffel 1 und zwei
       * unter Staffel 2, praktisch zufällig verteilt (Daniel, 31.08.2026).
       *
       * Seit 4.8.0 trägt jede Folge ihre Staffel aus der Folgenliste mit —
       * dort, wo Netflix sie selbst hinschreibt. Der Player bleibt Rückfall für
       * Seiten, deren Liste keine nennt.
       */
      const staffelJetzt = Number.isFinite(f.staffel)
        ? f.staffel
        : Number.isFinite(stand.staffel)
          ? stand.staffel
          : DURCHLAUF.staffel
      /*
        Bei einer Randprobe wird erst gesammelt. Ob gemeldet wird, entscheidet
        sich, wenn beide Folgen gelesen sind — stimmen sie nicht überein, geht
        nichts raus.
      */
      if (DURCHLAUF.randprobe) {
        DURCHLAUF.randErgebnis = DURCHLAUF.randErgebnis ?? []
        DURCHLAUF.randErgebnis.push({ folge: f, echte, deutsch, staffel: staffelJetzt })
        DURCHLAUF.protokoll.push({
          Folge: f.nummer,
          Tonspuren: echte.map((x) => x.code).join(','),
          Deutsch: deutsch ? 'ja' : 'nein',
          Player: stand.staffel ?? '—',
          gemerkt: DURCHLAUF.staffel ?? '—',
          gemeldet: '(Randprobe)',
        })
        DURCHLAUF.fertig++
        durchlaufKnopfZeigen()
        gehe(titelseite)
        await new Promise((r) => setTimeout(r, 1000))
        continue
      }
      /*
        **Eine Ausgabe je Durchlauf, nicht je Folge.**

        Daniel am 26.08.2026: „mach nicht mehr so getrennte outputs, bündel
        die, ich musste danach suchen." Bei zwölf Folgen sind das zwölf Zeilen
        zwischen Netflix' eigenen Meldungen. Gesammelt und am Ende als Tabelle
        ausgegeben, findet man sie auf einen Blick.
      */
      DURCHLAUF.protokoll.push({
        Folge: f.nummer,
        Tonspuren: echte.map((x) => x.code).join(','),
        Deutsch: deutsch ? 'ja' : 'nein',
        Player: stand.staffel ?? '—',
        gemerkt: DURCHLAUF.staffel ?? '—',
        gemeldet: staffelJetzt ?? '—',
      })
      const ok = await durchlaufMelden(f, echte, deutsch)
      if (ok && !Number.isFinite(staffelJetzt)) {
        /*
          **Ohne Staffel gemeldet — das wird am Ende nachgeholt.**

          Zweimal versucht, zweimal verschoben: Erst fehlte die Nummer bei
          Folge 1, dann bei Folge 2, weil die seit 3.9 zuerst läuft. Fünf
          Sekunden Warten haben nichts geändert — beim allerersten Öffnen
          liefert der Player die Metadaten offenbar gar nicht, nicht nur spät.

          Statt einer dritten Vermutung über das Timing wird die Meldung
          nachgereicht, sobald die Staffel feststeht. Der Worker führt je
          Adresse und Folge einen Eintrag; die zweite Meldung ersetzt die
          erste.
        */
        DURCHLAUF.ohneStaffel = DURCHLAUF.ohneStaffel ?? []
        DURCHLAUF.ohneStaffel.push({ folge: f, echte, deutsch })
      }
      if (ok) {
        DURCHLAUF.gemeldet.add(f.videoId)
        meldungenMerken(reihe, [
          {
            nummer: f.nummer,
            staffel: stand.staffel,
            staffelBekannt: stand.staffel != null,
            folge: f.videoId,
            am: new Date().toISOString(),
          },
        ])
        await durchlaufStandSchreiben(reihe)
        DURCHLAUF.fertig++
      } else {
        DURCHLAUF.fehler = (DURCHLAUF.fehler ?? 0) + 1
      }
    } else if (!spuren) {
      /*
        Keine Tonspur binnen zwanzig Sekunden — die Folge bleibt offen und
        kommt beim nächsten Durchlauf wieder dran. Genau das wollte Daniel:
        „wenn ep 7 nicht erfolgreich geprüft wurde, alle anderen schon, sollte
        dort 1 folge prüfen stehen." Beim ersten Kakegurui-Lauf traf es drei
        von zwölf.
      */
      DURCHLAUF.ohneSpur = (DURCHLAUF.ohneSpur ?? 0) + 1
      /*
        **`info`, nicht `warn` — das hier ist kein Fehler.**

        Chrome sammelt `console.warn` im Fehler-Panel, und dort las Daniel am
        10.09.2026 „[Anime-Kalender] Folge 25: keine Tonspur gelesen" als
        Störung. Sie ist keine: Netflix hat binnen zwanzig Sekunden keine
        Tonspur ausgeliefert, die Folge bleibt offen und kommt beim nächsten
        Durchlauf wieder dran — genau wie vorgesehen.
      */
      console.info(`[Anime-Kalender] Folge ${f.nummer}: keine Tonspur gelesen — bleibt offen`)
      void vorfallMelden('ohne_tonspur', {
        reihe: gemeinteReihe(),
        folge_nr: f.nummer,
        text: `Folge ${f.nummer} lieferte binnen zwanzig Sekunden keine Tonspur — bleibt offen`,
      })
    } else {
      DURCHLAUF.fremde = (DURCHLAUF.fremde ?? 0) + 1
      /* Auch das ist ein geplanter Fall, kein Fehler — siehe oben. */
      console.info(
        `[Anime-Kalender] Folge ${f.nummer} gehört zu Reihe ${stand.reihe}, nicht zu ${gemeinteReihe()} — übersprungen`,
      )
      void vorfallMelden('fremde_reihe', {
        reihe: gemeinteReihe(),
        folge_nr: f.nummer,
        text: `Folge ${f.nummer} gehört laut Player zu „${stand.reihe}", erwartet war „${gemeinteReihe()}"`,
      })
    }
    durchlaufKnopfZeigen()

    gehe(titelseite)
    /* Eine Sekunde Ruhe zwischen zwei Folgen — ein Mensch klickt auch nicht schneller. */
    await new Promise((r) => setTimeout(r, 1000))
  }

  /*
    Was ohne Staffelnummer rausging, wird jetzt nachgereicht — die Nummer
    steht seit der zweiten Folge fest.
  */
  if (DURCHLAUF.ohneStaffel?.length && Number.isFinite(DURCHLAUF.staffel)) {
    for (const eintrag of DURCHLAUF.ohneStaffel) {
      await durchlaufMelden(eintrag.folge, eintrag.echte, eintrag.deutsch)
    }
    console.log(
      `[Anime-Kalender] ${DURCHLAUF.ohneStaffel.length} Meldung(en) mit Staffel ${DURCHLAUF.staffel} nachgereicht.`,
    )
  }
  DURCHLAUF.ohneStaffel = []

  /*
    **Die Randprobe auswerten.**

    Stimmen erste und letzte Folge überein, gilt der Befund für die ganze
    Staffel — als **Annahme**, und die Notiz sagt das. Unterscheiden sie sich,
    geht nichts raus: Die Grenze liegt dann irgendwo dazwischen, und wo, weiß
    nur, wer nachsieht.
  */
  if (DURCHLAUF.randprobe && DURCHLAUF.randErgebnis?.length === 2) {
    /*
      **Nach Folgennummer ordnen, nicht nach Prüfreihenfolge.**

      Seit 3.9 läuft die erste Folge zuletzt — damit die Staffelnummer schon
      feststeht, wenn sie gemeldet wird. Für die Randprobe heißt das: Der
      erste Eintrag im Ergebnis ist die **letzte** Folge. Die Notiz sagte
      dadurch „gemessen: Folge 1 und 1" statt „1 und 61" (26.08.2026).

      Eine Reihenfolge, die aus einem anderen Grund gewählt wurde, taugt nicht
      als Ordnungsmerkmal. Die Nummer schon.
    */
    const [ersteFolge, letzteFolge] = [...DURCHLAUF.randErgebnis].sort(
      (a, b) => a.folge.nummer - b.folge.nummer,
    )
    if (ersteFolge.deutsch === letzteFolge.deutsch) {
      await randMelden(DURCHLAUF.randprobe, ersteFolge, letzteFolge.folge.nummer)
      /*
        **Die Annahme gehört an den Knopf, nicht nur in die Notiz.** Daniel am
        11.09.2026: „wenn es dazu führt das e2-e25 als dub true gekennzeichnet
        werden muss es besser kommuniziert werden." Die Notiz erreicht
        `dub-confirmed.yaml`, der Knopf danach sagte bloß „26 Folgen geprüft".
      */
      const gemessen = new Set([ersteFolge.folge.nummer, letzteFolge.folge.nummer])
      DURCHLAUF.angenommen = {
        gemessen: [...gemessen],
        rest: DURCHLAUF.randprobe.map((f) => Number(f.nummer)).filter((n) => !gemessen.has(n)),
        deutsch: ersteFolge.deutsch,
        reihe: String(gemeinteReihe()),
      }
      DURCHLAUF.randOffen = null
    } else {
      /* Uneinheitlich — hier entscheidet ein Mensch, nicht eine Annahme. */
      DURCHLAUF.randOffen = {
        folgen: DURCHLAUF.randprobe,
        erste: ersteFolge,
        letzte: letzteFolge,
      }
      console.warn(
        `[Anime-Kalender] Folge ${ersteFolge.folge.nummer} ist ${ersteFolge.deutsch ? "deutsch" : "nicht deutsch"}, ` +
          `Folge ${letzteFolge.folge.nummer} ${letzteFolge.deutsch ? "deutsch" : "nicht"} — nichts gemeldet. ` +
          'Grenze im Feld unten eintragen oder den vollen Lauf starten.',
      )
    }
  }
  DURCHLAUF.randprobe = null
  DURCHLAUF.randErgebnis = null

  /* Alles auf einmal, statt verstreut zwischen Netflix' eigenen Meldungen. */
  if (DURCHLAUF.protokoll?.length) {
    console.groupCollapsed(
      `[Anime-Kalender] ${DURCHLAUF.protokoll.length} Folge(n) geprüft` +
        (DURCHLAUF.ohneSpur ? `, ${DURCHLAUF.ohneSpur} ohne Tonspur` : '') +
        (DURCHLAUF.stoerung ? `, abgebrochen bei ${DURCHLAUF.stoerung}` : ''),
    )
    console.table(DURCHLAUF.protokoll)
    console.groupEnd()
  }

  videoAbdrehen(false)
  DURCHLAUF.laeuft = false
  durchlaufKnopfZeigen()
  /*
    **Und weiter zum nächsten Auftrag — das ist der Unterschied zwischen
    „geht mit" und „läuft allein".**

    Nur nach einem selbsttätigen Durchgang, nur bis zur Obergrenze, und nur
    wenn nichts schiefgegangen ist: Eine Störung ist ein Grund anzuhalten,
    kein Grund weiterzumachen (bei `M7…` hilft ohnehin nur, andere Tabs zu
    schließen).
  */
  if (DURCHLAUF.selbst && selbstAn && !DURCHLAUF.abbruch && !DURCHLAUF.stoerung) {
    if (selbstGezaehlt >= SELBST_HOECHSTENS) {
      console.log(
        `[Anime-Kalender] Selbsttätig: ${SELBST_HOECHSTENS} Titel geschafft — Schluss für diese Sitzung. ` +
          'Neu laden, wenn es weitergehen soll.',
      )
    } else {
      const naechster = naechsterAuftrag()
      if (naechster) {
        selbstGezaehlt++
        console.log(
          `[Anime-Kalender] Selbsttätig: weiter zu ${offeneTitel[naechster]?.titel ?? naechster} ` +
            `(${selbstGezaehlt}/${SELBST_HOECHSTENS})`,
        )
        /* Wie ein Klick aus der Liste — damit die Zielseite den Auftrag erbt. */
        void speicherSchreiben({ zuletztGeoeffnet: { id: String(naechster), zeit: Date.now() } })
        zuletztGeoeffnet = { id: String(naechster), zeit: Date.now() }
        gehe(`/title/${naechster}`)
      } else {
        console.log('[Anime-Kalender] Selbsttätig: kein offener Auftrag mehr.')
      }
    }
  }
  if (DURCHLAUF.stoerung) {
    /*
      Dieselbe Trennung wie am Knopf (30.08.2026): `M7…` meint die Wiedergabe,
      alles andere den Titel. Der Rat „andere Tabs schließen" stand auch hier
      unter jedem Code und schickte bei E103 in die falsche Richtung.
    */
    console.warn(
      `[Anime-Kalender] Abgebrochen — Netflix meldet ${DURCHLAUF.stoerung}. ` +
        (/^M7/.test(DURCHLAUF.stoerung)
          ? 'Andere Netflix-Tabs schließen, dann noch einmal starten.'
          : 'Der Titel ist dort nicht abrufbar — nicht im Angebot, nicht in dieser Region oder noch nicht erschienen.'),
    )
  }
}

/** Eine Folge des Durchlaufs melden — dieselbe Route wie eine Handmeldung. */
/**
 * **Eine ganze Staffel aus zwei Messungen melden — als Annahme gekennzeichnet.**
 *
 * Dieses Projekt sagt sonst: nichts behaupten, was nicht belegt ist. Hier wird
 * bewusst etwas angenommen, und deshalb steht es in jeder einzelnen Meldung:
 * `angenommen: true` und im Klartext in der Notiz, welche zwei Folgen wirklich
 * gemessen wurden.
 *
 * Daniel am 26.08.2026: „ich will mich drauf verlassen bei netflix das 1. und
 * letzte test ausreicht." Seine Entscheidung — aber sie muss im Datensatz
 * ablesbar bleiben, sonst sieht eine Annahme später aus wie eine Messung.
 */
async function randMelden(folgen, befund, bisNummer) {
  /* `bisNummer` steht nur noch in der Notiz — gefiltert wird von den Aufrufern. */
  const { token } = await chrome.storage.sync.get('token')
  if (!token) return 0
  const reihe = gemeinteReihe()
  let gemeldet = 0
  for (const f of folgen) {
    /*
      **Eine Randprobe kann ueber Staffelgrenzen laufen — die Folge weiss, wohin.**

      `befund` ist die Messung *einer* Folge; ihre Staffel gilt nicht fuer alle
      uebrigen. Bei Dorohedoro (24 Folgen, zwei Staffeln) landeten so 1, 12 und
      13 in Staffel 1 und der Rest in Staffel 2 — die Reihenfolge, in der der
      Player sie gemeldet hat, nicht die des Anbieters (31.08.2026). Seit 4.9.0
      traegt jede Folge ihre eigene Staffel; die schlaegt beide Rueckfaelle.
    */
    /* Aus der Zuordnung der Folge, nicht aus der Ladereihenfolge — siehe staffelFuerFolge(). */
    const staffelRoh = staffelFuerFolge(reihe, f)
    /* Eine Nummer, die in diese Staffel nicht passt, geht nicht als solche raus. */
    const staffelDerFolge = staffelGeprueft(reihe, f.nummer, staffelRoh)
    try {
      const antwort = await fetch(WORKER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
        body: JSON.stringify({
          plattform: 'netflix',
          url: `https://www.netflix.com/title/${reihe}`,
          sprachen: befund.echte.map((x) => `${x.code}|${x.name}`),
          befund: befund.deutsch ? 'dub' : 'kein_dub',
          titel: stand.serientitel ?? null,
          folge: f.videoId,
          folge_nr: f.nummer,
          staffel: staffelDerFolge,
          titelId: titelIdFuer(reihe, staffelDerFolge),
          staffeln: ohneKennungen(stand.staffeln),
          serientitel: stand.serientitel ?? null,
          notiz:
            /*
              **Die Notiz ist der einzige Weg, auf dem die Annahme ankommt.**

              Ein eigenes Feld verwirft der Worker — er nimmt nur, was er kennt.
              Die Notiz reicht er dagegen unverändert bis in
              `dub-confirmed.yaml` durch, und dort muss stehen, dass hier
              zwei Folgen gemessen und der Rest angenommen wurde. Sonst sieht
              eine Annahme später aus wie eine Messung.
            */
            `ANGENOMMEN aus Randprobe — gemessen: Folge ${folgen[0].nummer} und ${bisNummer}, ` +
            `dazwischen nicht geprüft` +
            (f.titel ? ` — Folge ${f.nummer}: ${f.titel}` : ``),
          /* Auch eine abgeleitete Folge bringt ihren Titel und ihre Felder mit — für die Zuordnung. */
          rohfolgen: [
            {
              gti: f.videoId != null ? String(f.videoId) : null,
              nummer: f.nummer ?? null,
              titel: f.titel ?? null,
              staffelText: f.seasonId != null ? String(f.seasonId) : null,
              staffelNr: staffelDerFolge ?? null,
              roh: {
                liste: f.felder ?? null,
                angenommen: f.nummer !== folgen[0].nummer && f.nummer !== bisNummer,
              },
            },
          ],
        }),
      })
      if (antwort.ok) {
        gemeldet++
        DURCHLAUF.gemeldet.add(f.videoId)
        /* Abgeleitet zählt wie gemessen (Daniel, 11.09.2026) — mit demselben Datum. */
        meldungenMerken(reihe, [
          {
            nummer: f.nummer,
            staffel: staffelDerFolge,
            staffelBekannt: staffelDerFolge != null,
            folge: f.videoId,
            am: new Date().toISOString(),
          },
        ])
        /*
          **Auch die Abhakliste bekommt es mit.**

          Sie speist die Bereiche im Dialog. Ohne diesen Eintrag stand dort
          nach einer Randprobe über 61 Folgen weiter „gemeldet: E1-2, E61 |
          offen: E3-60" — die Meldungen waren raus, nur wusste die Anzeige
          nichts davon (Daniel, 26.08.2026).
        */
        await merkeErledigt(reihe, staffelDerFolge, f.nummer)
      }
    } catch {
      /* Eine verlorene Meldung hält die übrigen nicht auf. */
    }
  }
  await durchlaufStandSchreiben(reihe)
  console.log(`[Anime-Kalender] ${gemeldet} Folge(n) aus der Randprobe gemeldet.`)
  return gemeldet
}

async function durchlaufMelden(folge, echte, deutsch) {
  const { token } = await chrome.storage.sync.get('token')
  if (!token) return false
  /*
    **Die Staffel der Folge schlaegt die des Players — und sie gilt fuer beides.**

    Bis 4.9.0 ging die Meldung mit dieser Staffel raus, der lokale Vermerk aber
    mit `null`. `merkeErledigt` leitet die Staffel dann aus "genau eine offene"
    ab und steigt bei jedem Titel mit mehreren offenen Staffeln aus. Bei Death
    Note (drei Staffeln) blieb Folge 31 deshalb schwarz, obwohl die Meldung
    angekommen war (Daniel, 31.08.2026).
  */
  /*
    **Nicht mehr „die Staffel der Folge schlägt die des Players".** Die Staffel
    der Folge war die Ladereihenfolge; Haikyu!! Staffel 3 ging deshalb als S2
    raus (11.09.2026). Siehe staffelFuerFolge().
  */
  const staffelRoh = staffelFuerFolge(gemeinteReihe(), folge)
  /* Eine Nummer, die in diese Staffel nicht passt, geht nicht als solche raus. */
  const staffelDerFolge = staffelGeprueft(gemeinteReihe(), folge?.nummer, staffelRoh)
  try {
    const antwort = await fetch(WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
      body: JSON.stringify({
        plattform: 'netflix',
        url: `https://www.netflix.com/title/${gemeinteReihe()}`,
        sprachen: echte.map((s) => `${s.code}|${s.name}`),
        befund: deutsch ? 'dub' : 'kein_dub',
        /*
          **Der Player kennt bei einem Film keinen Serientitel.**

          Die erste Film-Meldung kam mit `titel: null` an (Gintama, 30.08.2026).
          Zugeordnet wird zwar über die Adresse, aber ein Eintrag ohne Namen ist
          im Briefkasten nicht nachzusehen — und genau das war am 26.08. schon
          einmal der Grund, warum eine Meldung als verloren galt.

          Der Name steht im Auftrag, den die Prüfliste mitbringt.
        */
        titel: stand.serientitel ?? folge.titel ?? null,
        folge: folge.videoId,
        /*
          **Ein Film hat keine Folge 1** — dieselbe Regel wie bei Amazon
          (22.08.2026: „filme in der liste werden als 1e01 gemeldet, obwohl es
          filme und keine serien sind"). Die Nummer entstünde hier nur, weil der
          Durchlauf intern bei eins zählt.
        */
        folge_nr: folge.film ? null : folge.nummer,
        /*
          Der Player nennt die Staffel manchmal erst nach der ersten Folge —
          dann gilt, was die Liste vorher schon gezeigt hat. Ohne das trug die
          Meldung zu Folge 1 kein Feld, und die Pipeline schlug sie der
          falschen Staffel zu.
        */
        staffel: staffelDerFolge,
        titelId: titelIdFuer(gemeinteReihe(), staffelDerFolge),
        staffeln: ohneKennungen(stand.staffeln),
        serientitel: stand.serientitel ?? null,
        notiz: `Durchlauf: Folge ${folge.nummer}${folge.titel ? ` — ${folge.titel}` : ''}`,
        /*
          **Die Rohfolge — sammeln und zuordnen sind getrennt.**

          Daniel am 01.09.2026: „einfach alles melden was da ist … anbieter
          zuordnung nicht vertrauen, sondern einzeln episoden korrekt aus
          gesammeltem zustand rauspicken und korrekt zuordnen, auch wenn
          anbieter zB folge 13 als staffel 2000 bezeichnet."

          Prime geht diesen Weg seit dem 28.08.2026: Die Meldung trägt neben
          dem Urteil die **rohen** Angaben der Seite, und `fetch-rohfolgen.ts`
          legt sie über TMDBs Folgentitel und Erstausstrahlungsdaten auf unsere
          Zählung. Netflix ging ihn nicht — und genau daran hingen am 01.09.2026
          drei Fälle an einem Tag (Kakegurui, Dorohedoro, Loser Ranger).

          Was hier mitgeht, ist alles, was der Leser gesehen hat, **unverändert**:
          Nummer und Staffel so, wie Netflix sie nennt, dazu Titel und Kennung.
          Ob die Staffelnummer stimmt, entscheidet nicht der Sammler.
        */
        rohfolgen: [
          {
            gti: folge.videoId != null ? String(folge.videoId) : null,
            nummer: folge.nummer ?? null,
            titel: folge.titel ?? null,
            sprachen: echte.map((x) => `${x.code}|${x.name}`),
            staffelText: folge.seasonId != null ? String(folge.seasonId) : null,
            staffelNr: staffelDerFolge ?? null,
            /*
              **Alles, was die Folge über sich sagt** (Daniel, 11.09.2026: „alle
              folgen maximal mögliche infos sammeln"). Aus der Folgenliste und —
              wenn der Player gerade diese Folge zeigt — aus dem Player.
            */
            roh: {
              liste: folge.felder ?? null,
              player: String(stand.folge ?? '') === String(folge.videoId) ? stand.folgeRoh : null,
              reihe: stand.reiheRoh ?? null,
            },
          },
        ],
      }),
    })
    if (!antwort.ok) return false
    await merkeErledigt(gemeinteReihe(), staffelDerFolge, folge.nummer)
    return true
  } catch {
    /* Eine verlorene Meldung hält den Durchlauf nicht auf — sie bleibt offen. */
    return false
  }
}

/**
 * **Ein Film hat keine Folgenliste — und braucht trotzdem den Durchlauf.**
 *
 * `DURCHLAUF.folgen` wird aus Netflix' `PreviewModalEpisodeSelectorSeasonEpisodes`
 * gefüllt. Bei einem Film ruft Netflix die Operation nie auf, die Liste bleibt
 * leer, und `durchlaufKnopfZeigen()` steigt bei `!folgen.length` aus. Damit gab
 * es auf der Titelseite eines Films **gar keinen** Weg: kein Melde-Knopf (ohne
 * Tonspur), kein Durchlauf-Knopf (ohne Folgen).
 *
 * Daniel am 30.08.2026: „auf der overview sollte sammel button erscheinen der
 * automatisch player öffnet liest und wieder zurück navigiert … der neue code
 * greift hier nicht."
 *
 * Die Folge, die es zu prüfen gibt, ist der Film selbst — seine `videoId` ist
 * die Kennung aus der Adresse. Damit läuft derselbe Weg wie bei einer Serie:
 * Player öffnen, Tonspur lesen, zurück.
 */
function folgenFuerFilmErgaenzen() {
  try {
    if (DURCHLAUF.laeuft) return
    /*
      **Und was schon dasteht, wird weggeräumt.**

      Der Riegel darunter verhinderte nur das Anlegen. Ein Eintrag, der vor dem
      Seitenwechsel entstand — oder bevor „Erinnern" geladen war —, blieb
      stehen: Auf der Pokémon-Seite bot der Knopf weiter „1 Folge prüfen" an,
      während daneben schon „Keine Folge da" stand (Daniel, 30.08.2026).
    */
    if (keineFolgeVorhanden() && DURCHLAUF.folgen.length === 1 && DURCHLAUF.folgen[0]?.film) {
      DURCHLAUF.folgen = []
    }
    if (DURCHLAUF.folgen.length) return
    /*
      **Wo „Erinnern" steht, gibt es nichts zu prüfen.**

      Bei „Pokémon: Blauer Himmel in der Ferne!" bot der Knopf „1 Folge prüfen"
      an, obwohl die Seite nur einen Erinnern-Knopf zeigt — der Titel ist dort
      noch gar nicht abrufbar. Der Klick führte folgerichtig auf `/watch/…` mit
      Fehlercode E103, „Dieser Titel steht nicht zum Streaming zur Verfügung"
      (Daniel, 30.08.2026: „warum kann ich 1 folge prüfen, obwohl da erinnern
      steht und keine folge da ist?").

      Der Melde-Knopf daneben kennt den Fall längst und bietet „Keine Folge da —
      als nicht abrufbar melden" an. Das ist die richtige Antwort; ein
      Durchlauf, der ins Leere fährt, ist keine.
    */
    if (keineFolgeVorhanden()) return
    const reihe = gemeinteReihe()
    if (!reihe) return
    const eintrag = offeneTitel[String(reihe)]
    const staffeln = eintrag?.staffeln ?? []
    if (staffeln.length !== 1 || !staffeln[0]?.film) return
    DURCHLAUF.folgen = [{ nummer: 1, videoId: Number(reihe), titel: eintrag.titel ?? '', staffel: null, film: true }]
  } catch {
    /* Ohne Prüflisten-Eintrag bleibt es beim bisherigen Verhalten. */
  }
}

function durchlaufKnopfZeigen() {
  folgenFuerFilmErgaenzen()
  /*
    **Der Durchlauf über die ganze Reihe ist richtig, nicht zu viel.**

    Eine Fassung vorher hatte ich ihn auf einer geerbten Seite gesperrt: „Blauer
    Himmel in der Ferne!" sei eine Folge, die Reihe habe 54, das wären
    dreiundfünfzig Meldungen zu viel. Daniel hat widersprochen, und er hat
    recht (30.08.2026): „alle melden würde info zu dieser einen speziellen
    episode und allen anderen geben, sonst fragst du mich einzeln nach den 54
    folgen."

    Jede Folge einzeln zu lesen ist genau der Zweck — es beantwortet die Frage
    für den gemeinten Titel **und** für alle übrigen in einem Durchgang. Der
    Fehler saß nie hier, sondern im Zuschnitt des Auftrags.
  */
  /*
    **Während eines Durchlaufs bleibt der Knopf sichtbar — auch im Player.**

    Daniel am 26.08.2026, als der Durchlauf fremde Serien öffnete: „welchen
    knopf soll ich sofort anklicken? ich schließe mal den tab." Der Knopf saß
    nur auf der Titelseite, und der Durchlauf ist die meiste Zeit im Player.
    Es gab also keinen Weg, ihn anzuhalten, außer den Tab zu schließen.

    Ein Notausgang, den man nicht sieht, ist keiner.
  */
  if ((imPlayer() && !DURCHLAUF.laeuft) || !DURCHLAUF.folgen.length) {
    if (DURCHLAUF.leiste) {
      DURCHLAUF.leiste.remove()
      DURCHLAUF.leiste = null
      DURCHLAUF.knopf = null
      DURCHLAUF.grenzKnopf = null
      DURCHLAUF.nochmalKnopf = null
      DURCHLAUF.grenzeMeldenKnopf = null
      /*
        **Auch das Grenzfeld — sonst überlebt die Referenz ihr Element.**

        Daniel am 31.08.2026 an „Black Clover": Der Durchlauf endete
        uneinheitlich, das Feld „dt. bis Flg. ?" erschien, er öffnete einzelne
        Folgen zum Nachprüfen — und im Player räumt diese Stelle die Leiste ab.
        Zurück auf der Titelseite baute sie sich neu auf, das Feld aber nicht:
        `DURCHLAUF.grenzFeld` war noch gesetzt, also hielt der Aufbau es für
        vorhanden. Es hing nur längst in keinem Dokument mehr.

        Sein Befund: „ich hab einzeln episoden geprüft, herausgefunden es geht
        bis 155 deutsch, wollte melden, aber das input ist weg."
      */
      DURCHLAUF.grenzFeld = null
      DURCHLAUF.grenzKnopf = null
      DURCHLAUF.nochmalKnopf = null
      DURCHLAUF.grenzeMeldenKnopf = null
    }
    schutzflaecheZeigen(false)
    return
  }
  if (!DURCHLAUF.knopf) {
    /*
      **Beide Knöpfe in einer Zeile, nicht an zwei Bildschirmrändern.**

      Der Schalter stand zuerst mit `left: 16px` da — also am anderen Ende des
      Fensters, weit weg von dem Knopf, auf den er wirkt (Daniel, 26.08.2026:
      „button ist links am rand statt links neben anderem button").

      Ein gemeinsamer Behälter löst das ohne Rechnerei: Die Breite des
      Hauptknopfes ändert sich mit seiner Beschriftung, jede feste Zahl wäre
      beim nächsten Text falsch.
    */
    DURCHLAUF.leiste = document.createElement('div')
    DURCHLAUF.leiste.className = 'ak-durchlauf-leiste'
    /*
      **Ein Klick in der Leiste gehört uns, nicht Netflix — und auch nicht mir.**

      Der erste Anlauf hing `stopPropagation` in die **Capture**-Phase des
      Behälters. Ein Ereignis läuft dort von oben nach unten: Es erreichte die
      Leiste, wurde gestoppt — und kam bei den Knöpfen darin nie an. Beide
      waren tot, ohne Fehlermeldung (Daniel, 26.08.2026: „button klick hat
      jetzt keinen effekt mehr... nichts passiert", „auch auf limit icon
      passiert nix").

      Gestoppt wird deshalb in der **Bubble**-Phase: Da haben die Knöpfe schon
      reagiert, und nur der Weg nach oben endet hier.

      Netflix schließt sein Overlay aber über einen Listener am Dokument, und
      der kann in der Capture-Phase liegen — dann läuft er vor jedem Stoppen
      hier. Deshalb zusätzlich ein eigener Wächter am Dokument, der Klicks aus
      unserer Leiste dort abfängt.
    */
    for (const art of ['click', 'mousedown', 'pointerdown']) {
      /*
        In der Bubble-Phase, also nachdem die Knöpfe reagiert haben. Netflix
        erfährt von dem Klick nichts mehr — sofern sein eigener Listener nicht
        in der Capture-Phase liegt.
      */
      DURCHLAUF.leiste.addEventListener(art, (e) => e.stopPropagation())
    }
    DURCHLAUF.knopf = document.createElement('button')
    DURCHLAUF.knopf.className = 'ak-durchlauf'
    DURCHLAUF.knopf.addEventListener(
      'click',
      /* Mit Umschalt nur zwei Folgen — zum Erproben, ohne lange zu warten. */
      (e) => {
        /*
          Läuft schon etwas, tut ein Klick nichts mehr.

          Daniel am 26.08.2026: „da steht danach aber immer noch klickbar …
          mach es direkt nicht klickbar, sonst könnte es issues geben."
          Abgebrochen wird über den Knopftext (der zeigt dann „abbrechen") und
          über Escape — ein zweiter Start mitten im Lauf wäre etwas anderes.
        */
        /*
          **Der Klick sagt, was er tut — zweimal geraten reicht.**

          Daniel am 26.08.2026: „nichts passiert bei klick. diagnose oder weiter
          raten?" Ein Klick, der still endet, ist von einem, der gar nicht
          ankommt, nicht zu unterscheiden. Jetzt nennt er den Zustand, an dem er
          scheitert.
        */
        const zustand = {
          laeuft: DURCHLAUF.laeuft,
          offen: durchlaufOffen().length,
          folgenBekannt: DURCHLAUF.folgen.length,
          gemeldet: DURCHLAUF.gemeldet.size,
          auftrag: durchlaufAuftrag()?.map((f) => f.nummer) ?? null,
          shift: e.shiftKey,
        }
        if (DURCHLAUF.laeuft) {
          console.warn('[Anime-Kalender] Klick verworfen — läuft schon:', zustand)
          return
        }
        /* Ist alles gemeldet, tut ein Klick nichts — der Rechtsklick bleibt. */
        if (!durchlaufOffen().length) {
          console.warn('[Anime-Kalender] Klick verworfen — nichts offen:', zustand)
          return
        }
        console.log('[Anime-Kalender] Durchlauf startet:', zustand)
        /*
          **Zwei Folgen sind die Vorgabe, alle nur mit Umschalt.**

          Daniel am 26.08.2026: „wir haben eigentlich gesagt für debugging
          reicht 2 prüfung, warum kein limit eingebaut?" Es war eingebaut —
          hinter Umschalt+Klick, also genau dort, wo man es beim normalen
          Klicken nicht trifft. Solange etwas erprobt wird, gehört die sparsame
          Fassung auf den Hauptweg und die teure hinter den Griff.
        */
        /* Umschalt kehrt die Einstellung für diesen einen Lauf um. */
        /*
          Die Grenze ist Geschichte: `durchlaufStarten()` liest den Auftrag aus
          der Prüfliste und fällt sonst auf erste und letzte offene Folge
          zurück. Umschalt bleibt als Griff für den vollen Lauf.
        */
        void durchlaufStarten(e.shiftKey ? 0 : undefined)
      },
    )
    /*
      **Den Modus-Umschalter gibt es seit dem 10.09.2026 nicht mehr.**

      Er wechselte zwischen „zwei Folgen", „alle" und „Anfang und Ende" — eine
      Frage an den Menschen, deren Antwort seit heute Vormittag in der Prüfliste
      steht: Sie nennt je Eintrag `erste` und `folgen`, also „S1 Folge 26" oder
      „S1 F13–15". `durchlaufAuftrag()` liest das, und der Knopf schreibt es hin.

      Daniel: „mach es so das es minimal invasiv für mich ist und gleichzeitig
      maximale abdeckung hat, ein button für alles je nach zustand und
      melde-item." Wo die Liste nichts Genaues weiß, bleibt es bei erster und
      letzter offener Folge — dem sparsamen Weg, der seit dem 26.08.2026 der
      richtige ist.
    */

    /**
     * **Was nur der Rechtsklick konnte, kann jetzt ein Knopf.**
     *
     * „Stand für einen Lauf übergehen" stand im Tooltip des Hauptknopfs — also
     * an einer Stelle, die niemand liest, bevor er sie braucht. Daniel am
     * 10.09.2026: „rechtsklick verhalten ist versteckt, mach es sichtbar, es
     * sollte kein verstecktes wissen geben, erweiterung muss klar und deutlich
     * ihr verhalten kommunizieren."
     *
     * Der Rechtsklick bleibt — er ist der schnellere Weg für den, der ihn
     * kennt. Neu ist, dass man ihn nicht kennen muss.
     */
    DURCHLAUF.nochmalKnopf = document.createElement('button')
    DURCHLAUF.nochmalKnopf.className = 'ak-durchlauf ak-grenze'
    DURCHLAUF.nochmalKnopf.textContent = '↻ alle'
    DURCHLAUF.nochmalKnopf.title =
      'Prüft auch die Folgen noch einmal, die schon gemeldet sind.\nGilt für einen Lauf.'
    DURCHLAUF.nochmalKnopf.addEventListener('click', () => {
      console.log('[Anime-Kalender] Stand wird für einen Lauf übergangen')
      void durchlaufStandVergessen()
    })
    DURCHLAUF.leiste.appendChild(DURCHLAUF.nochmalKnopf)

    DURCHLAUF.knopf.addEventListener(
      'contextmenu',
      (e) => {
        e.preventDefault()
        void durchlaufStandVergessen()
      },
      false,
    )
    DURCHLAUF.leiste.appendChild(DURCHLAUF.knopf)
    /*
      **In den Kasten, nicht an den Bildschirmrand** (10.09.2026). Die Leiste
      war ein eigenes schwebendes Element mit eigenem Abstand; jetzt ist sie die
      Melde-Zeile des gemeinsamen Kastens und rückt mit ihm.
    */
    const kasten = netflixKasten()
    kasten.querySelector('.ak-z-melden')?.appendChild(DURCHLAUF.leiste)
    netflixDebugZeile(kasten)
    schutzflaecheZeigen(true)
  }
  /**
   * **Der Knopf zeigt, was noch fehlt — nicht, was es insgesamt gibt.**
   *
   * Daniel am 26.08.2026 nach dem ersten vollständigen Lauf: „button sollte
   * nicht erneut klickbar sein nach erfolgreicher prüfung, nur differenz
   * episoden sollte dort auftauchen (zB wenn ep 7 nicht erfolgreich geprüft
   * wurde, alle anderen schon, sollte dort 1 folge prüfen stehen)."
   */
  const offen = durchlaufOffen().length

  /*
    **Der Schalter wird zuerst beschriftet — vor jedem Rücksprung.**

    Er stand am Ende der Funktion, hinter drei `return`. Ist alles gemeldet
    („61 Folgen geprüft"), springt die Funktion vorher heraus, und das Icam
    blieb stehen, obwohl der Zustand längst gewechselt hatte. Daniel am
    26.08.2026: „Schalter geklickt, Grenze war -1 … Grenze war 0 … aber icon
    bleibt gleich."

    Der Klick hat also immer funktioniert. Nur die Anzeige kam nicht mehr dazu.
  */
  if (DURCHLAUF.nochmalKnopf) DURCHLAUF.nochmalKnopf.hidden = DURCHLAUF.laeuft
  if (!DURCHLAUF.laeuft && DURCHLAUF.stoerung) {
    /*
      **Nicht jede Störung heißt „zu viele Tabs".**

      Der Rat stand unter jedem Code. Bei „Pokémon: Blauer Himmel in der Ferne!"
      führte der Durchlauf auf eine Seite mit **E103** — „Dieser Titel steht
      nicht zum Streaming zur Verfügung" —, und der Knopf riet, andere Tabs zu
      schließen (Daniel, 30.08.2026: „falscher error?"). Das schickt in die
      falsche Richtung: Kein geschlossener Tab macht einen Titel verfügbar.

      Netflix' Codes trennen die Fälle sauber: `M7…` meint die Wiedergabe selbst
      (zu viele Streams, Netzwerk), `E1…`, `UI…` und `NSES-…` meinen den Titel.
    */
    const wiedergabe = /^M7/.test(DURCHLAUF.stoerung)
    DURCHLAUF.knopf.textContent = wiedergabe
      ? `⚠ ${DURCHLAUF.stoerung} — andere Tabs schließen`
      : `⚠ ${DURCHLAUF.stoerung} — hier nicht abrufbar`
    DURCHLAUF.knopf.title = wiedergabe
      ? 'Netflix erlaubt nur eine laufende Wiedergabe. Andere Netflix-Tabs schließen, dann hier klicken.'
      : 'Netflix gibt den Titel nicht wieder — nicht im Angebot, nicht in dieser Region oder ' +
        'noch nicht erschienen. In der Prüfliste über „nichts da?" abhaken, wenn die Suche ihn auch nicht findet.'
    DURCHLAUF.knopf.disabled = false
    DURCHLAUF.knopf.classList.remove('ak-fertig')
    return
  }
  if (DURCHLAUF.laeuft) {
    /*
      **Abbrechen lohnt erst ab drei Folgen.**

      Daniel am 26.08.2026: „nach den 2 getesteten folgen bleibt der button
      klickbar, bis nach mehreren sekunden der button zu „61 folgen geprüft"
      wird. mach ihn direkt unklickbar (nicht abbrechbar), macht eh nur sinn
      bei mehr als 2 folgen prüfung."

      Bei zwei Folgen ist der Lauf vorbei, bevor jemand den Knopf trifft — ein
      klickbarer Abbruch verspricht dann etwas, das er nicht mehr einlösen kann.
    */
    const lohntAbbruch = DURCHLAUF.gesamt > 2
    DURCHLAUF.knopf.textContent = lohntAbbruch
      ? `⏹ ${DURCHLAUF.fertig}/${DURCHLAUF.gesamt} — abbrechen`
      : `${DURCHLAUF.fertig}/${DURCHLAUF.gesamt} — läuft`
    DURCHLAUF.knopf.title = lohntAbbruch
      ? 'Läuft — jede Folge wird kurz geöffnet und wieder verlassen. Escape bricht ab.'
      : 'Läuft — gleich fertig.'
    DURCHLAUF.knopf.disabled = !lohntAbbruch
    DURCHLAUF.knopf.classList.remove('ak-fertig')
    return
  }
  if (!offen) {
    const ang = DURCHLAUF.angenommen?.reihe === String(gemeinteReihe()) ? DURCHLAUF.angenommen : null
    DURCHLAUF.knopf.textContent = ang?.rest.length
      ? `✓ E${ang.gemessen.join(' + E')} ${ang.deutsch ? 'deutsch' : 'ohne Deutsch'} · E${alsBereiche(ang.rest).join(', ')} angenommen`
      : `✓ ${DURCHLAUF.folgen.length} Folgen geprüft`
    DURCHLAUF.knopf.title =
      (ang?.rest.length ? 'Die angenommenen Folgen sind so gemeldet und in der Notiz als angenommen vermerkt.\n' : '') +
      'Alles gemeldet. Neue Folgen tauchen hier wieder auf.\nRechtsklick: Stand verwerfen und erneut prüfen.'
    /* Abgeschaltet wäre auch der Rechtsklick tot — also nur still, nicht taub. */
    DURCHLAUF.knopf.disabled = false
    DURCHLAUF.knopf.classList.add('ak-fertig')
    return
  }
  DURCHLAUF.knopf.disabled = false
  DURCHLAUF.knopf.classList.remove('ak-fertig')
  /* Der Knopf nennt, was ein Klick wirklich tut — nicht, was insgesamt offen ist. */
  /*
    **Während eines Laufs verschwindet der Schalter.**

    Daniel am 26.08.2026: „während das skript läuft sollte limit icon nicht
    sichtbar und nicht klickbar sein." Eine Einstellung, die den laufenden
    Durchlauf nicht mehr ändern kann, gehört nicht angeboten — ein Klick darauf
    sähe aus wie eine Wirkung und hätte keine.
  */
  if (DURCHLAUF.grenzKnopf) DURCHLAUF.grenzKnopf.hidden = DURCHLAUF.laeuft
  if (DURCHLAUF.nochmalKnopf) DURCHLAUF.nochmalKnopf.hidden = DURCHLAUF.laeuft

  /*
    **Uneinheitliche Randprobe: hier entscheidet ein Mensch.**

    Ist die erste Folge deutsch und die letzte nicht, liegt die Grenze
    irgendwo dazwischen. Eine Annahme wäre hier eine Behauptung über bis zu
    sechzig Folgen, gestützt auf zwei — genau das, was dieses Projekt sonst
    an fremden Quellen bemängelt.

    Also wird gefragt: Bis zu welcher Folge ist es deutsch? Daniel prüft das
    schneller von Hand, als jeder Durchlauf es könnte. Wer lieber messen will,
    stellt auf „alle" und lässt laufen — beide Wege stehen offen.
  */
  if (DURCHLAUF.randOffen && !DURCHLAUF.laeuft) {
    /*
      `isConnected` statt eines bloßen Daseins-Tests: Eine Referenz auf ein
      entferntes Element ist wahr und trotzdem wertlos. Der Fall oben ist der
      belegte; dieser Riegel fängt jeden weiteren, ohne ihn zu kennen.
    */
    if (!DURCHLAUF.grenzFeld?.isConnected) {
      DURCHLAUF.grenzFeld = document.createElement('input')
      DURCHLAUF.grenzFeld.className = 'ak-grenzfeld'
      DURCHLAUF.grenzFeld.type = 'number'
      DURCHLAUF.grenzFeld.min = '1'
      DURCHLAUF.grenzFeld.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') void grenzeUebernehmen()
      })
      DURCHLAUF.leiste.insertBefore(DURCHLAUF.grenzFeld, DURCHLAUF.leiste.firstChild)
    }
    /*
      **Enter allein ist keine Bedienung — der Weg muss zu sehen sein.**

      Die Aufforderung „Zahl eintippen, Enter" stand nur im Tooltip des Feldes.
      Daniel hat 155 eingetragen und dann gefragt: „wie melde ich die bis 155?
      es gibt kein bestätigen oder so button?" (31.08.2026). Enter blieb
      selbstverständlich, der Knopf steht jetzt daneben.
    */
    /**
     * **Eigene Variable — `grenzKnopf` gehört dem Umschalter.**
     *
     * Beide Knöpfe hießen `DURCHLAUF.grenzKnopf`: der Umschalter `⏱ 2 / ⏱ alle /
     * ⇤⇥` in der Leiste und dieser hier am Grenzfeld. Der Umschalter entsteht
     * beim Aufbau der Leiste und ist danach **verbunden** — die Bedingung
     * `!isConnected` traf deshalb nie zu, und der Melde-Knopf wurde nie
     * angelegt. Stattdessen bekam der Umschalter ein `hidden = false`, das ihm
     * ohnehin galt.
     *
     * Gefunden am 10.09.2026 beim Einbau des „↻ alle"-Knopfs daneben. Daniels
     * Meldung vom 31.08.2026 („wie melde ich die bis 155? es gibt kein
     * bestätigen oder so button?") war damit nur scheinbar behoben: Der Knopf
     * stand im Quelltext und im Sandkasten, aber nie auf der Seite.
     */
    if (!DURCHLAUF.grenzeMeldenKnopf?.isConnected) {
      DURCHLAUF.grenzeMeldenKnopf = document.createElement('button')
      DURCHLAUF.grenzeMeldenKnopf.className = 'ak-grenzknopf'
      DURCHLAUF.grenzeMeldenKnopf.textContent = '✓ melden'
      DURCHLAUF.grenzeMeldenKnopf.addEventListener('click', () => void grenzeUebernehmen())
      DURCHLAUF.grenzFeld.after(DURCHLAUF.grenzeMeldenKnopf)
    }
    DURCHLAUF.grenzeMeldenKnopf.hidden = false
    const { erste, letzte } = DURCHLAUF.randOffen
    DURCHLAUF.grenzFeld.placeholder = `dt. bis Flg. ?`
    DURCHLAUF.grenzFeld.max = String(letzte.folge.nummer)
    DURCHLAUF.grenzFeld.title =
      `Folge ${erste.folge.nummer}: ${erste.deutsch ? 'deutsch' : 'kein Deutsch'}, ` +
      `Folge ${letzte.folge.nummer}: ${letzte.deutsch ? 'deutsch' : 'kein Deutsch'}.\n` +
      'Bis zu welcher Folge ist es deutsch? Zahl eintippen, Enter.'
    DURCHLAUF.grenzFeld.hidden = false
    DURCHLAUF.knopf.classList.add('ak-uneinheitlich')
  } else {
    if (DURCHLAUF.grenzFeld) DURCHLAUF.grenzFeld.hidden = true
    if (DURCHLAUF.grenzeMeldenKnopf) DURCHLAUF.grenzeMeldenKnopf.hidden = true
    DURCHLAUF.knopf?.classList.remove('ak-uneinheitlich')
  }
  /* Die offenen Folgen selbst — für die Spanne im Knopftext. */
  const liste = durchlaufOffen()
  /**
   * **Der Knopf sagt, was er tut — und das steht in der Prüfliste.**
   *
   * Drei Lagen, und keine davon fragt zurück:
   *
   * | Was die Prüfliste sagt | Was der Knopf tut |
   * |---|---|
   * | genaue Folgen („S1 F26", „S1 F13–15") | prüft genau die, vollständig |
   * | nur „diese Staffel ist offen" | erste und letzte offene — der sparsame Weg |
   * | nichts mehr offen | erscheint gar nicht |
   *
   * Daniel am 10.09.2026: „ein button für alles je nach zustand und melde-item."
   * Ein Umschalter davor wäre eine Frage an den Menschen, deren Antwort schon
   * dasteht.
   */
  const auftrag = durchlaufAuftrag()
  /*
    **Kennt die Liste die Staffel und will daraus nichts mehr, ist der Knopf
    fertig** — keine Stichprobe über Folgen, die längst belegt sind (Daniel,
    11.09.2026: „nur E2 + E25" bei Haikyu!!, Staffel 1, wo E26 schon gemeldet
    war).
  */
  if (auftrag && !auftrag.length) {
    /*
      **Die ganze Staffel, mit Herkunft und Datum** (Daniel, 11.09.2026:
      „extension box muss sagen was bereits für die staffel gemeldet wurde").
      Die Zeilen kommen aus `zustandZeilen()`, derselben Funktion wie im Dialog.
    */
    const geladen = geladeneZustaende() ?? []
    DURCHLAUF.knopf.textContent = `✓ E${alsBereiche(geladen.map((z) => z.n)).join(', ')} erledigt`
    DURCHLAUF.knopf.title = [
      ...zustandZeilen(geladen),
      'Aus dieser Staffel steht nichts mehr auf der Prüfliste.',
      '„↻ alle" prüft trotzdem jede Folge noch einmal.',
    ].join('\n')
    DURCHLAUF.knopf.classList.add('ak-fertig')
    return
  }
  DURCHLAUF.knopf.textContent = auftrag
    ? auftrag.length === 1
      ? `▶ Episode ${auftrag[0].nummer} prüfen`
      : `▶ Episoden ${alsBereiche(auftrag.map((f) => Number(f.nummer))).join(', ')} prüfen`
    : offen > 2
      ? /*
          **Zwei Folgen, keine Spanne.** „Anfang & Ende (1–26)" las sich wie
          „prüft 1 bis 26" — Daniel am 10.09.2026: „erst stand auf button 1-26,
          ich hab geklickt, er hat gemeldet, jetzt steht 2-25… was ist los?"
          Geprüft wurden genau zwei, und danach war der Rest offen. Das Pluszeichen
          sagt, was der Bindestrich verschwiegen hat.
        */
        /*
          **E wie Episode, nicht F wie Folge** (Daniel, 10.09.2026: „änder das
          f, es soll e sein, e für episode, nicht f für folge"). Die Pillen der
          Prüfliste schreiben seit jeher `E26`; hier stand `F26`, und zwei
          Schreibweisen für dieselbe Sache auf einem Bildschirm liest man als
          zwei Angaben.
        */
        /*
          **Und das Plus verschweigt nicht mehr, was daraus folgt** (Daniel,
          11.09.2026: „wenn es dazu führt das e2-e25 als dub true gekennzeichnet
          werden muss es besser kommuniziert werden"). Stimmen beide überein,
          meldet `randMelden()` den Rest als Annahme mit.
        */
        `▶ E${liste[0]?.nummer ?? 1} + E${liste[liste.length - 1]?.nummer ?? offen} prüfen → gilt für ` +
        `E${alsBereiche(liste.map((f) => Number(f.nummer))).join(', ')}`
      : `▶ ${offen} ${offen === 1 ? 'Folge' : 'Folgen'} prüfen`
  const stand =
    offen === DURCHLAUF.folgen.length
      ? `${offen} Folgen sind bekannt. Jede wird kurz geöffnet; das landet in „Weiter ansehen".`
      : `${DURCHLAUF.folgen.length - offen} von ${DURCHLAUF.folgen.length} sind gemeldet, ${offen} fehlen noch.`
  /**
   * **Warum etwas offen blieb, gehört an den Knopf.**
   *
   * Blieb eine Folge ohne Tonspur, stand die Zahl bisher in einer
   * **eingeklappten** Konsolengruppe („3 Folge(n) geprüft, 2 ohne Tonspur") —
   * also an der einen Stelle, die niemand aufklappt. Sichtbar war nur die
   * Warnung im Fehler-Panel, und die las sich wie eine Störung.
   *
   * Jetzt sagt es der Knopf selbst: Der Lauf ist durch, so viele blieben offen,
   * und ein zweiter Klick holt sie. Daniel am 10.09.2026: „erweiterung muss
   * klar und deutlich ihr verhalten kommunizieren."
   */
  const ohneSpur = DURCHLAUF.ohneSpur ?? 0
  if (!DURCHLAUF.laeuft && ohneSpur > 0 && offen > 0) {
    DURCHLAUF.knopf.textContent =
      `↻ ${ohneSpur} ohne Tonspur — noch einmal`
  }
  DURCHLAUF.knopf.title =
    stand +
    (!auftrag && offen > 2
      ? '\nWeichen beide voneinander ab, wird nichts angenommen; dann fragt die Leiste nach der Grenze.'
      : '') +
    (ohneSpur
      ? `\n${ohneSpur} Folge(n) lieferten binnen zwanzig Sekunden keine Tonspur. Das ist keine Störung — ein zweiter Lauf holt sie meist.`
      : '') +
    '\nUmschalt+Klick: prüft alle offenen Folgen statt nur der genannten.' +
    '\nDer Knopf „↻ alle" daneben prüft auch schon gemeldete Folgen noch einmal.'
}

/**
 * **Eine Fläche über der ganzen Ecke, die versehentliche Klicks schluckt.**
 *
 * Netflix schließt sein Titel-Overlay bei jedem Klick außerhalb. Wer neben
 * einen unserer Knöpfe trifft, verliert dadurch die Ansicht — und das passiert
 * ständig, weil die Knöpfe klein sind und dicht beieinander liegen.
 *
 * Zwei Anläufe sind vorher gescheitert, beide am selben Denkfehler:
 *  in der **Capture**-Phase, erst am Behälter, dann am
 * Dokument. Ein Ereignis läuft von oben nach unten, bevor es zurückläuft; wer
 * es oben anhält, nimmt es dem Ziel weg. Die Knöpfe waren tot, ohne
 * Fehlermeldung.
 *
 * Diese Fläche macht es anders: Sie **ist** das Ziel. Ein Klick auf sie
 * erreicht Netflix nicht, weil sie darüber liegt — kein Abfangen nötig. Die
 * Knöpfe liegen wiederum über ihr und bekommen ihre Klicks wie zuvor.
 */
let schutzflaeche = null

function schutzflaecheZeigen(sichtbar) {
  if (!sichtbar) {
    schutzflaeche?.remove()
    schutzflaeche = null
    return
  }
  if (schutzflaeche) return
  schutzflaeche = document.createElement("div")
  schutzflaeche.className = "ak-schutzflaeche"
  schutzflaeche.title = "Klicks hier schließen die Netflix-Ansicht nicht"
  /* Ein Klick endet hier — er hat kein Ziel darunter. */
  for (const art of ["click", "mousedown", "pointerdown"]) {
    schutzflaeche.addEventListener(art, (e) => e.stopPropagation())
  }
  document.body.appendChild(schutzflaeche)
}

let uebersichtKnopf = null

function uebersichtZeigen() {
  /*
    **Eine leere Liste nimmt den Knopf nicht mehr weg** (Daniel, 06.09.2026:
    „wenn 0 einträge, dann prüfliste button trotzdem anzeigen mit 'alles
    gemeldet'").

    Bis 4.14.9 verschwand er ganz, sobald ein Datenlauf die letzten Meldungen
    übernommen hatte — mit der Begründung, dann gebe es wirklich nichts mehr.
    Das stimmt für den Arbeitsvorrat und nicht für den Zugang: Ein Knopf, der
    an einem Tag da ist und am nächsten fehlt, sieht aus wie eine kaputte
    Erweiterung. Genau danach hat Daniel an diesem Abend viermal gesucht.

    Im Player bleibt es beim Verschwinden — dort ist die Erweiterung
    unsichtbar (22.08.2026).
  */
  if (imPlayer()) {
    if (uebersichtKnopf) {
      uebersichtKnopf.remove()
      uebersichtKnopf = null
    }
    return
  }
  /*
    **Eine Variable ist kein Beweis, dass das Element noch im Dokument hängt.**

    Hier stand `if (!uebersichtKnopf)`. Netflix ist eine Einseiten-Anwendung und
    baut beim Navigieren Teile des `body` neu auf — der Knopf verschwindet dabei
    mit, die Variable zeigt aber weiter auf das herausgelöste Element. Danach
    war die Bedingung für immer falsch, und niemand hängte ihn wieder an.

    Daniel am 06.09.2026, dreimal an einem Abend: „prüfliste button fehlt
    weiterhin auf netflix … die liste meine ich." Der Sandkasten
    (`melder-uebersicht.test.cjs`) zeigte den Knopf jedes Mal — er stellt eine
    Seite nach, die sich nicht mehr ändert, und traf damit genau die Hälfte des
    Lebens, in der alles stimmt.

    Gefragt wird deshalb das Dokument, nicht die Variable.
  */
  if (!uebersichtKnopf || !document.body.contains(uebersichtKnopf)) {
    uebersichtKnopf = document.createElement('button')
    /*
      `ak-uebersicht-innen` dazu: Die Grundklasse trägt die Lage für einen frei
      schwebenden Knopf, die zweite das Aussehen im Fuß. Ohne sie stünde er
      weiterhin am Bildschirmrand statt im Kasten.
    */
    uebersichtKnopf.className = 'ak-uebersicht ak-uebersicht-innen'
    uebersichtKnopf.addEventListener('click', dialogOeffnen)
    /*
      **In die Mitte des Fußes, wie bei Prime** (10.09.2026). Der linke Platz
      ist seit 4.11.0 ausgeblendet — er trug einmal die Marke „gemeldet ✓". Der
      Knopf schwebte vorher eigenständig am Bildschirmrand; damit standen drei
      Elemente untereinander, die zusammengehören.
    */
    /*
      Defensiv: Ein fehlender Platz darf nicht den ganzen Zeichner abbrechen —
      dahinter hängt die Prüfliste, und die soll auch dann noch aufgehen.
    */
    netflixKasten().querySelector('.ak-such-fuss-mitte')?.appendChild(uebersichtKnopf)
  }
  /*
    **Und rechts daneben aniSearch** — die Seite, die eine Reihe klärt, wenn
    Netflix sie anders schneidet als wir. Im Prüflisten-Dialog steht der Verweis
    seit dem 28.08.2026; auf der Titelseite, wo wirklich gearbeitet wird, fehlte
    er. Daniel am 10.09.2026: „aniesearch link, ak-report button, etc. auch vom
    ablauf etc. … versuch es möglichst gleichzuziehen."

    Er zeigt auf **den Titel, an dem gerade gearbeitet wird**, nicht auf die
    Reihe im Allgemeinen: `gemeinteReihe()` löst die Netflix-Kennung in unseren
    Eintrag auf, und der trägt die aniSearch-Kennung.
  */
  {
    const platz = netflixKasten().querySelector('.ak-such-fuss-rechts')
    const asId = (() => {
      try {
        return offeneTitel[String(gemeinteReihe())]?.asId ?? null
      } catch {
        return null
      }
    })()
    const vorhanden = platz?.querySelector('.ak-such-quelle')
    if (!asId) {
      vorhanden?.remove()
    } else if (!vorhanden) {
      const link = document.createElement('a')
      /*
        `ak-such-quelle`, nicht `ak-quelle`: Die erste Klasse gehört zum Fuß des
        Kastens und teilt sich die Breite mit dem Knopf daneben; die zweite ist
        die Zeile im Prüflisten-Dialog. Mit der falschen nahm aniSearch die
        ganze Breite ein (10.09.2026, im Bild sichtbar).
      */
      link.className = 'ak-such-quelle'
      link.href = 'https://www.anisearch.de/anime/' + asId + '/episodes'
      /*
        `_blank`, anders als die Titel-Verweise der Prüfliste: Hier wird gerade
        gemeldet, und ein Wechsel in dieser Ansicht verlöre den Player samt
        seiner Tonspurliste.
      */
      link.target = '_blank'
      link.rel = 'noreferrer noopener'
      link.textContent = 'aniSearch'
      link.title = 'Deutsche Folgentitel und Anbieter bei aniSearch nachsehen'
      platz.appendChild(link)
    } else if (vorhanden.href.indexOf('/' + asId + '/') < 0) {
      /* Die Reihe hat gewechselt — dann zeigt der alte Verweis auf den falschen Titel. */
      vorhanden.href = 'https://www.anisearch.de/anime/' + asId + '/episodes'
    }
  }
  /**
   * Gezählt wird, was noch aussteht — nicht, was in der Liste steht.
   *
   * Die Zahl kam aus der mitgelieferten Liste und blieb deshalb stehen, während
   * Daniel Titel abarbeitete (22.08.2026). Sie fällt jetzt mit jedem erledigten
   * Titel, auch bevor ein Datenlauf die Liste neu erzeugt.
   */
  /**
   * **Gezählt werden Staffeln, nicht Adressen.**
   *
   * Daniel am 26.08.2026: „wieso in netflix immer noch anime-kalender checkmark
   * auf button statt 10 zu reporten?"
   *
   * Der Knopf zählte **Adressen** — fünf Reihen, alle angefasst, also ein
   * Häkchen. Die Prüfliste und die Statusanzeige zählen dagegen **Staffeln**,
   * und davon waren elf offen: Unter einer Reihe hängen mehrere, und jede
   * braucht ihre eigene Antwort.
   *
   * Zwei Zähler, zwei Einheiten, dieselbe Frage — dann widersprechen sie sich
   * zwangsläufig. Der Knopf zählt jetzt dasselbe wie alles andere.
   */
  const offeneStaffeln = Object.entries(offeneTitel).reduce((n, [id, e]) => {
    if (istErledigt(id, 'tot')) return n
    const kuerzel = empfohleneFolgen({ ...e, staffeln: staffelnVon(id, e) })
    return n + kuerzel.filter((k) => !kuerzelErledigt(id, k)).length
  }, 0)
  /**
   * **Der Knopf zählt, was in der Liste steht — nichts anderes.**
   *
   * Bis zum 30.08.2026 hatte der Worker-Stand Vorrang. Der zählt Verweise
   * ohne Urteil im Datensatz, die Liste zählt, was hier noch anzuklicken ist —
   * zwei Einheiten für dieselbe Frage. Auf Daniels Bildschirm stand deshalb
   * „2 Titel zu prüfen" über einem Knopf mit der Zahl 1.
   *
   * Genau dieser Fehler steht schon im Kommentar darüber, vom 26.08.2026:
   * „Zwei Zähler, zwei Einheiten, dieselbe Frage — dann widersprechen sie sich
   * zwangsläufig." Er kam über den Worker-Stand zurück.
   *
   * Der Stand bleibt trotzdem nützlich: Er weiß, was ein Datenlauf schon
   * eingespielt hat, und das steht jetzt im Tooltip statt am Knopf.
   */
  const offeneAdressen = offeneTitelZahl()
  const gesamt = Object.entries(offeneTitel).reduce(
    (n, [id, e]) => n + empfohleneFolgen({ ...e, staffeln: staffelnVon(id, e) }).length,
    0,
  )
  /**
   * Ist alles gemeldet, zeigt der Knopf keine Zahl mehr — verschwindet aber
   * nicht.
   *
   * Eine „0" wäre ein Arbeitsvorrat, den es nicht gibt (Daniel, 23.08.2026:
   * „dort sollen nur nicht gemeldete gezählt werden"). Ihn ganz zu entfernen
   * nimmt aber den Zugang zur Liste, und die will man auch dann noch öffnen —
   * um nachzusehen, was schon durch ist. Also bleibt er als Häkchen stehen.
   *
   * Ganz weg ist er erst, wenn die Liste selbst leer ist: Dann hat ein
   * Datenlauf die Meldungen übernommen, und es gibt wirklich nichts mehr.
   */
  uebersichtKnopf.classList.toggle('ak-fertig', !offeneAdressen)
  /* Ohne jeden Eintrag sagt der Knopf, warum nichts dasteht — ein Häkchen allein
     ließe offen, ob die Liste leer oder die Erweiterung kaputt ist. */
  uebersichtKnopf.textContent = !Object.keys(offeneTitel ?? {}).length
    ? 'Alles gemeldet'
    : offeneAdressen
      ? `Anime-Kalender ${offeneAdressen}`
      : 'Anime-Kalender ✓'
  /* Der Worker-Stand steht hier statt am Knopf: Er beantwortet eine andere
     Frage — was ein Datenlauf schon eingespielt hat. */
  const nachStand = offenLautStand === null ? '' : `\nIm Datensatz noch ohne Urteil: ${offenLautStand}`
  uebersichtKnopf.title =
    (!offeneAdressen
      ? `Alles gemeldet — ${gesamt} Staffeln, zum Nachsehen anklicken`
      : offeneStaffeln === gesamt
        ? `${offeneStaffeln} Staffeln zu prüfen`
        : `${offeneStaffeln} von ${gesamt} Staffeln zu prüfen — der Rest ist gemeldet, aber noch nicht eingespielt`) +
    nachStand
}

let dialog = null

function dialogSchliessen() {
  if (dialog) {
    dialog.remove()
    dialog = null
  }
  document.removeEventListener('keydown', beiEscape)
  // Die Zahl am Knopf mitziehen: Wer im Dialog etwas abgehakt hat, soll das
  // draußen sehen. Am 23.08.2026 stand oben „Alles geprüft" und unten „7".
  uebersichtZeigen()
}

function beiEscape(e) {
  if (e.key === 'Escape') dialogSchliessen()
}

/**
 * Die Liste der offenen Titel, zum Durchklicken.
 *
 * Bewusst ohne Netflix' eigene Bausteine: Die Seite baut ihre Oberfläche bei
 * jedem Wechsel neu auf, und was daran hängt, verschwindet mit ihr. Dieser
 * Dialog steht für sich, direkt am `body`.
 */
async function dialogOeffnen() {
  // Ohne Verbindung gibt es keine Liste -- und keinen stillen Absturz.
  if (!verbindungLebt()) {
    if (uebersichtKnopf) {
      uebersichtKnopf.textContent = '↻ Seite neu laden'
    }
    return
  }
  if (dialog) {
    dialogSchliessen()
    return
  }
  /**
   * Den Stand frisch holen, nicht den vom Seitenaufbau nehmen.
   *
   * Gemeldet wird im Player (`/watch/…`), nachgesehen auf der Stöberseite —
   * das sind zwei Seitenaufrufe mit je eigenem Skript. Was der eine speichert,
   * kennt der andere erst nach einem Blick in den Speicher.
   */
  try {
    const x = (await speicherLesen('erledigt')) ?? {}
    erledigt = x.erledigt ?? {}
  } catch {
    /* Dann eben mit dem Stand von vorhin. */
  }
  /*
    **„Gemeldet" kommt aus dem Briefkasten, nicht aus dem lokalen Speicher.**
    Fünf kleine Abfragen, parallel, höchstens anderthalb Sekunden — danach
    gilt, was bis dahin da ist.
  */
  await Promise.race([
    Promise.all(Object.keys(offeneTitel).map((r) => meldungenLaden(r))),
    new Promise((fertig) => setTimeout(fertig, 1500)),
  ])
  dialog = document.createElement('div')
  dialog.className = 'ak-dialog'

  const kasten = document.createElement('div')
  kasten.className = 'ak-kasten'
  dialog.appendChild(kasten)

  const kopf = document.createElement('div')
  kopf.className = 'ak-kopf'
  /**
   * Offenes zuerst, Erledigtes ans Ende.
   *
   * Daniel am 22.08.2026: „7seeds already checked but still in list." Die Liste
   * selbst entsteht beim Datenlauf und weiß nichts von Meldungen, die noch im
   * Briefkasten liegen — bis dahin steht ein abgearbeiteter Titel weiter drin.
   * Er soll dann wenigstens nicht mehr obenauf liegen.
   */
  const eintraege = Object.entries(offeneTitel).sort((a, b) => {
    const d = Number(fertig(a[0], a[1])) - Number(fertig(b[0], b[1]))
    return d || a[1].titel.localeCompare(b[1].titel, 'de')
  })
  const titelzeile = document.createElement('strong')
  /* Dieselbe Zahl wie am Knopf — aus derselben Funktion, nicht nachgerechnet. */
  const nochOffen = offeneTitelZahl()
  titelzeile.textContent = nochOffen ? `${nochOffen} Titel zu prüfen` : 'Alles geprüft'
  kopf.appendChild(titelzeile)

  const suche = document.createElement('input')
  suche.className = 'ak-suche'
  suche.type = 'search'
  suche.placeholder = 'Suchen'
  kopf.appendChild(suche)

  /**
   * Erledigtes ist standardmäßig weg.
   *
   * Es blieb sichtbar, damit erkennbar ist, was schon durch ist — bei elf
   * abgehakten Zeilen und null offenen ist das aber nur noch Ballast (Daniel,
   * 22.08.2026: „warum sehe ich diese 11 noch in der liste ausgegraut?").
   * Wer nachsehen will, klappt sie auf.
   */
  /*
    **Der Schalter für den selbsttätigen Durchgang.**

    Er steht hier und nicht am Titel: Er gilt für alle Aufträge, nicht für einen.
    Angeschaltet öffnet die Erweiterung von allein jede Folge eines Auftrags, den
    Daniel gerade besucht — bei Netflix ist das eine echte Wiedergabesitzung und
    landet in „Weiter ansehen". Deshalb ist er **aus**, bis jemand ihn anschaltet
    (Daniel hat den Weg am 01.09.2026 freigegeben: „ja soll sie").
  */
  {
    const selbst = document.createElement('button')
    selbst.className = 'ak-umschalter' + (selbstAn ? ' ak-selbst-an' : '')
    selbst.textContent = selbstAn ? 'selbsttätig: an' : 'selbsttätig: aus'
    selbst.title = selbstAn
      ? 'Aus. Dann wird nur noch auf Klick geprüft.'
      : 'An. Die Erweiterung geht jeden besuchten Auftrag von allein durch — ' +
        'jede Folge wird kurz geöffnet und landet in „Weiter ansehen".'
    selbst.addEventListener('click', async () => {
      selbstAn = !selbstAn
      selbst.textContent = selbstAn ? 'selbsttätig: an' : 'selbsttätig: aus'
      selbst.classList.toggle('ak-selbst-an', selbstAn)
      try {
        await speicherSchreiben({ netflixSelbst: selbstAn })
      } catch {
        /* Ohne Speicher gilt die Wahl für diese Sitzung. */
      }
      /* Sofort greifen, nicht erst beim nächsten Takt. */
      if (selbstAn) void vielleichtSelbstStarten()
    })
    kopf.appendChild(selbst)
  }

  if (eintraege.length - nochOffen > 0) {
    const umschalter = document.createElement('button')
    umschalter.className = 'ak-umschalter'
    umschalter.textContent = `${eintraege.length - nochOffen} gemeldet zeigen`
    umschalter.addEventListener('click', () => {
      const zeigen = kasten.classList.toggle('ak-mit-erledigten')
      umschalter.textContent = zeigen
        ? `${eintraege.length - nochOffen} gemeldet ausblenden`
        : `${eintraege.length - nochOffen} gemeldet zeigen`
    })
    kopf.appendChild(umschalter)

    /*
      **Wann das Gemeldete hier wieder verschwindet.**

      Ein gemeldeter Titel bleibt in der Liste stehen, bis der nächste Lauf ihn
      übernommen hat — die Liste entsteht beim Datenlauf und weiß nichts vom
      Briefkasten. Ohne die Uhrzeit ist von außen nicht zu unterscheiden, ob der
      Lauf noch aussteht oder seine Arbeit nicht getan hat (Daniel, 26.08.2026:
      „so kann ich es gegenprüfen, dass der lauf sein job gemacht hat").
    */
    const lauf = document.createElement('span')
    lauf.className = 'ak-lauf'
    lauf.title = 'Der stündliche Datenlauf holt die Meldungen ab und schreibt sie in den Kalender. GitHub startet ihn oft ein paar Minuten später.'
    const zeigeLauf = () => {
      const z = naechsteUebernahme()
      const uhr = `${String(z.getHours()).padStart(2, '0')}:${String(z.getMinutes()).padStart(2, '0')}`
      lauf.textContent = `Übernahme ab ${uhr} — danach hier weg`
    }
    zeigeLauf()
    /* Bleibt der Dialog lange offen, wandert die Uhrzeit mit. */
    const takt = setInterval(() => {
      if (!lauf.isConnected) return clearInterval(takt)
      zeigeLauf()
    }, 60000)
    kopf.appendChild(lauf)
  }

  const zu = document.createElement('button')
  zu.className = 'ak-zu'
  zu.textContent = '×'
  zu.title = 'Schließen (Esc)'
  zu.addEventListener('click', dialogSchliessen)
  kopf.appendChild(zu)
  kasten.appendChild(kopf)

  /**
   * Eine Zeile je Titel: Name, die Folgen zum Anklicken, ihr Stand.
   *
   * Die Folgenkürzel sind selbst Verweise — ein Klick öffnet die Titelseite in
   * einem neuen Tab. Direkt auf eine Folge zu verweisen geht nicht: Netflix
   * leitet dann auf eine Folgen-Kennung um, die unser Datensatz nicht kennt
   * (neun von zwölf Meldungen aus Batch 1 waren deshalb nicht zuzuordnen).
   */
  const liste = document.createElement('div')
  liste.className = 'ak-liste'
  for (const [id, eintrag] of eintraege) {
    const zeile = document.createElement('div')
    zeile.className = 'ak-zeile'
    zeile.dataset.suchtext = eintrag.titel.toLowerCase()

    const link = document.createElement('a')
    link.className = 'ak-titel'
    /*
      **Immer auf die Titelseite, auch bei einem Film** (Daniel, 30.08.2026:
      „die links in der prüfliste öffnen direkt die player, stattdessen sollen
      sie auf overview navigieren").

      Der Umweg über `/watch/` sparte einen Klick und kostete die Übersicht: Der
      Player startet sofort die Wiedergabe, und wer nur nachsehen wollte, steht
      mitten im Film. Auf der Titelseite entscheidet Daniel selbst, wann er
      abspielt — dort liest die Erweiterung dann die Tonspur.
    */
    link.href = `https://www.netflix.com/title/${id}`
    /*
      **Netflix bleibt im selben Tab** (Daniel, 30.08.2026).

      Wer die Liste abarbeitet, öffnet Titel für Titel — bei zwanzig Einträgen
      sind das zwanzig Tabs, die alle offen bleiben. Und Netflix ist eine
      Einseiten-Anwendung: Im selben Tab wechselt sie ohne Neuladen, die Liste
      baut sich danach von selbst wieder auf.

      Der aniSearch-Verweis daneben behält `_blank`: Er ist zum Nachschlagen
      gedacht, nicht zum Weiterarbeiten — dort würde ein Wechsel die Netflix-
      Seite verlassen, auf der gerade gemeldet werden soll.
    */
    link.rel = 'noreferrer noopener'
    link.textContent = eintrag.titel || `Titel ${id}`

    /*
      **Ein zweiter Verweis: aniSearch.**

      Daniel am 28.08.2026: „kannst du die anilist links mit anisearch ersetzen
      in der melde extension?" Hier gab es bis dahin gar keinen. aniSearch fuehrt
      deutsche Titel und eine Episodenliste mit deutschen Folgentiteln — bei
      einer Reihe, die Netflix anders schneidet als wir, ist das die Seite, die
      es klaert. Der Titel-Link fuehrt weiterhin zu Netflix, denn dort wird
      gearbeitet.
    */
    let asLink = null
    if (eintrag.asId) {
      asLink = document.createElement('a')
      asLink.className = 'ak-quelle'
      asLink.href = 'https://www.anisearch.de/anime/' + eintrag.asId + '/episodes'
      asLink.target = '_blank'
      asLink.rel = 'noreferrer noopener'
      asLink.textContent = 'aniSearch'
      asLink.title = 'Deutsche Folgentitel und Anbieter bei aniSearch nachsehen'
    }
    /**
     * Merken, welchen Titel er gerade öffnet.
     *
     * Netflix nennt im Player nicht immer dieselbe Reihen-Kennung, unter der
     * wir den Titel führen: Bei Jujutsu Kaisen meldete sich die Seite als
     * `80237957`, unser Datensatz kennt `81278456` (22.08.2026). Gespeichert
     * würde dann unter einer Kennung, die in dieser Liste nicht vorkommt — und
     * nichts färbt sich.
     *
     * `chrome.storage.local` teilen alle Tabs. Der neue Tab findet hier also,
     * was von hier aus angeklickt wurde, und trägt seinen Befund an der
     * richtigen Zeile ein.
     */
    link.addEventListener('click', () => {
      /*
        **Der Klick merkt sich auch, wohin er wollte.**

        Die Weiterleitung wurde bisher erst auf der Zielseite erkannt, und dafür
        brauchte es einen frischen Zeitstempel. Wer die Seite nur neu lädt oder
        die Erweiterung neu startet, verliert ihn — bei Daniel lagen zuletzt 8,5
        Minuten dazwischen, und die Zuordnung kam nie zustande (30.08.2026,
        vier Berichte in Folge).

        Deshalb wird hier gleich vermerkt, welcher Auftrag geöffnet wurde. Führt
        die Zielseite eine andere Kennung, trägt der nächste Takt sie als
        Weiterleitung nach — und zwar dauerhaft, unabhängig von jeder Frist.
      */
      void speicherSchreiben({ zuletztGeoeffnet: { id: String(id), zeit: Date.now() } })
    })
    zeile.appendChild(link)

    /*
      **Die Fußzeile trägt beides: links die Staffeln, rechts das Tun.**

      Vorher standen Titel, Verweis, Kürzel und Knopf alle im selben Fluss und
      brachen unregelmäßig um. Zwei Behälter halten das auseinander, ohne dass
      etwas um dieselbe Zeile konkurriert.
    */
    const fuss = document.createElement('div')
    fuss.className = 'ak-fuss'

    const folgen = document.createElement('div')
    folgen.className = 'ak-folgen'
    const staffeln = staffelnVon(id, eintrag)

    /**
     * **Alle Folgen als Bereiche — gemeldet und offen getrennt.**
     *
     * Daniel am 26.08.2026: „der dialog muss alle episoden auflisten, nicht
     * nur erste und letzte der staffel nach unserer umstellung … weil das evtl
     * zu viele zum auflisten sind, sollte ein von bis aufzählung sein."
     *
     * Vorher standen dort zwei Kacheln je Staffel — die erste und die letzte
     * Folge, als Empfehlung, wo anzufangen sei. Seit der Durchlauf jede Folge
     * einzeln meldet, ist das die falsche Auskunft: Es zählt, **welche** Folgen
     * durch sind.
     *
     * Bei One Piece wären das über tausend Kacheln, deshalb Bereiche:
     * `S1 E1-10, E12` statt elf Kästchen.
     */
    for (const st of staffeln) {
      /*
        **Ein Film hat keine Folge zum Anklicken — „offen: E1" war eine
        Anweisung ins Leere** (Daniel, 30.08.2026, an „Gintama the Movie" und
        „Pokémon: Blauer Himmel in der Ferne!").

        `empfohleneFolgen()` kennt den Fall seit dem 22.08. und schreibt dort
        „Film". Diese Anzeige hier kannte ihn nicht: Sie baut ihre Kacheln aus
        `folgen`, und bei einem Film ist das die Eins. Wer darauf klickte,
        landete auf einer Seite ohne Folgenliste — und ohne Melde-Knopf.
      */
      if (st.film) {
        /* Dasselbe Kürzel wie in `empfohleneFolgen()` und `fertig()` — sonst
           finden Meldung und Abgleich einander nicht. */
        const kuerzel = staffeln.length > 1 ? `Film ${st.nr}` : 'Film'
        const durch = kuerzelErledigt(id, kuerzel)
        const zeileFilm = document.createElement('div')
        zeileFilm.className = 'ak-staffelzeile'
        const marke = document.createElement('span')
        marke.className = durch ? 'ak-folge ak-fertig' : 'ak-folge'
        marke.textContent = durch ? 'Film gemeldet' : 'Film — öffnen und melden'
        marke.title = 'Ein Film wird nicht je Folge geprüft: öffnen, Tonspur ansehen, melden.'
        zeileFilm.appendChild(marke)
        folgen.appendChild(zeileFilm)
        continue
      }
      const erste = Number.isFinite(st.erste) ? st.erste : 1
      const alle = []
      for (let i = 0; i < (st.folgen ?? 0); i++) alle.push(erste + i)
      if (!alle.length) continue

      /*
        **Je Folge genau ein Zustand, aus `folgeZustand()`** (Daniel, 11.09.2026:
        „zustände sind schließlich nur: gemeldet (+datum wann zuletzt), zu
        melden, erneut melden"). Vorher rechnete der Dialog aus dem lokalen
        Speicher und hielt alles Ungemeldete für offen — bei Haikyu!! S1 „E2–25",
        obwohl der Bestand sie belegt und der Knopf daneben „erledigt" sagte.
      */
      const zustaende = alle.map((n) => ({ n, ...folgeZustand(id, st.nr, n) }))
      const erledigt = zustaende.filter((z) => z.zustand === 'gemeldet').map((z) => z.n)
      const zuMelden = zustaende.filter((z) => z.zustand === 'melden').map((z) => z.n)
      const erneut = zustaende.filter((z) => z.zustand === 'erneut').map((z) => z.n)
      const offen = [...zuMelden, ...erneut]

      /*
        **Eine Pille je Staffel.** Nummer, Erledigtes und Offenes stehen darin
        nebeneinander — zusammen ergeben sie die Staffel, und getrennt kosteten
        sie den doppelten Rahmen und die doppelte Zeile.
      */
      const pille = document.createElement("span")
      pille.className = offen.length ? "ak-folge" : "ak-folge ak-fertig"
      pille.title = zustandZeilen(zustaende).join('\n')

      if (staffeln.length > 1) {
        const nr = document.createElement("span")
        nr.className = "ak-st"
        /*
          **Was der Anbieter nicht als Staffel führt, trägt seinen Namen.**

          Seit dem 09.09.2026 hängt die Liste Einträge an, die über die Zählung
          des Anbieters hinausgehen — „BAKI-DOU: The Invincible Samurai Part 2"
          ist bei Netflix keine eigene Staffel, bei uns ein eigener Titel. „S6"
          wäre dort eine Nummer, die es dort nicht gibt; der Name sagt, was
          gemeint ist.
        */
        nr.textContent = st.ausserhalb && st.name ? String(st.name).slice(0, 42) : `S${st.nr}`
        pille.appendChild(nr)
      }

      if (erledigt.length) {
        const marke = document.createElement("span")
        marke.className = "ak-folge ak-fertig"
        /* Ein Häkchen statt des Wortes: Die Pille trägt beides, und
           „gemeldet:" davor kostet die Hälfte des Platzes. */
        marke.className = "ak-durch"
        /*
          **Ein E vorn, danach nur Zahlen** (Daniel, 11.09.2026: „bei komma
          seperator kein erneutes e, das kann man sich sparen … format: e1-4,
          5-6, 9-12"). Das E sagt einmal, was die Zahlen sind.
        */
        marke.textContent = `✓ E${alsBereiche(erledigt).join(", ")}`
        pille.appendChild(marke)
      }
      if (zuMelden.length) {
        const marke = document.createElement("span")
        marke.className = "ak-folge"
        marke.textContent = `E${alsBereiche(zuMelden).join(", ")}`
        pille.appendChild(marke)
      }
      /* Erneut zu melden: Es gibt ein Urteil, aber eine zweite Quelle widerspricht. */
      if (erneut.length) {
        const marke = document.createElement("span")
        marke.className = "ak-folge ak-erneut"
        marke.textContent = `↻ E${alsBereiche(erneut).join(", ")}`
        pille.appendChild(marke)
      }
      /**
       * **Eine Staffel, die es hier nicht gibt — und nur sie.**
       *
       * Daniel am 06.09.2026: „prüfliste fragt nach s3, netflix hat keine s3,
       * was jetzt? wie melde ich s3 nicht auf netflix? prüfliste bietet keine
       * option dafür." Netflix führt „Sword Art Online" mit zwei Staffeln,
       * unsere Liste mit drei — Alicization läuft dort nicht.
       *
       * Der Knopf „nichts da?" am Zeilenende gilt dem **Verweis**, und der
       * gehört allen Staffeln: Ihn zu drücken hätte S1 und S2 mit gestrichen,
       * die vorhanden und gemeldet sind.
       *
       * Dieser hier meldet **titelgenau**. `titelIdFuer(id, st.nr)` löst die
       * Staffel in unsere AniList-Kennung auf, die Meldung trägt sie als
       * `titelId` — und `fetch-pruefungen.ts` arbeitet damit genau diesen Titel
       * ab, statt über die Adresse zu gehen. Ohne aufgelöste Kennung erscheint
       * er gar nicht: Eine Meldung, die nicht zuzuordnen ist, richtet mehr
       * Schaden an als der fehlende Knopf.
       */
      const staffelTitelId = titelIdFuer(id, st.nr)
      if (staffelTitelId && staffeln.length > 1 && offen.length) {
        const weg = document.createElement('button')
        weg.type = 'button'
        weg.className = 'ak-staffel-weg'
        weg.textContent = '✕'
        weg.title = st.ausserhalb && st.name
          ? `„${st.name}" gibt es hier nicht — nur diese Ausgabe melden`
          : `Staffel ${st.nr} gibt es hier nicht — nur diese Staffel melden`
        weg.addEventListener('click', async (ereignis) => {
          ereignis.stopPropagation()
          ereignis.preventDefault()
          /* Zweistufig wie „nichts da?": Ein Fehlklick streicht eine Staffel. */
          if (weg.dataset.sicher !== 'ja') {
            weg.dataset.sicher = 'ja'
            weg.textContent = 'wirklich?'
            weg.classList.add('ak-frage')
            setTimeout(() => {
              if (weg.dataset.sicher !== 'ja') return
              weg.dataset.sicher = ''
              weg.textContent = '✕'
              weg.classList.remove('ak-frage')
            }, 4000)
            return
          }
          weg.disabled = true
          weg.textContent = '…'
          const { ok, text } = await staffelWegMelden(id, st, staffelTitelId, eintrag.titel)
          weg.classList.remove('ak-frage')
          weg.textContent = ok ? '✓' : text
          weg.disabled = ok
          if (ok) pille.classList.add('ak-abgehakt')
        })
        pille.appendChild(weg)
      }
      folgen.appendChild(pille)
    }

    if (!folgen.childElementCount) {
      const leer = document.createElement("span")
      leer.className = "ak-hinweis"
      leer.textContent = "keine Folgenangabe"
      folgen.appendChild(leer)
    }
    fuss.appendChild(folgen)

    /* Rechts, in fester Reihenfolge: nachschlagen, dann melden. */
    const aktionen = document.createElement('div')
    aktionen.className = 'ak-aktionen'
    if (asLink) aktionen.appendChild(asLink)
    fuss.appendChild(aktionen)
    zeile.appendChild(fuss)

    /*
      **Die ganze Zeile öffnet den Titel, nicht nur seine drei Wörter.**

      Der Titel-Link war das einzige Ziel — bei „7 Seeds" sind das neun Zeichen
      in einer Zeile von siebenhundert Pixeln. Daniel am 31.08.2026: „zeile muss
      klickbar sein."

      Die Knöpfe rechts behalten ihr eigenes Verhalten: Ein Klick, der dort
      landet, ist keiner auf die Zeile.
    */
    zeile.addEventListener('click', (ereignis) => {
      if (ereignis.target.closest('a, button')) return
      link.click()
    })

    /**
     * Der Knopf für einen Verweis, der ins Leere führt.
     *
     * Er steht bewusst am Rand und ohne Farbe: Er wird selten gebraucht, und
     * ein Fehlklick meldet eine Serie als verschwunden, die es noch gibt.
     * Deshalb fragt er einmal nach.
     */
    const tot = document.createElement('button')
    tot.className = 'ak-tot'
    tot.textContent = istErledigt(id, 'tot') ? 'nichts da ✓' : 'nichts da?'
    tot.disabled = istErledigt(id, 'tot')
    /**
     * „Tot" heißt hier: dort ist nichts abzuspielen.
     *
     * Das trifft drei Fälle, und alle drei sind Daniel begegnet: Die Adresse
     * leitet auf die Startseite um; die Titelseite bietet nur „Erinnern"; oder
     * Netflix zeigt eine Folgenliste, die leer ist und beim Klick mit einem
     * Fehler antwortet (One Punch Man, 22.08.2026). In allen dreien führt der
     * Verweis zu nichts, und genau das wird gemeldet.
     */
    tot.title =
      'Dort ist nichts abzuspielen — Adresse leitet um, keine Folgen, oder Netflix meldet einen Fehler'
    tot.addEventListener('click', async () => {
      if (tot.dataset.sicher !== 'ja') {
        tot.dataset.sicher = 'ja'
        tot.textContent = 'wirklich?'
        tot.classList.add('ak-frage')
        setTimeout(() => {
          if (tot.dataset.sicher !== 'ja') return
          tot.dataset.sicher = ''
          tot.textContent = 'nichts da?'
          tot.classList.remove('ak-frage')
        }, 4000)
        return
      }
      tot.disabled = true
      tot.textContent = '…'
      const { ok, text } = await totMelden(id, eintrag.titel)
      tot.classList.remove('ak-frage')
      tot.textContent = ok ? 'nichts da ✓' : text
      tot.disabled = ok
      if (ok) zeile.classList.add('ak-abgehakt')
    })
    aktionen.appendChild(tot)

    // Was durch ist, bleibt sichtbar, tritt aber zurück.
    /*
      `fertig()` beantwortet dieselbe Frage und kennt die Sonderfälle — etwa,
      dass ein Titel ohne empfohlene Folgen nicht als erledigt gilt. Beim Umbau
      auf Bereiche fiel die lokale Variable `empfohlen` weg; diese Zeile blieb
      stehen und riss den ganzen Dialog mit.
    */
    if (fertig(id, eintrag)) {
      zeile.classList.add('ak-abgehakt')
    }
    liste.appendChild(zeile)
  }
  kasten.appendChild(liste)

  suche.addEventListener('input', () => {
    const wort = suche.value.trim().toLowerCase()
    for (const zeile of liste.children) {
      zeile.style.display = !wort || zeile.dataset.suchtext.includes(wort) ? '' : 'none'
    }
  })

  // Ein Klick neben den Kasten schließt — wie überall sonst auch.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialogSchliessen()
  })
  document.addEventListener('keydown', beiEscape)
  document.body.appendChild(dialog)
  suche.focus()
}

// --- Start ------------------------------------------------------------------

/**
 * Netflix wechselt die Seite ohne Neuladen — der Knopf muss mitbekommen, ob
 * gerade der Player läuft.
 *
 * `popstate` allein genügt nicht: Es feuert beim Zurück-Knopf, nicht bei einem
 * Klick auf eine Kachel. Ein Beobachter über den ganzen Baum wäre das andere
 * Extrem — Netflix baut beim Stöbern unablässig Kacheln um, und jede Änderung
 * riefe die Prüfung erneut auf. Ein Blick pro Sekunde kostet nichts und merkt
 * jeden Wechsel früh genug.
 *
 * `history.pushState` zu überschreiben wäre der kürzeste Weg und der falsche:
 * Genau daran ist der Netzwerk-Mitschnitt zweimal gescheitert (NSES-UHX,
 * 22.08.2026). An fremden Seiten wird nichts ersetzt, was sie selbst aufrufen.
 */
let letzterPfad = location.pathname
function pfadPruefen() {
  if (location.pathname === letzterPfad) return
  letzterPfad = location.pathname
  dialogSchliessen()
  uebersichtZeigen()
  /*
    **Auch die Durchlauf-Leiste gehört bei jedem Wechsel neu gezeichnet.**

    Sie blieb beim Wechsel in den Player stehen und kam beim Zurücknavigieren
    nicht wieder, weil hier niemand nach ihr sah. Daniel am 26.08.2026: „wenn
    ich folge abspiele und dann limit icon anklicke verschwinden backdrop und
    die buttons", und danach: „navigation zurück bringt diese elemente nicht
    zurück."

    Beides dieselbe Lücke: Ohne diesen Aufruf zeichnet nur ein Klick neu — und
    was dabei passiert, sieht aus, als hätte der Klick es verursacht.
  */
  /*
    **Eine Störung gehört zu der Wiedergabe, bei der sie auftrat.**

    Sie blieb am Knopf stehen, auch nachdem der Durchlauf den Player längst
    verlassen hatte — bei „Pokémon" stand nach der Rückkehr auf die Titelseite
    noch „⚠ M7355", während die Seite zuvor E103 gezeigt hatte (Daniel,
    30.08.2026, mit zwei Bildern). Zwei verschiedene Fehler, einer davon aus
    einer Sitzung, die es nicht mehr gibt.

    Beim Pfadwechsel ist sie damit erledigt: Was auf der neuen Seite stört,
    stellt `stoerung()` dort neu fest.
  */
  DURCHLAUF.stoerung = null
  durchlaufKnopfZeigen()
}
window.addEventListener('popstate', pfadPruefen)
setInterval(pfadPruefen, 1000)

/**
 * **Der Melde-Knopf gehört in den Takt, nicht nur an eine Nachricht.**
 *
 * Er wurde bisher allein aus dem Nachrichtenempfänger gezeichnet — also nur,
 * wenn der Leser etwas meldet. Auf einer Titelseite ohne Player kommt keine
 * Nachricht, und damit lief `knopfZeigen()` dort nie.
 *
 * Sichtbar wurde das an „Pokémon" (Daniel, 30.08.2026, mit Diagnosebericht):
 * `istGesucht: false`, also hätte seit 3.99 „Steht nicht auf der Prüfliste"
 * dastehen müssen — im Bericht steht `knopf: null`. Nicht die Beschriftung
 * fehlte, sondern der Aufruf.
 *
 * Ein eigener Takt und nicht in `pfadPruefen`: Das steigt bei unverändertem
 * Pfad sofort aus, und genau dort steht der Fall — dieselbe Seite, nur die
 * Prüfliste kommt Sekunden später aus dem Speicher.
 */
setInterval(() => {
  try {
    knopfZeigen()
  } catch {
    /* Vor dem Laden des Speichers gibt es noch nichts zu zeichnen. */
  }
  /*
    **Der Player braucht denselben Takt.**

    Die Anzeige hing zuerst an der Leser-Nachricht — und die kommt nur, wenn
    leser.js etwas findet. Bleibt sie aus, blieb auch die Anzeige aus, und genau
    das war der Fall, den niemand sehen konnte (10.09.2026).
  */
  try {
    playerZeigen()
  } catch {
    /* Ohne Prüfliste gibt es im Player nichts zu sagen. */
  }
  /*
    **Die Liste gehört in den Takt, nicht nur an den Pfadwechsel.**

    `uebersichtZeigen()` lief bisher beim Start und bei jedem Pfadwechsel. Beides
    ist zu selten: Netflix baut seine Oberfläche auch **ohne** Pfadwechsel neu
    auf — auf der Startseite beim Nachladen der Reihen, auf einer Titelseite beim
    Öffnen und Schließen des Overlays. Verschwand der Knopf dabei, kam er erst
    beim nächsten Seitenwechsel zurück, und auf `/browse` gibt es keinen.

    Die Zählung darin läuft über die offenen Titel — drei Einträge am
    06.09.2026, ein Wimpernschlag je Sekunde.
  */
  try {
    uebersichtZeigen()
  } catch {
    /* Dieselbe Lage wie oben: Vor dem Speicher gibt es nichts zu zählen. */
  }
  /*
    **Wechselt die angezeigte Staffel, zeichnet der Knopf sie neu** (Daniel,
    11.09.2026: „Bei staffelwechsel wechselt extension button anzeige nicht").
    Netflix lädt eine schon einmal angeklickte Staffel nicht neu — ohne diesen
    Takt käme dann keine Nachricht, und der Knopf bliebe bei der vorigen.
  */
  try {
    if (!imPlayer() && angezeigteFolgenSetzen()) {
      void durchlaufStandLaden(gemeinteReihe()).then(durchlaufKnopfZeigen)
      durchlaufKnopfZeigen()
    }
  } catch {
    /* Ohne Folgenliste gibt es nichts zu wechseln. */
  }
  /* Und über allem: ob der Kasten auf dieser Seite überhaupt etwas zu suchen hat. */
  try {
    const kasten = document.querySelector('.ak-netflix-kasten')
    if (kasten) kasten.hidden = !seiteGehtUnsAn()
  } catch {
    /* Im Zweifel bleibt er, wie er ist — lieber ein Kasten zu viel als ein toter Takt. */
  }
  /*
    Im selben Takt: Ist der selbsttaetige Durchgang an und steht hier ein
    Auftrag, faengt er von allein an. Die Riegel stehen in der Funktion.
  */
  void vielleichtSelbstStarten().catch(() => {
    /* Ein gescheiterter Start haelt den Takt nicht auf. */
  })
}, 1000)

/**
 * Der erste Blick wartet auf den gespeicherten Stand.
 *
 * `uebersichtZeigen()` zählt, was noch offen ist — und das steht in `erledigt`,
 * das aus `chrome.storage.local` kommt und damit asynchron. Beim Start lief die
 * Zählung vorher: Der Knopf zeigte 7, während der Dialog daneben „Alles
 * geprüft" sagte (Daniel, 23.08.2026, nach dem Neuladen).
 */
void erledigtGeladen.then(() => uebersichtZeigen())

/*
  Den Stand holen — einmal beim Laden, danach alle fünf Minuten. Er ändert sich
  nur, wenn ein Datenlauf durch ist oder Daniel etwas meldet; das Melden setzt
  ihn selbst zurück (siehe unten), häufiger nachzufragen brächte dieselbe
  Antwort.
*/
void standHolen()
setInterval(() => void standHolen(), 5 * 60 * 1000)

/**
 * Einen Verweis als tot melden — direkt aus der Liste, ohne ihn zu öffnen.
 *
 * Daniel am 22.08.2026: „7th time loop link is dead (gets redirected to
 * homepage) — make possible to mark entries as dead links." Vorher hätte er die
 * Seite öffnen, das Ausbleiben des Players abwarten und den Knopf drücken
 * müssen — für eine Adresse, die gar nicht mehr existiert.
 *
 * Gemeldet wird derselbe Befund, den die Titelseite ohne abspielbare Folge
 * liefert: `weg`. Die Pipeline entfernt den Verweis daraufhin aus dem Datensatz.
 */
/**
 * **Diese eine Staffel gibt es hier nicht — als Meldung an den Briefkasten.**
 *
 * Unterschied zu `totMelden()`: Dort ist die **Adresse** das Ziel („dort ist
 * gar nichts"), hier ein einzelner **Titel** („die Reihe läuft, diese Staffel
 * nicht"). Deshalb geht `titelId` mit, und die Notiz sagt, worum es ging —
 * `fetch-pruefungen.ts` bevorzugt die Kennung aus der Meldung vor jeder
 * Rekonstruktion über die Adresse.
 *
 * `befund: 'weg'` ist derselbe wie beim toten Verweis, und das ist richtig:
 * Der Bau macht daraus `available: false` und entfernt den Verweis — beim
 * gemeldeten Titel, nicht bei seinen Geschwistern.
 */
async function staffelWegMelden(reihe, st, titelId, titel) {
  const { token } = await chrome.storage.sync.get('token')
  if (!token) return { ok: false, text: 'Kein Token' }
  try {
    const antwort = await fetch(WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
      body: JSON.stringify({
        plattform: 'netflix',
        url: `https://www.netflix.com/title/${reihe}`,
        titelId,
        staffel: Number(st.nr) || null,
        sprachen: [],
        befund: 'weg',
        titel: titel || null,
        notiz: `Netflix führt Staffel ${st.nr} nicht — die Reihe läuft dort, diese Staffel nicht. Aus der Prüfliste je Staffel gemeldet.`,
      }),
    })
    if (!antwort.ok) {
      const daten = await antwort.json().catch(() => ({}))
      return { ok: false, text: daten.error ?? `Fehler ${antwort.status}` }
    }
    return { ok: true, text: 'gemeldet' }
  } catch (err) {
    return { ok: false, text: `Nicht erreichbar: ${err.message}` }
  }
}

async function totMelden(id, titel) {
  const { token } = await chrome.storage.sync.get('token')
  if (!token) return { ok: false, text: 'Kein Token — Rechtsklick aufs Symbol, dann Optionen' }
  try {
    const antwort = await fetch(WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
      body: JSON.stringify({
        plattform: 'netflix',
        url: `https://www.netflix.com/title/${id}`,
        titelId: titelIdFuer(id, null),
        sprachen: [],
        befund: 'weg',
        titel: titel || null,
        notiz: 'Aus der Übersicht als toter Verweis gemeldet — leitet auf die Startseite um',
      }),
    })
    if (!antwort.ok) {
      const daten = await antwort.json().catch(() => ({}))
      return { ok: false, text: daten.error ?? `Fehler ${antwort.status}` }
    }
    await merkeTot(id)
    return { ok: true, text: 'als tot gemeldet' }
  } catch (err) {
    return { ok: false, text: `Nicht erreichbar: ${err.message}` }
  }
}

/**
 * Der Dialog hört zu, statt beim Öffnen einmal nachzusehen.
 *
 * Geprüft wird in einem zweiten Tab: Titel anklicken, Folge starten, Tab
 * schließen. Die Übersicht bleibt derweil offen und bekam davon nichts mit —
 * sie hatte ihren Stand beim Öffnen gelesen. `chrome.storage.onChanged` feuert
 * auch, wenn ein anderer Tab schreibt; das ist der Weg dorthin.
 */
/**
 * Auch das Anmelden wirft, wenn die Verbindung tot ist.
 *
 * Der Listener steht auf oberster Ebene und laeuft beim Skriptstart -- ohne
 * diese Pruefung stirbt das ganze Skript, bevor es den Knopf zeichnet.
 */
if (verbindungLebt())
  chrome.storage.onChanged.addListener((aenderungen, bereich) => {
  if (bereich !== 'local') return
  // Ein Klick in einem anderen Tab sagt uns, welcher Titel gemeint ist.
  if (aenderungen.zuletztGeoeffnet) {
    zuletztGeoeffnet = aenderungen.zuletztGeoeffnet.newValue ?? null
    uebersichtZeigen()
  }
  // Eine neu gemeldete Staffelaufteilung ändert die empfohlenen Folgen und
  // damit auch, was als erledigt gilt.
  if (aenderungen.anbieterStaffeln) {
    anbieterStaffeln = aenderungen.anbieterStaffeln.newValue ?? {}
    uebersichtZeigen()
  }
  if (!aenderungen.erledigt) return
  erledigt = aenderungen.erledigt.newValue ?? {}
  // Die Zahl am Knopf gehört mit aktualisiert — sie zählt dasselbe.
  uebersichtZeigen()
  if (!dialog) return
  // Neu zeichnen, aber die Suche und die Rollposition behalten — sonst
  // springt die Liste weg, während jemand sie durchgeht.
  const wort = dialog.querySelector('.ak-suche')?.value ?? ''
  const stelle = dialog.querySelector('.ak-liste')?.scrollTop ?? 0
  dialogSchliessen()
  void dialogOeffnen().then(() => {
    const suche = dialog?.querySelector('.ak-suche')
    if (suche && wort) {
      suche.value = wort
      suche.dispatchEvent(new Event('input'))
    }
    const liste = dialog?.querySelector('.ak-liste')
    if (liste) liste.scrollTop = stelle
  })
})

/**
 * **Ein Diagnosebericht für Netflix — denselben Griff wie bei Amazon.**
 *
 * Daniel am 30.08.2026: „diagnose download geht nicht." `ak-report` gibt es nur
 * in `amazon.js`; auf Netflix lief das Ereignis ins Leere, und
 * `dispatchEvent` gibt trotzdem `true` zurück — es heißt „nicht abgebrochen",
 * nicht „jemand hat zugehört".
 *
 * Ohne Bericht bleibt jede Frage nach dem „warum lässt sich das nicht melden"
 * eine Vermutung. Genau dafür gibt es ihn bei Amazon seit dem 28.08., und drei
 * Fälle an einem Tag waren ohne ihn nicht auswertbar.
 *
 *     document.dispatchEvent(new CustomEvent('ak-report'))
 *
 * `window.__akDiagnose()` im Leser bleibt daneben bestehen — es sieht die
 * GraphQL-Antworten, an die dieses Skript nicht herankommt. Wo es erreichbar
 * ist, wandert sein Ergebnis mit in den Bericht.
 */
function nfBericht() {
  const sicher = (f) => {
    try {
      return f()
    } catch (err) {
      return { fehler: String(err?.message ?? err) }
    }
  }
  return {
    erzeugtAm: new Date().toISOString(),
    version: sicher(() => chrome.runtime.getManifest().version),
    adresse: location.pathname + location.search,
    stand: sicher(() => ({
      reihe: stand.reihe,
      folgeNr: stand.folgeNr,
      staffel: stand.staffel,
      titel: stand.titel,
      spuren: stand.spuren,
      serientitel: stand.serientitel,
    })),
    /* Die drei Fragen, an denen der Knopf hängt. */
    lage: sicher(() => ({
      imPlayer: imPlayer(),
      istGesucht: istGesucht(),
      gemeinteReihe: gemeinteReihe(),
      keineFolgeVorhanden: keineFolgeVorhanden(),
      erscheinungsdatum: erscheinungsdatum(),
      stoerung: stoerung(),
    })),
    /* Steht der Titel auf der Liste, und als was? */
    auftrag: sicher(() => {
      const r = gemeinteReihe()
      const e = r ? offeneTitel[String(r)] : null
      return e ? { titel: e.titel, asId: e.asId, staffeln: e.staffeln } : null
    }),
    durchlauf: sicher(() => ({
      folgen: DURCHLAUF.folgen.length,
      nummern: DURCHLAUF.folgen.slice(0, 5).map((f) => ({ nummer: f.nummer, videoId: f.videoId })),
      laeuft: DURCHLAUF.laeuft,
      abbruch: DURCHLAUF.abbruch,
      knopf: DURCHLAUF.knopf?.textContent ?? null,
    })),
    knopf: sicher(() => document.querySelector('.ak-melder')?.textContent ?? null),
    /*
      **Auch die Prüfliste gehört in den Bericht.**

      Am 06.09.2026 fehlte ihr Knopf dreimal auf Daniels Bildschirm, und der
      Bericht sagte nichts über ihn — jede Erklärung blieb Vermutung. Der
      Sandkasten (`melder-uebersicht.test.cjs`) belegt seitdem, dass er
      entsteht; was hier steht, sagt, ob er auf **dieser** Seite auch da ist.
    */
    uebersicht: sicher(() => {
      const el = document.querySelector('.ak-uebersicht')
      if (!el) return { imDom: false }
      const rect = el.getBoundingClientRect?.()
      const stil = getComputedStyle(el)
      /*
        **Wer liegt an dieser Stelle oben?**

        Am 06.09.2026 meldete der Bericht `imDom: true`, Text „Anime-Kalender 2",
        Lage 1604/835 in einem Fenster von 1767×887 — alles richtig, und Daniel
        sah trotzdem nichts. „Da" und „sichtbar" sind zwei Fragen, und die
        zweite beantwortet nur `elementFromPoint`: Kommt dort ein fremdes
        Element zurück, liegt es darüber.
      */
      const mitte = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null
      const oben = mitte ? document.elementFromPoint(mitte.x, mitte.y) : null
      return {
        imDom: true,
        text: el.textContent,
        lage: rect
          ? {
              top: Math.round(rect.top),
              left: Math.round(rect.left),
              breite: Math.round(rect.width),
              hoehe: Math.round(rect.height),
            }
          : null,
        fenster: { breite: window.innerWidth, hoehe: window.innerHeight },
        stil: {
          display: stil.display,
          sichtbarkeit: stil.visibility,
          deckkraft: stil.opacity,
          zIndex: stil.zIndex,
          position: stil.position,
          hintergrund: stil.backgroundColor,
        },
        /* `null` heißt: außerhalb des sichtbaren Bereichs. */
        obenLiegt: oben
          ? {
              istErSelbst: oben === el,
              tag: oben.tagName,
              klasse: String(oben.className ?? '').slice(0, 80),
            }
          : null,
      }
    }),
    zuletztGeoeffnet: sicher(() => zuletztGeoeffnet),
    listeGesamt: sicher(() => Object.keys(offeneTitel).length),
    /* Was der Leser sieht — er kennt die GraphQL-Antworten. */
    /*
      Der Leser schickt seine Herkunft mit der Folgenliste — `window` teilen die
      beiden Welten nicht, siehe den Kommentar dort.
    */
    leser: sicher(() => letzteHerkunft ?? 'noch keine Folgenliste gesehen'),
  }
}

try {
  document.addEventListener('ak-report', () => {
    const daten = JSON.stringify(nfBericht(), null, 2)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([daten], { type: 'application/json' }))
    a.download = `anime-kalender-netflix-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    console.log('[Anime-Kalender] Netflix-Diagnosebericht heruntergeladen.')
  })
} catch {
  /* Ohne document gibt es nichts zu berichten. */
}

