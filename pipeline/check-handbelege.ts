/**
 * Hält jede Handprüfung gegen den gebauten Datensatz.
 *
 * ## Warum es das gibt
 *
 * `data/dub-confirmed.yaml` enthält **1.946 Angaben, die Daniel selbst geprüft
 * hat** — Verweis geöffnet, Tonspur nachgesehen. Das ist die einzige Quelle im
 * Projekt, die weder rät noch schweigt, und mit Abstand die teuerste: Sie
 * kostet seine Zeit, nicht Rechenzeit.
 *
 * Daniel am 23.08.2026: „Die von mir gestern von hand gemeldeten netflix titel
 * per extension, sind aktuelle echte infos. beim nächsten automatischen lauf
 * könnten die mit falschen daten überschrieben werden, wenn die quellen falsche
 * daten haben."
 *
 * Der Schutz dagegen steht in `pipeline/build.ts` an drei Stellen als
 * `if (stream.dub !== undefined) continue` — also in einer **Reihenfolge**, und
 * Reihenfolgen brechen leise. Wer eine Quelle nach oben zieht oder die
 * Bedingung vergisst, bemerkt nichts: Der Datensatz sieht danach genauso
 * vollständig aus, nur steht an einzelnen Stellen die Vermutung einer Quelle,
 * wo eine Messung stand. Diese Prüfung macht daraus eine Zusicherung.
 *
 * ## Was hier absichtlich **nicht** als Fehler gilt
 *
 * Ein Titel kann mehrere Einträge tragen — je Anbieter einen, und je Bereich
 * einen (`dubRanges`, etwa „Folge 1–155 deutsch"). Ein einzelnes `dub: false`
 * heißt dann nicht, dass der Verweis verschwinden muss: Es kann für eine
 * Staffel gelten, während eine andere unter derselben Adresse deutsch läuft.
 * Gemeldet wird deshalb nur, wo **alle** Belege eines Verweises in dieselbe
 * Richtung zeigen und der Datensatz trotzdem etwas anderes sagt.
 *
 * ## Ein neuer Beleg macht den Deploy rot, bis ein Datenlauf ihn einlöst
 *
 * Das ist keine Panne, sondern die Bauweise — aber sie überrascht, wenn man sie
 * nicht kennt. Der Deploy baut nur die **Website**; den Datensatz erneuern die
 * Datenläufe. Wer hier einen Beleg einträgt, der etwas anderes sagt als
 * `public/data/titles.json`, hat den Deploy so lange blockiert, bis ein
 * Datenlauf gebaut und committet hat.
 *
 * Real am 24.08.2026: Ein Beleg „Peter Grill bei ADN nicht mehr verfügbar" ließ
 * jeden Deploy scheitern, weil der Verweis im Datensatz noch stand. Aufgelöst
 * hat es erst ein `refresh-data`-Lauf.
 *
 * Wer also einen Beleg von Hand einträgt, stößt danach einen Datenlauf an —
 * sonst steht die Seite still.
 *
 * Aufruf: npm run check:handbelege
 */
import { loadDubChecks, adressKern, neinHandbelege, type DubCheck } from './lib/dub-confirmed.ts'
import { readJson, log, warn, ROOT } from './lib/util.ts'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { nimmJa } from './lib/dub-bereiche.ts'
import { findeKonflikte, findeVereinte } from './lib/dub-konflikt.ts'
import { findeSchrumpf } from './lib/dub-schrumpf.ts'
import { findeVoraussichtlichImBestand } from './lib/voraussichtlich-pruefung.ts'
import { pruefeVerwaiste } from './lib/handbeleg-verwaist.ts'
import { bezugswegeTrotzNein } from './lib/handbeleg-bezugswege.ts'
import type { Release, Title } from '../shared/types.ts'
import { erstausgabeTrotzNein } from './bau/erstausgabe-markieren.ts'
import { mitZurueckgestellten } from './lib/quarantaene.ts'

/*
  Seit dem 11.10.2026 verteilt `bau/cartoon-wege.ts` einen Cartoon-Weg auf Staffeln (ein Weg je Staffel, gleiche Adresse).
  Ein Ja gilt dann dem Teilweg, der das Häkchen trägt; die anderen Staffeln sagen mit Recht nichts (Archer, American Dad).
  Fehlt das Häkchen auf allen Teilwegen der Adresse, bleibt es ein Fehler.
*/
const roh = readJson<Title[] | Record<string, Title>>(resolve(ROOT, 'public/data/titles.json'), [])
/* Cartoons (negative Kennungen) tragen seit dem 16.09.2026 ebenfalls Handbelege. */
const titel = [
  ...(Array.isArray(roh) ? roh : Object.values(roh)),
  ...readJson<Title[]>(resolve(ROOT, 'public/data/cartoons.json'), []),
]
const nachId = new Map(titel.map((t) => [t.id, t]))

const belege = loadDubChecks()

/**
 * Die **ungefilterte** Datei — loadDubChecks() fuehrt mehrere Zeilen zu einem
 * Verweis bereits zusammen, und genau diese Zusammenfuehrung soll unten geprueft
 * werden. Wer das Ergebnis gegen sich selbst prueft, prueft nichts.
 */
const rohBelege = (yaml.load(readFileSync(resolve(ROOT, 'data/dub-confirmed.yaml'), 'utf8')) ??
  []) as {
  anilistId?: number
  platform?: string
  checkedAt?: string
  /* url, dub und available braucht die Prüfung auf den jüngsten Beleg — sie
     unterscheidet damit Ausgaben und trennt Adressbelege von Befunden. */
  url?: string
  dub?: boolean
  available?: boolean
}[]

/** Alle Belege eines Verweises zusammen — ein Verweis, nicht ein Eintrag. */
const jeVerweis = new Map<string, typeof belege>()
for (const b of belege) {
  const k = `${b.anilistId}:${b.platform}`
  jeVerweis.set(k, [...(jeVerweis.get(k) ?? []), b])
}

const fehler: string[] = []
let bestaetigt = 0
let entferntWieVorgesehen = 0
let uneindeutig = 0

for (const [k, gruppe] of jeVerweis) {
  const [idRoh, platform] = k.split(':')
  const t = nachId.get(Number(idRoh))
  if (!t) continue
  /**
   * **Nennt der Beleg eine Adresse, gilt er ihr — nicht der Plattform.**
   *
   * Die Suche lief über `platform` allein und meldete deshalb einen Fehler, wo
   * keiner ist: „Haikyu!! 3rd Season" trägt einen Beleg `available: false` zu
   * `B07L1CMH2D` („alle 0 Folgen") und seit dem 10.09.2026 einen Verweis auf
   * `B0D544CDK6`, eine andere Seite desselben Titels mit elf Folgen. Beides ist
   * richtig, und `belegFuer()` im Bau unterscheidet es längst über
   * `adressGleich()`.
   *
   * Ohne Adresse im Beleg bleibt es beim alten Weg: Dann gilt er der ganzen
   * Plattform, und genau so wirkt er auch im Bau.
   */
  const belegAdressen = gruppe.map((b) => b.url).filter((u): u is string => Boolean(u))
  const stream = belegAdressen.length
    ? (t.streams ?? []).find(
        (s) =>
          s.platform === platform &&
          belegAdressen.some(
            /* Nach der gti-Brücke steht die Amazon-Seite des Belegs in `seite` (17.09.2026). */
            (u) => adressKern(u) === adressKern(s.url) || (Boolean(s.seite) && adressKern(u) === adressKern(s.seite)),
          ),
      )
    : (t.streams ?? []).find((s) => s.platform === platform)
  const name = `${idRoh} (${t.titleRomaji ?? '?'}) — ${platform}`

  const sagtJa = gruppe.some((b) => b.dub === true || (b.dubRanges ?? []).some((r) => r.dub))
  const sagtNein = gruppe.some((b) => b.dub === false)
  const sagtWeg = gruppe.some((b) => b.available === false)

  // Widersprüchliche Belege sind kein Pipeline-Fehler, sondern ein Hinweis auf
  // Bereiche. Sie werden gezählt, nicht gemeldet.
  if (sagtJa && (sagtNein || sagtWeg)) {
    uneindeutig++
    continue
  }

  if (sagtWeg || sagtNein) {
    /*
      Ein Nein mit Adresse gilt der alten Seite. Ein über die gti-Brücke ersetzter
      Verweis zeigt auf eine neue Seite und trägt die alte nur als `seite`.
    */
    /*
      Gezählt werden nur die Adressen der Belege, die Nein sagen. Ein Eintrag ohne
      Urteil zu einer anderen Seite (Kanal-Nein, abgelegt) machte sonst das alte
      „nicht verfügbar“ zu einer Aussage über den neuen Weg (A Silent Voice,
      19.09.2026: B082QV9TK8 weg, gti-Seite über den Crunchyroll-Kanal).
    */
    const neinAdressen = gruppe
      .filter((b) => b.available === false || b.dub === false)
      .map((b) => b.url)
      .filter((u): u is string => Boolean(u))
    const pruefAdressen = neinAdressen.length ? neinAdressen : belegAdressen
    const nochDa =
      stream && (!pruefAdressen.length || pruefAdressen.some((u) => adressKern(u) === adressKern(stream.url)))
    const urteil = sagtWeg ? 'nicht verfügbar' : 'ohne deutsche Tonspur'
    /* Auch ein Bezugsweg (`watchLinks`) behauptet den Anbieter; der Bau hält ihn bei einem Nein zurück. */
    const wege = bezugswegeTrotzNein(t, platform!, pruefAdressen, sagtWeg)
    if (nochDa) fehler.push(`${name}: als „${urteil}" geprüft, steht aber noch im Datensatz`)
    else if (wege.length) fehler.push(`${name}: als „${urteil}" geprüft, steht aber noch als Bezugsweg im Datensatz (${wege.map((w) => w.name).join(', ')})`)
    else entferntWieVorgesehen++
    continue
  }

  if (!sagtJa) continue
  /*
    Ebenso beim Ja: Es gilt dem Weg seiner eigenen Adresse. Ein Eintrag ohne Urteil
    zu einer anderen Seite desselben Titels (JoJo-Sammelseite B0CG7S59KL neben
    B0GX7VDJK3, 19.09.2026) lieferte sonst den falschen Weg zum Vergleich.
  */
  const jaAdressen = gruppe
    .filter((b) => b.dub === true || (b.dubRanges ?? []).some((r) => r.dub))
    .map((b) => b.url)
    .filter((u): u is string => Boolean(u))
  const jaStream = jaAdressen.length
    ? (nimmJa(t.streams ?? []).find(
        (s) =>
          s.platform === platform &&
          jaAdressen.some(
            (u) => adressKern(u) === adressKern(s.url) || (Boolean(s.seite) && adressKern(u) === adressKern(s.seite)),
          ),
        /*
          Kein Rückfall auf einen fremden Weg (22.09.2026): Fairy Tails Ja-Beleg zu B0GZL7MBG1
          wurde mit dem neuen, urteilslosen Weg B0CHBX8CM2 verglichen, und der Bau wurde rot. Der
          Bau selbst wendet einen Beleg zu einer fremden Ausgabe nicht an (`belegFuer`, Punkt 3).
        */
      ) ?? null)
    : stream
  if (!jaStream) {
    // Kein Fehler der Rangfolge: Der Verweis kann aus einem anderen Grund
    // fehlen (Anbieter nicht geführt, Titel umsortiert). Trotzdem sichtbar.
    uneindeutig++
    continue
  }
  if (jaStream.dub !== true) {
    fehler.push(`${name}: von Hand als deutsch geprüft, im Datensatz steht dub=${String(jaStream.dub)}`)
    continue
  }
  bestaetigt++
}

log(`Handprüfungen: ${belege.length} Einträge auf ${jeVerweis.size} Verweise`)
log(`  im Datensatz bestätigt : ${bestaetigt}`)
log(`  korrekt entfernt       : ${entferntWieVorgesehen}`)
log(`  uneindeutig (Bereiche) : ${uneindeutig} — nicht bewertet`)

if (fehler.length) {
  warn(`${fehler.length} Handprüfungen werden vom Datensatz nicht wiedergegeben:`)
  for (const f of fehler.slice(0, 25)) warn('   ' + f)
  if (fehler.length > 25) warn(`   … und ${fehler.length - 25} weitere`)
  console.log(`VERSTÖSSE: ${fehler.length}`)
  process.exit(1)
}

/**
 * Jede Kennung muss einen Titel treffen.
 *
 * Am 24.08.2026 stand hier ein Eintrag mit anilistId 2049 fuer "Eyeshield
 * 21" -- richtig ist 15. Die Kennung war geraten statt nachgeschlagen, der
 * Eintrag zeigte ins Leere, und die Pruefung wirkte nirgends.
 *
 * Die Pruefung darueber fand das nicht: Sie haelt jede Handpruefung gegen
 * den Datensatz und uebergeht, wozu es dort nichts gibt. Diese Zeile
 * schliesst die Luecke von der anderen Seite.
 *
 * Trifft eine Kennung keinen Titel, ist entweder sie falsch oder der Titel
 * fehlt im Bestand -- beides muss auffallen.
 */
/* Hinter dem Toggle liegt verschoben, nicht gelöscht: ein Titel in `ohne-synchro.json` ist bekannt. */
const hinterToggle = readJson<{ id: number }[]>(resolve(ROOT, 'public/data/ohne-synchro.json'), [])
/* Eine Kennung ins Leere macht den Lauf rot (Eyeshield 2049, 24.08.2026); im Vergleichsbau nur Warnung. */
/* Zurückgestellt (Quarantäne, `meta.quarantaene`) ist ebenfalls bekannt: der Handbeleg bleibt und greift beim nächsten sauberen Bau. */
pruefeVerwaiste(loadDubChecks(), mitZurueckgestellten(new Set([...titel, ...hinterToggle].map((t) => t.id))))

log('✓ Jede eindeutige Handprüfung steht so im Datensatz, wie sie geprüft wurde.')

/**
 * Bei mehreren Zeilen zu einem Verweis muss der **jüngste** Befund gewinnen.
 *
 * Diese Prüfung fehlte, und deshalb blieb ein Fehler zwei Tage unbemerkt: Bei
 * „Kill Ao"/Netflix stand Daniels Prüfung vom 24.08.2026 (Folge 1–4 deutsch)
 * weiter **vorn** in der Datei als eine Meldung aus der Erweiterung vom 23.08.
 * (1–2 ja, 3–12 nein). `verschmelze()` liess den späteren in der Datei gewinnen
 * — also den älteren Befund.
 *
 * Der Rest dieser Datei konnte das nicht finden: Er betrachtet alle Zeilen eines
 * Verweises **zusammen** und fragt nur, ob der Datensatz zu irgendeiner davon
 * passt. Die Frage „welche gilt" stellte niemand.
 *
 * Geprüft wird deshalb gegen die Rohdaten, nicht gegen das Ergebnis: Was
 * `loadDubChecks()` zurückgibt, muss das `checkedAt` der jüngsten Zeile tragen.
 *
 * **Zweimal nachgezogen am 07.09.2026, beide Male wegen derselben Umstellung.**
 * Seit `loadDubChecks()` je **Ausgabe** einen Eintrag führt statt je Titel
 * (Anlass: Date a Live IV, wo ein Prime-Abo mit Deutsch und ein
 * Crunchyroll-Kanal ohne dieselbe Kennung teilten), stimmen zwei Annahmen
 * dieser Prüfung nicht mehr:
 *
 * - **Die Gruppe ist die Ausgabe, nicht der Titel.** Zwei Ausgaben desselben
 *   Titels dürfen verschieden alte Belege tragen; das ist kein Fehler, sondern
 *   der Sinn der Trennung. Gruppiert wird deshalb über den Adresskern mit.
 * - **Adressbelege zählen nicht mit.** Zeilen mit `url` und ohne Aussage
 *   („Verweis aus Netflix' eigener Staffelliste erschlossen") sind keine
 *   Befunde; ein jüngerer von ihnen überholt kein Urteil. Sie mitzuzählen
 *   erzeugte 26 Meldungen über Belege, die gar nicht konkurrieren.
 */
{
  const aussage = (b: { dub?: boolean; available?: boolean }) =>
    typeof b.dub === 'boolean' || typeof b.available === 'boolean'
  const jeSchluessel = new Map<string, { checkedAt?: string }[]>()
  for (const b of rohBelege) {
    if (!aussage(b)) continue
    const k = `${b.anilistId}|${b.platform}|${adressKern(b.url)}`
    jeSchluessel.set(k, [...(jeSchluessel.get(k) ?? []), b])
  }
  const verschluckt: string[] = []
  for (const [k, gruppe] of jeSchluessel) {
    if (gruppe.length < 2) continue
    const juengstes = gruppe.map((g) => g.checkedAt ?? '').sort().at(-1)
    const gewaehlt = belege.find(
      (b) => `${b.anilistId}|${b.platform}|${adressKern(b.url)}` === k && aussage(b),
    )
    if (gewaehlt && (gewaehlt.checkedAt ?? '') !== juengstes) {
      verschluckt.push(`${k}: es gilt ${gewaehlt.checkedAt}, jüngster Beleg ist ${juengstes}`)
    }
  }
  if (verschluckt.length) {
    warn(`Abbruch: ${verschluckt.length} Verweis(e) benutzen einen veralteten Beleg:`)
    for (const v of verschluckt.slice(0, 8)) warn(`   ${v}`)
    console.log(`VERSTÖSSE: ${verschluckt.length}`)
    process.exit(1)
  }
  const mehrfach = [...jeSchluessel.values()].filter((g) => g.length > 1).length
  log(`✓ ${mehrfach} Verweis(e) mit mehreren Belegen — überall gilt der jüngste.`)
}

/* Zwei Meldungen vom selben Tag, die für dieselbe Folge Ja und Nein sagen: `verschmelze` lässt das Nein gelten. Nur ein Hinweis. */
{
  const konflikte = findeKonflikte(rohBelege as DubCheck[])
  if (!konflikte.length) log('✓ Keine zwei Meldungen vom selben Tag widersprechen sich.')
  else {
    warn(`Hinweis: ${konflikte.length} Verweis(e) mit widersprüchlichen Meldungen vom selben Tag (es gilt das Nein):`)
    for (const k of konflikte.slice(0, 8)) {
      warn(`   ${k.schluessel}: Folge(n) ${k.folgen.slice(0, 5).join(', ')}${k.folgen.length > 5 ? ` … (${k.folgen.length})` : ''}`)
    }
  }
}

/* Verweise, deren Bereiche aus mehreren Meldungen vereint werden (`verschmelze`): je Verweis eine Zeile mit dem Ergebnis. */
{
  const vereinte = findeVereinte(rohBelege as DubCheck[])
  log(`✓ ${vereinte.length} Verweis(e) mit vereinten Folgenbereichen aus mehreren Meldungen.`)
  for (const v of vereinte.slice(0, 12)) log(`   ${v.titel ?? v.schluessel} (${v.plattform}): ${v.ergebnis}`)
  if (vereinte.length > 12) log(`   … und ${vereinte.length - 12} weitere`)
}

/*
  Anime: eine jüngere Meldung gilt für die Folgen, die sie nennt (`verschmelze`). Ein Schrumpf bleibt also nur,
  wo sie ein Nein zu bisher deutschen Folgen sagt. Nur ein Hinweis: ob das eine Korrektur ist, sagt die Datei nicht.
*/
{
  const schrumpf = findeSchrumpf(rohBelege as DubCheck[])
  if (!schrumpf.length) log('✓ Kein Anime-Verweis verliert deutsche Folgen durch eine jüngere Meldung.')
  else {
    warn(`Hinweis: ${schrumpf.length} Anime-Verweis(e) verlieren deutsche Folgen durch eine jüngere Meldung:`)
    for (const s of schrumpf.slice(0, 8)) {
      warn(`   ${s.schluessel}: ${s.verloren.length} Folge(n), z. B. ${s.verloren.slice(0, 5).join(', ')}`)
    }
  }
}

/*
  Eine Handeintragung, deren `note` „voraussichtlich" sagt, ist geschätzt und trägt `schedule.estimated: true`
  (Kaiju-No.-8-Disc und Heaven's-Feel-Disc, 12.10.2026: fiel nur dem Prüfer auf). Nur die `note` wird gelesen, siehe lib.
*/
{
  const unmarkiert = findeVoraussichtlichImBestand(resolve(ROOT, 'data/curated'))
  if (unmarkiert.length) {
    warn(`Abbruch: ${unmarkiert.length} kuratierte(r) Eintrag/Einträge nennen „voraussichtlich", aber der Termin trägt kein estimated: true:`)
    for (const u of unmarkiert) warn(`   ${u}`)
    console.log(`VERSTÖSSE: ${unmarkiert.length}`)
    process.exit(1)
  }
  log('✓ Jeder kuratierte Termin mit „voraussichtlich" in der note trägt estimated: true.')
}

/*
  Keine Erstveröffentlichung gegen einen Nein-Handbeleg (Bleach „The Calamity“, Disney+, 14.10.2026: Handbeleg „nur mit Untertiteln“, der Termin hieß trotzdem
  „Erstveröffentlichung“). Der Bau lässt die Marke dort weg; hier die Zusicherung am gebauten Bestand.
*/
{
  const falsch = erstausgabeTrotzNein(readJson<Release[]>(resolve(ROOT, 'public/data/releases.json'), []), neinHandbelege(belege))
  if (falsch.length) {
    warn(`Abbruch: ${falsch.length} Release(s) tragen „erstausgabe“, obwohl ein Nein-Handbeleg ihren Anbieter verneint: ${falsch.slice(0, 5).join(', ')}`)
    console.log(`VERSTÖSSE: ${falsch.length}`)
    process.exit(1)
  }
  log('✓ Keine Erstveröffentlichung gegen einen Nein-Handbeleg.')
}
console.log('VERSTÖSSE: 0')
