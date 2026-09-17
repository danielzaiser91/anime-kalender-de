/**
 * **Kanal-Meldungen ohne Deutsch bekommen ihre zweite Quelle — automatisch.**
 *
 * Bei einem Kanal-Titel (ADN, aniverse, Crunchyroll über Prime) zeigt Amazon die
 * Tonspuren, die dem **Betrachter** zugänglich sind. Ohne das Kanal-Abo fehlt
 * die deutsche, und eine Meldung „kein Deutsch" ist deshalb für sich kein Beleg:
 * Gemessen am 07.09.2026 lagen 45 solcher Meldungen vor, und bei **14** war
 * Deutsch anderweitig belegt — fast jedes dritte „kein Deutsch" wäre ein
 * Falschnegativ gewesen.
 *
 * CLAUDE.md zieht daraus die Regel: „Zwei Quellen, die unabhängig voneinander
 * kein Deutsch im **Ton** finden, ergeben zusammen ein belegtes Nein; eine
 * allein nicht." Von Hand ist das dreimal gemacht worden („7th Time Loop",
 * „2.5 Dimensional Seduction", ein JoJo-Fall). Dieser Lauf macht es für alle.
 *
 * ## Was als zweite Quelle zählt
 *
 * `data/justwatch-audio.json` nennt je Angebot die Tonspuren und die Untertitel.
 * Gewertet wird nur ein Angebot, dessen `audio` **belegt** ist: Eine leere Liste
 * ist Schweigen, und aus Schweigen folgt hier nichts — dieselbe Asymmetrie, die
 * dieses Projekt an fremden Quellen bemängelt.
 *
 * **Und ein Widerspruch beendet den Fall.** Findet JustWatch deutschen Ton, war
 * die Kanal-Meldung ein Falschnegativ; dann entsteht **kein** Urteil, auch kein
 * positives — JustWatch sagt „irgendwo deutsch", nicht „bei diesem Anbieter
 * deutsch". Der Verweis bleibt offen, und das ist die ehrliche Antwort.
 *
 * ## Ergebnis
 *
 * Ein Block in `data/dub-confirmed.yaml`, je Fall mit `zweiteQuelle:` — dasselbe
 * Feld, das `check:logic` seit dem 07.09.2026 für jedes Kanal-Nein verlangt.
 *
 * Aufruf: npx tsx pipeline/kanal-gegenprobe.ts [--trocken]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { log, warn } from './lib/util.ts'
import { adressKern } from './lib/dub-confirmed.ts'
import { handpruefungSchreiben, jwFrisch, type Handpruefung } from './lib/jw-handpruefung.ts'

const ROOT = resolve(import.meta.dirname, '..')
const TROCKEN = process.argv.includes('--trocken')

interface Beleg {
  anilistId?: number
  title?: string
  platform?: string
  url?: string
  dub?: boolean
  available?: boolean
  note?: string
  checkedAt?: string
  zweiteQuelle?: string
}

interface Angebot {
  anbieter?: string
  art?: string
  audio?: string[]
  untertitel?: string[]
  url?: string
}

const belege = (yaml.load(readFileSync(resolve(ROOT, 'data/dub-confirmed.yaml'), 'utf8')) ?? []) as Beleg[]
const jw = JSON.parse(readFileSync(resolve(ROOT, 'data/justwatch-audio.json'), 'utf8')) as Record<
  string,
  { geprueftAm?: string; erstAm?: string; jwPfad?: string; angebote?: Angebot[] }
>

/**
 * **Wer schon ein Urteil hat, wird nicht noch einmal beurteilt.**
 *
 * Der Lauf hängt seine Belege an dieselbe Datei, die er liest. Ohne diese
 * Menge schriebe er bei jedem Durchgang dieselben Zeilen erneut — die Datei
 * wüchse, und `check:handbelege` fände Dutzende Dubletten.
 */
const schonBeurteilt = new Set(
  belege
    .filter((b) => b.anilistId != null && (typeof b.dub === 'boolean' || typeof b.available === 'boolean'))
    .map((b) => beurteiltSchluessel(b)),
)

/**
 * **Das Urteil gilt der Ausgabe, nicht dem Titel.**
 *
 * Bis zum 14.09.2026 sperrte ein Urteil zu irgendeiner Prime-Adresse den ganzen
 * Titel. Bei Digimon hieß das: Sobald die deutsche Ausgabe `B0CGRJGJX1` belegt
 * ist, bekäme die Crunchyroll-Kanal-Ausgabe `B0CHHNJJW3` nie ihr Nein. Ein Beleg
 * ohne Adresse gilt weiter der ganzen Plattform.
 */
function beurteiltSchluessel(b: Beleg, url = b.url): string {
  return `${b.anilistId} ${b.platform ?? ''} ${url ? adressKern(url) : ''}`
}
function schonBeurteiltFuer(b: Beleg): boolean {
  return schonBeurteilt.has(beurteiltSchluessel(b, '')) || (Boolean(b.url) && schonBeurteilt.has(beurteiltSchluessel(b)))
}

const kanalOffen = belege.filter(
  (b) =>
    b.anilistId != null &&
    typeof b.note === 'string' &&
    /Kanal/i.test(b.note) &&
    b.dub === undefined &&
    b.available === undefined &&
    !schonBeurteiltFuer(b),
)

/*
  **Eine übersprungene Kanal-Meldung kommt über die Zuordnung herein.**

  `fetch-pruefungen.ts` lässt eine Kanal-Meldung ohne Folgenbefund aus, wenn der
  Datensatz ihre Adresse schon kennt — sie schreibt dann keinen Beleg mit
  „Kanal" in der Notiz, und diese Liste sah sie nie. Nukitashi, 15.09.2026: neun
  Folgen nur 日本語 über den Aniverse-Kanal, JustWatch nennt für genau dieses
  Angebot Ton ja und deutsche Untertitel — und der Titel stand trotzdem jede
  Woche wieder auf der Prüfliste, denn eine erneute Meldung wird wieder
  ausgelassen. `data/prime-zugeordnet.json` hält die Tonspuren je Adresse fest;
  eine Adresse ohne jeden Beleg und ohne Deutsch in einer ihrer Folgen ist genau
  so ein Fall. Die Kanäle kennt sie nicht, verglichen wird dann über alle
  Angebote.
*/
const zugeordnet = JSON.parse(readFileSync(resolve(ROOT, 'data/prime-zugeordnet.json'), 'utf8')) as Record<
  string,
  { titleId?: number; plattform?: string; folgen?: { sprachen?: string[] }[] }
>
const titelName = new Map(
  (JSON.parse(readFileSync(resolve(ROOT, 'public/data/titles.json'), 'utf8')) as { id: number; titleDe?: string; titleEn?: string }[]).map(
    (t) => [t.id, t.titleDe ?? t.titleEn],
  ),
)
for (const [url, z] of Object.entries(zugeordnet)) {
  const folgen = z.folgen ?? []
  if (z.plattform !== 'primevideo' || z.titleId == null || !folgen.length) continue
  if (folgen.some((f) => !f.sprachen?.length || f.sprachen.includes('Deutsch'))) continue
  if (belege.some((x) => x.anilistId === z.titleId && (x.platform ?? 'primevideo') === 'primevideo')) continue
  kanalOffen.push({ anilistId: z.titleId, title: titelName.get(z.titleId), platform: 'primevideo', url })
}

log(`${kanalOffen.length} Kanal-Meldungen ohne Urteil.`)

const heute = new Date().toISOString().slice(0, 10)
const neu: string[] = []
/** Meldungen, denen die zweite Quelle widerspricht — sie gehören zurück auf die Prüfliste. */
const widersprueche: {
  /** `kanal`: das Kanal-Angebot selbst hat Deutsch · `andere-ausgabe`: ein anderes Amazon-Angebot hat es */
  art: 'kanal' | 'andere-ausgabe'
  titleId: number
  titel: string
  platform: string
  quelle: string
  ton: string
  anbieter?: string
  url?: string
  seit: string
}[] = []
const gesehen = new Set<string>()
/** Neins aus frischen JustWatch-Daten — sie gehen erst über Daniels Tisch. */
const zurHand: Handpruefung[] = []
let widerspruch = 0
let ohneQuelle = 0

for (const b of kanalOffen) {
  const schluessel = beurteiltSchluessel(b)
  if (gesehen.has(schluessel)) continue
  const eintrag = jw[String(b.anilistId)]
  const kanaele = (/Abos: ([^—]*?)(?:, zugang=|, Seitenadresse|\s—|$)/.exec(b.note ?? '')?.[1] ?? '')
    .split(/,\s*/)
    .map((a) => a.trim().toLowerCase().replace(/de$/, ''))
    .filter((a) => a && a !== 'prime' && a !== 'keine angabe')
  /*
    **Die erste zweite Quelle ist der Kanal-Anbieter selbst.**

    Free!, 15.09.2026: Die Meldung kam vom Crunchyroll-Kanal ohne Deutsch, JustWatch
    nennt beim Crunchyroll-Angebot „de" — aber für die ganze Reihe, und das Deutsch
    gehört zu Staffel 3. Für Staffel 1 hatte Daniel bei Crunchyroll selbst „kein
    Deutsch" belegt (23.08.). Ein Handbeleg beim Anbieter des Kanals meint genau
    diesen Titel und schlägt die Reihenangabe von JustWatch. Sagt er Nein, ist die
    Kanal-Meldung belegt; sagt er Ja, bleibt es beim Vergleich unten.
  */
  const plattformDesKanals: Record<string, string> = { crunchyroll: 'crunchyroll', aniverse: 'aniverse', animedigital: 'adn' }
  const beimAnbieter = belege.filter(
    (x) =>
      x.anilistId === b.anilistId &&
      kanaele.some((k) => plattformDesKanals[k] === x.platform) &&
      typeof x.dub === 'boolean',
  )
  if (beimAnbieter.length && !beimAnbieter.some((x) => x.dub === true)) {
    gesehen.add(schluessel)
    const quelle = beimAnbieter[beimAnbieter.length - 1]!
    neu.push(
      [
        `- anilistId: ${b.anilistId}`,
        `  title: ${JSON.stringify(b.title ?? String(b.anilistId))}`,
        `  platform: ${b.platform ?? 'primevideo'}`,
        ...(b.url ? [`  url: ${b.url}`] : []),
        '  dub: false',
        `  checkedAt: '${heute}'`,
        `  zweiteQuelle: ${JSON.stringify(`Handbeleg ${quelle.platform} ${quelle.checkedAt ?? ''}: kein deutscher Ton`)}`,
        `  note: ${JSON.stringify('Zwei Quellen ohne deutschen Ton: die Kanal-Meldung aus der Erweiterung (für sich kein Beleg, siehe CLAUDE.md) und der Handbeleg beim Anbieter des Kanals für denselben Titel.')}`,
      ].join('\n'),
    )
    log(`  – ${b.anilistId} ${(b.title ?? '').slice(0, 40).padEnd(40)} Handbeleg ${quelle.platform} ${quelle.checkedAt ?? ''}`)
    continue
  }
  const mitTon = (eintrag?.angebote ?? []).filter((a) => Array.isArray(a.audio) && a.audio.length)
  if (!mitTon.length) {
    ohneQuelle++
    continue
  }
  const deutsch = (s: string) => String(s).toLowerCase().startsWith('de')
  /*
    **Verglichen wird mit dem Angebot des gemeldeten Kanals, nicht mit dem ganzen Titel.**

    Bis zum 14.09.2026 zählte jedes Angebot mit deutschem Ton als Widerspruch.
    Bei Digimon nennt JustWatch „Amazon Prime Video" und „Aniverse Amazon
    Channel" mit Ton de, „Crunchyroll Amazon Channel" mit Ton es, ja, pt und
    deutschen Untertiteln. Die Meldung kam von der Crunchyroll-Kanal-Seite
    (`Abos: crunchyrollde`), und dieses Angebot hat kein Deutsch: Die Meldung
    war richtig, das Deutsch gehört zu einer **anderen Ausgabe**. Dasselbe bei
    Bungo Stray Dogs und Touken Ranbu (Aniverse-Kanal mit de).

    Daraus drei Fälle:
    - Kanal-Angebot ohne Deutsch → belegtes Nein für diese Ausgabe
    - Kanal-Angebot mit Deutsch → Widerspruch wie bisher (Free!)
    - ein anderes Amazon-Angebot mit Deutsch → zweite Ausgabe, die über die
      Prüfliste gesucht wird
  */
  const istKanalAngebot = (a: Angebot) =>
    /amazon channel/i.test(a.anbieter ?? '') &&
    kanaele.some((k) => (a.anbieter ?? '').toLowerCase().replace(/\s+/g, '').startsWith(k))
  const kanalAngebote = mitTon.filter(istKanalAngebot)
  const kanalMitDeutsch = kanalAngebote.some((a) => (a.audio ?? []).some(deutsch))
  const andereMitDeutsch = mitTon.filter(
    (a) =>
      /^Amazon Prime Video$|Amazon Channel$/i.test(a.anbieter ?? '') &&
      !istKanalAngebot(a) &&
      (a.audio ?? []).some(deutsch),
  )
  /*
    Ist die Ausgabe mit Deutsch schon belegt, gibt es nichts mehr zu suchen —
    und ebenso wenig, wenn eine andere Ausgabe schon geprüft und als nicht
    verfügbar belegt ist. Bungo Stray Dogs, 15.09.2026: Die Aniverse-Ausgabe von
    Staffel 1 ist in Deutschland nicht mehr abrufbar, JustWatchs „de" gehört zu
    Staffel 3. Ohne diese Bedingung stünde die Suche jeden Montag wieder auf der
    Liste.
  */
  const hatDeutscheAusgabe = belege.some(
    (x) =>
      x.anilistId === b.anilistId &&
      (x.platform ?? 'primevideo') === (b.platform ?? 'primevideo') &&
      (x.dub === true || (x.available === false && Boolean(x.url) && adressKern(x.url!) !== adressKern(b.url ?? ''))),
  )
  if (andereMitDeutsch.length && !kanalMitDeutsch && !hatDeutscheAusgabe) {
    widersprueche.push({
      art: 'andere-ausgabe',
      titleId: b.anilistId!,
      titel: b.title ?? String(b.anilistId),
      platform: b.platform ?? 'primevideo',
      quelle: `JustWatch ${eintrag?.geprueftAm ?? heute}`,
      ton: [...new Set(andereMitDeutsch.flatMap((a) => a.audio ?? []))].join(', '),
      anbieter: [...new Set(andereMitDeutsch.map((a) => a.anbieter ?? '?'))].join(', '),
      ...(b.url ? { url: b.url } : {}),
      seit: heute,
    })
    log(`  + ${b.anilistId} ${(b.title ?? '').slice(0, 40)} — zweite Ausgabe mit deutschem Ton: ${andereMitDeutsch.map((a) => a.anbieter).join(', ')}`)
  }
  /* Ohne Angebot des gemeldeten Kanals bleibt es beim Vergleich über alle Angebote. */
  const basis = kanalAngebote.length ? kanalAngebote : mitTon
  if (basis.some((a) => (a.audio ?? []).some(deutsch))) {
    /* Das Deutsch einer anderen Ausgabe ist oben schon als solche vermerkt. */
    if (kanalMitDeutsch || !andereMitDeutsch.length) {
      widerspruch++
    /*
        **Ein Widerspruch ist kein Nichts — er gehört zurück in die Prüfliste.**

        Die Meldung sagt „kein Deutsch", JustWatch findet welches: Bei einem
        Kanal-Titel zeigt Prime ohne das Abo die deutsche Tonspur gar nicht, und
        14 von 45 solcher Meldungen waren am 07.09.2026 genau deshalb falsch.
        Ohne diesen Vermerk stünde der Titel als „geprüft, ohne Urteil" da und
        käme nie wieder auf die Liste — die Meldung verhinderte ihre eigene
        Überprüfung.
      */
    widersprueche.push({
        art: 'kanal',
        titleId: b.anilistId!,
        titel: b.title ?? String(b.anilistId),
        platform: b.platform ?? 'primevideo',
        quelle: `JustWatch ${eintrag?.geprueftAm ?? heute}`,
        ton: [...new Set(mitTon.flatMap((a) => a.audio ?? []))].join(', '),
        seit: heute,
      })
      log(`  ~ ${b.anilistId} ${(b.title ?? '').slice(0, 40)} — JustWatch findet deutschen Ton, kein Urteil`)
    }
    continue
  }
  gesehen.add(schluessel)
  const anbieter = basis.map((a) => a.anbieter ?? '?').slice(0, 3).join(', ')
  const spuren = [...new Set(basis.flatMap((a) => a.audio ?? []))].join(', ')
  const nurSub = basis.some((a) => (a.untertitel ?? []).some(deutsch))
  if (jwFrisch(eintrag, heute)) {
    zurHand.push({
      titleId: b.anilistId!,
      titel: b.title ?? String(b.anilistId),
      plattform: b.platform ?? 'primevideo',
      ...(b.url ? { url: b.url } : {}),
      folgerung: `kein Deutsch (Kanal-Meldung + JustWatch: ${anbieter} — Ton ${spuren})`,
      ...(eintrag?.jwPfad ? { jwPfad: eintrag.jwPfad } : {}),
      seit: heute,
    })
    log(`  ? ${b.anilistId} ${(b.title ?? '').slice(0, 40).padEnd(40)} frische JustWatch-Daten — zur Handprüfung`)
    continue
  }
  neu.push(
    [
      `- anilistId: ${b.anilistId}`,
      `  title: ${JSON.stringify(b.title ?? String(b.anilistId))}`,
      `  platform: ${b.platform ?? 'primevideo'}`,
      ...(b.url ? [`  url: ${b.url}`] : []),
      '  dub: false',
      `  checkedAt: '${heute}'`,
      `  zweiteQuelle: ${JSON.stringify(`JustWatch ${eintrag?.geprueftAm ?? heute}: ${anbieter} — Ton ${spuren}${nurSub ? ', Deutsch nur als Untertitel' : ''}`)}`,
      `  note: ${JSON.stringify(
        `Zwei Quellen ohne deutschen Ton: die Kanal-Meldung aus der Erweiterung (für sich kein Beleg, siehe CLAUDE.md) und JustWatch mit ${basis.length} Angebot(en), deren Tonspuren belegt sind und Deutsch nicht enthalten.`,
      )}`,
    ].join('\n'),
  )
  log(`  – ${b.anilistId} ${(b.title ?? '').slice(0, 40).padEnd(40)} ${basis.length} Angebot(e), Ton: ${spuren.slice(0, 40)}`)
}

log('')
log(`${neu.length} belegte Nein, ${widerspruch} Widersprüche, ${ohneQuelle} ohne zweite Quelle, ${zurHand.length} zur Handprüfung.`)
if (!TROCKEN) handpruefungSchreiben('kanal', zurHand, true, heute)

if (!TROCKEN) {
  /*
    **Eigene Datei, nicht `data/tonspur-verdacht.json`.**

    Die schreibt `pipeline/tonspur-verdacht.ts` bei jedem Lauf vollständig neu;
    ein Eintrag darin wäre beim nächsten Durchgang weg — dieselbe Falle, die am
    09.09.2026 schon `data/adn-adressen.yaml` erwischt hat.

    Geschrieben wird auch eine leere Liste: Sie sagt „geprüft, nichts
    widersprüchlich", und das ist eine andere Auskunft als eine fehlende Datei.
  */
  writeFileSync(
    resolve(ROOT, 'data/kanal-widerspruch.json'),
    `${JSON.stringify({ standAm: heute, faelle: widersprueche }, null, 2)}\n`,
  )
  log(`${widersprueche.length} Widerspruch/Widersprüche nach data/kanal-widerspruch.json geschrieben.`)
}

if (!neu.length) {
  log('Nichts zu schreiben.')
} else if (TROCKEN) {
  log('Trockenlauf — nichts geschrieben.')
} else {
  const p = resolve(ROOT, 'data/dub-confirmed.yaml')
  const alt = readFileSync(p, 'utf8')
  const text = `${alt.trimEnd()}\n\n# --- Kanal-Meldungen mit zweiter Quelle belegt, ${heute} ---\n${neu.join('\n')}\n`
  /* Erst lesen, dann schreiben — ein YAML-Fehler soll hier auffallen, nicht im Bau. */
  try {
    yaml.load(text)
  } catch (e) {
    warn(`Die erzeugten Zeilen ergeben kein gültiges YAML — nichts geschrieben. ${(e as Error).message}`)
    process.exit(1)
  }
  writeFileSync(p, text)
  log(`${neu.length} Belege nach data/dub-confirmed.yaml geschrieben.`)
}
