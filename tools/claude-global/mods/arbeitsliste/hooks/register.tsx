import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderSurface, Timer } from 'claude-code'

import { KURZTITEL_MAX, kuerze, loeseZiel, schalte, schneide, sortiere, sortiereJetzt, teile, zaehle, zaehleLive, zaehlePipeline, zaehleVonDir, zuLang } from './zaehlen'
import type { DanielEintrag, DanielTodo, Dringlichkeit, Eintrag, Liste, LiveEintrag, Ort, PipelineEintrag, Schnitt } from './zaehlen'
import { BALD_MIN, DRINGEND_MIN, abstandMin, detailZeile, inKurz, sortiereRegeln, zaehleRegelmaessig } from './regelmaessig'
import type { Regel } from './regelmaessig'
import { baueLeiste } from './leiste'
import type { LeisteStand } from './leiste'
import { LOG, MESS_MARKER, haengeAn, messDauer, messStart, unterschied } from './messung'
import { kopierText } from './kopieren'
import { agentenText, istPruefer } from './pruefer'
import { bereichOffen, bereichsKennung, bereichsKopf, topPriosKasten } from './bereiche'
import type { PrioUmfeld } from './bereiche'
import { prioZeichenJeZeile, zaehleTopPrios, zeichenJeSpalte } from './prios'
import type { PrioEintrag } from './prios'

const DATEI = 'C:/code/ai/anime-kalender-de/daniel-zum-abarbeiten/stand.md'
// Je Sitzung eine Datei `<Sitzungs-ID>.txt` (Stop-Hook agenten-vorrat.js); fremde Sitzungen zählen hier nicht.
const MARKER_ORDNER = 'C:/Users/ih/.claude/autonomer-modus'
const PANE = 'arbeitsliste'
// Chip „in 37 min“: feste Breite, rechtsbündig.
const CHIP = 9
const AKZENT = 'claude'
// Themenschlüssel: folgt dem hellen/dunklen Thema (im Standardthema bläulich).
const LINK_FARBE = 'suggestion'
const MAX_ZEILEN = 2
// Terminal-Darstellung der Warte-Art (Emoji aus stand.md); ⏰ markiert fällige Termine in Jetzt.
const ICON: Record<string, string> = { kalender: '📅', wartet: '⏳', blockiert: '🚫' }
// Jetzt: Icon und Themenfarbe je Dringlichkeit (rot / orange bis gelb / bläulich).
const DRINGLICH_ICON: Record<Dringlichkeit, string> = { dringend: '🔴', heute: '🟠', bald: '🔵' }
const DRINGLICH_FARBE: Record<Dringlichkeit, string> = { dringend: 'error', heute: 'warning', bald: 'suggestion' }

const liste = atom({ plugin: 'arbeitsliste', key: 'liste' } as const, { inArbeit: [], todo: [] } as Liste)
const vonDir = atom({ plugin: 'arbeitsliste', key: 'vonDir' } as const, { jetzt: [], spaeter: [] } as DanielTodo)
// Zahl fälliger 📅-Einträge: nur wenn sie sich ändert, zeichnet der 30-s-Takt neu.
const faellig = atom({ plugin: 'arbeitsliste', key: 'faellig' } as const, 0)
// Schon auf 2 Tage gefiltert; der 30-s-Takt schreibt nur bei Änderung.
const live = atom({ plugin: 'arbeitsliste', key: 'live' } as const, [] as LiveEintrag[])
const pipeline = atom({ plugin: 'arbeitsliste', key: 'pipeline' } as const, [] as PipelineEintrag[])
// Farbe der Ort-Marke in „In Pipeline“ (Themenschlüssel); „?“ fällt auf.
const ORT_FARBE: Record<Ort, string> = { pipeline: 'warning', worker: AKZENT, warteliste: 'suggestion', deploy: 'success', '?': 'error' }
// Schlüssel V2: ein beim Hot-Reload erhaltener Altzustand ohne status/details darf nicht gezeichnet werden.
const topPrios = atom({ plugin: 'arbeitsliste', key: 'topPriosV2' } as const, [] as PrioEintrag[])
const regeln = atom({ plugin: 'arbeitsliste', key: 'regeln' } as const, [] as Regel[])
// Minute der letzten Neuzeichnung: der Countdown „in 13 h 45 min“ ändert sich nur beim Minutenwechsel.
const minute = atom({ plugin: 'arbeitsliste', key: 'minute' } as const, 0)
const autonomBis = atom({ plugin: 'arbeitsliste', key: 'autonomBis' } as const, null as string | null)
// Ruhemodus (Daniel, 10.10.2026): solange die Markerdatei existiert, höchstens zwei Agenten.
const RUHE_MARKER = 'C:/Users/ih/.claude/ruhemodus.txt'
// Ruhemodus aus der Markerdatei: „hart“ (sofort höchstens 2) oder „sanft“ (Laufende enden, keine neuen; Standard seit 20.10.2026, auch bei leerer Datei).
type Ruhe = 'hart' | 'sanft' | null
const ruhe = atom({ plugin: 'arbeitsliste', key: 'ruhe' } as const, null as Ruhe)
// Sparmodus (Daniel, 19.10.2026): solange die Markerdatei existiert, nur Sonnet mittel und Haiku als Subagenten.
const SPAR_MARKER = 'C:/Users/ih/.claude/sparmodus.txt'
const spar = atom({ plugin: 'arbeitsliste', key: 'spar' } as const, false)
const offen = atom({ plugin: 'arbeitsliste', key: 'offen' } as const, null as number | null)
const agentenKnopf = atom({ plugin: 'arbeitsliste', key: 'agentenKnopf' } as const, 0)
// Kennungen der ausgeklappten Bereiche („weitere“) und Gruppen (Kleinigkeiten).
const aufgeklappt = atom({ plugin: 'arbeitsliste', key: 'aufgeklappt' } as const, [] as string[])

// Fremder Zustand von savvy-progress: nur lesen, nie schreiben.
const savvyAgents = { plugin: 'savvy-progress', key: 'agents' } as const

let timer: Timer | null = null
let letzterStatus: string | undefined
// Leiste nur neu bauen, wenn sich ein angezeigter Wert ändert (Zwischenspeicher je Schlüssel).
let letzteLeiste: { schluessel: string; element: unknown } | null = null
// Angezeigte Werte der Leiste: der Hintergrund hält sie aktuell, der Render liest nur diese Variable (kein await,
// kein State-Abo). Ein Abo auf savvy-progress.agents zeichnete die Leiste bei jedem Fortschrittsschritt neu (Flackern, 11.10.2026).
type LeistenDaten = Omit<LeisteStand, 'oeffneAgenten' | 'oeffneListe'>
let leistenDaten: LeistenDaten | null = null
let leistenSchluessel = ''
let leistenTimer: Timer | null = null
let savvyVersion = -1
let letzteProps: Record<string, unknown> | null = null
// Agentenliste fürs Pane aus dem Hintergrundtakt: Savvy im Render zu lesen abonniert jeden Fortschrittsschritt.
let agentenListe: Agent[] = []

// Jedes Schreiben zeichnet alle Leser neu (Hover geht verloren, Last): geschrieben wird nur bei geändertem Inhalt.
const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

// Endzeit aus der eigenen Markerdatei, solange sie in der Zukunft liegt.
async function lieseAutonomBis($: EngineInterface): Promise<string | null> {
  try {
    const roh = ((await $.fs.read(`${MARKER_ORDNER}/${await $.session.id()}.txt`)) as string).trim()
    return Date.parse(roh) > Date.now() ? roh : null
  } catch {
    return null
  }
}

async function lieseRuhe($: EngineInterface): Promise<Ruhe> {
  try {
    const inhalt = ((await $.fs.read(RUHE_MARKER)) as string).trim().toLowerCase()
    return inhalt === 'hart' ? 'hart' : 'sanft'
  } catch {
    return null
  }
}

async function lieseSpar($: EngineInterface): Promise<boolean> {
  try {
    await $.fs.read(SPAR_MARKER)
    return true
  } catch {
    return false
  }
}

function uhrzeit(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

type Agent = { type?: string; description: string; stepDone?: number; stepTotal?: number }

// Laufende Savvy-Agenten; ohne Savvy oder bei Fehler leer.
async function laufendeAgenten($: EngineInterface): Promise<Agent[]> {
  try {
    const { value } = (await $.state.get(savvyAgents)) as { value?: (Agent & { status: string })[] }
    return (value ?? []).filter(a => a.status === 'running')
  } catch {
    return []
  }
}

// Messung (messung.ts): Merkflag, vom Hintergrundtakt gesetzt, damit der Render nichts erwarten muss.
let messungAn = false
let protokollKette: Promise<void> = Promise.resolve()

async function pruefeMessung($: EngineInterface): Promise<void> {
  try {
    messungAn = await $.fs.exists(MESS_MARKER)
  } catch {
    messungAn = false
  }
}

// Zeile anhängen (Lesen-Anhängen-Schreiben, seriell, damit parallele Aufrufe nichts überschreiben).
function protokoll($: EngineInterface, art: string, text: string): void {
  if (!messungAn) return
  protokollKette = protokollKette
    .then(async () => {
      const alt = await ($.fs.read(LOG) as Promise<string>).catch(() => '')
      await $.fs.write(LOG, haengeAn(alt, art, text))
    })
    .catch(() => undefined)
}

// Werte der Leiste aus den Atomen und dem Savvy-Stand; Lesen außerhalb des Renders abonniert nichts.
async function ermittleLeiste($: EngineInterface): Promise<LeistenDaten> {
  const bis = await read($, autonomBis)
  const von = teile(await read($, vonDir), new Date())
  const agenten = await laufendeAgenten($)
  agentenListe = agenten
  return {
    agenten: agenten.filter(a => !istPruefer(a)).length,
    pruefer: agenten.filter(istPruefer).length,
    jetzt: von.jetzt.length,
    autonomBis: bis ? uhrzeit(bis) : null,
    ruhe: await read($, ruhe),
    spar: await read($, spar),
  }
}

// Wer schreibt savvy-progress.agents und wie oft: nur für die Messung, Version steigt je Schreibzugriff.
async function protokolliereSavvy($: EngineInterface): Promise<void> {
  const { version } = (await $.state.get(savvyAgents)) as { version?: number }
  if (version === savvyVersion) return
  protokoll($, 'savvy', `agents Version ${savvyVersion} -> ${version}`)
  savvyVersion = version ?? -1
}

// Neue Werte übernehmen und die Leiste nur bei echter Änderung neu zeichnen lassen.
async function aktualisiereLeiste($: EngineInterface, anlass: string): Promise<void> {
  await pruefeMessung($)
  if (messungAn) await protokolliereSavvy($).catch(() => undefined)
  const neu = await ermittleLeiste($)
  // Agentennamen gehören in den Schlüssel, damit das Pane einen Wechsel bei gleicher Zahl sieht.
  const schluessel = JSON.stringify(neu) + agentenListe.map(a => a.description).join('|')
  if (schluessel === leistenSchluessel) return
  leistenDaten = neu
  leistenSchluessel = schluessel
  protokoll($, 'stand', `${anlass} ${schluessel}`)
  $.ui.invalidate('ui.render')
}

// Leiste über dem Prompt: synchron aus dem gehaltenen Stand, Element je Schlüssel zwischengespeichert.
function zeichneLeiste($: EngineInterface, e: any, daten: LeistenDaten, start: number) {
  const stand = { ...daten }
  const schluessel = JSON.stringify(stand)
  const treffer = letzteLeiste?.schluessel === schluessel
  const props = { ...e.props, surface: e.surface, spalten: e.viewport?.columns }
  protokoll($, 'render', `${treffer ? 'cache' : 'neu  '} ${messDauer(start)} auslöser=${unterschied(letzteProps, props)} ${e.surface}`)
  letzteProps = props
  if (treffer) return letzteLeiste?.element as ReturnType<typeof baueLeiste>
  const element = baueLeiste($.ui.resolve(e), {
    ...stand,
    oeffneAgenten: () => void schalteSavvyPane($),
    oeffneListe: () => void togglePane($, PANE, 'Arbeitsliste'),
  })
  letzteLeiste = { schluessel, element }
  return element
}

// Liest die Datei neu; der Zeitgeber startet beim ersten Aufruf (auch nach Hot-Reload).
async function aktualisiere($: EngineInterface): Promise<void> {
  const bis = await lieseAutonomBis($)
  if (!gleich(await read($, autonomBis), bis)) await update($, autonomBis, () => bis)
  const istRuhe = await lieseRuhe($)
  if ((await read($, ruhe)) !== istRuhe) await update($, ruhe, () => istRuhe)
  const istSpar = await lieseSpar($)
  if ((await read($, spar)) !== istSpar) await update($, spar, () => istSpar)
  let neu: Liste | null = null
  let neuVon: DanielTodo | null = null
  let fehler: string | undefined
  try {
    const text = (await $.fs.read(DATEI)) as string
    neu = zaehle(text)
    neuVon = zaehleVonDir(text)
    const nFaellig = teile(neuVon, new Date()).jetzt.filter(z => z.faellig).length
    if (!gleich(await read($, liste), neu)) await update($, liste, () => neu as Liste)
    if (!gleich(await read($, vonDir), neuVon)) await update($, vonDir, () => neuVon as DanielTodo)
    if ((await read($, faellig)) !== nFaellig) await update($, faellig, () => nFaellig)
    const neuLive = zaehleLive(text, new Date())
    if (!gleich(await read($, live), neuLive)) await update($, live, () => neuLive)
    const neuPipeline = zaehlePipeline(text)
    if (!gleich(await read($, pipeline), neuPipeline)) await update($, pipeline, () => neuPipeline)
    const neueTop = zaehleTopPrios(text)
    if (!gleich(await read($, topPrios), neueTop)) await update($, topPrios, () => neueTop)
    const neueRegeln = zaehleRegelmaessig(text)
    if (!gleich(await read($, regeln), neueRegeln)) await update($, regeln, () => neueRegeln)
    const min = Math.floor((await $.clock.now()) / 60_000)
    if (neueRegeln.some(r => r.cron) && (await read($, minute)) !== min) await update($, minute, () => min)
  } catch {
    fehler = 'stand.md nicht lesbar'
  }
  const n = neu && neuVon ? zuLang(neu, [...neuVon.jetzt, ...neuVon.spaeter]) : 0
  const status = fehler ?? (n ? `Arbeitsliste: ${n} Titel über ${KURZTITEL_MAX} Zeichen` : undefined)
  if (status !== letzterStatus) {
    letzterStatus = status
    $.ui.status(status)
  }
  await aktualisiereLeiste($, 'datei')
  timer ??= $.clock.every(30_000, () => void aktualisiere($))
  // Agentenzahl ändert sich außerhalb der Dateien: eigener Takt, zeichnet nur bei geänderter Zahl neu.
  leistenTimer ??= $.clock.every(3_000, () => void aktualisiereLeiste($, 'takt'))
}

// Zu oder hinter einem anderen Tab: nach vorn holen und Fokus anfragen (nur eine Anfrage, die
// Oberfläche darf ablehnen); vorn sichtbar: schließen.
async function togglePane($: EngineInterface, id: string, title: string): Promise<void> {
  const zuVorderst = (await $.ui.panes()).some(p => p.id === id && p.isShown)
  if (zuVorderst) await $.ui.close({ id })
  else await $.ui.open({ id, title, focus: true })
}

// Das Agents-Pane gehört savvy-progress; ein `$.ui.open` von hier legt ein eigenes, leeres Pane an (11.10.2026), und
// `$.command.run` schreibt Befehl und Antwort in den Chat (24.10.2026). Savvy hört auf diesen Zähler und schaltet selbst.
// Ändert sich danach nichts am Pane, hört savvy nicht (Hook fehlt): kurzer Hinweis statt stillem Nichts.
async function schalteSavvyPane($: EngineInterface): Promise<void> {
  const sichtbar = async () => (await $.ui.panes()).some(p => p.id === 'savvy-agents' && p.isShown)
  const vorher = await sichtbar()
  await update($, agentenKnopf, n => n + 1)
  if ((await sichtbar()) === vorher) $.ui.toast('Agents-Pane: savvy-progress reagiert nicht (Hook fehlt, einrichten.mjs --pruefen)')
}

// Eine Pane-Zeile: fester Präfix, daneben ein umbrechender Inhalt mit hängendem Einzug.
function zeile(Box: any, key: string, praefix: unknown, inhalt: unknown) {
  return (
    <Box key={key} flexDirection="row">
      <Box flexShrink={0}>{praefix}</Box>
      <Box flexGrow={1} flexShrink={1}>
        {inhalt}
      </Box>
    </Box>
  )
}

// Ein Knopf für alles, was im Pane gekürzt ist: „+ N weitere“ / „+ N Kleinigkeiten“, ein Klick klappt aus und ein.
// Die Kennung bleibt in beiden Zuständen gleich; nur das Label wechselt.
function mehrKnopf(Button: any, $: EngineInterface, id: string, s: Schnitt<unknown>, nomen = 'weitere') {
  if (!s.kuerzbar) return null
  const zu = nomen === 'weitere' ? '– weniger' : `– ${nomen} ausblenden`
  return (
    <Button
      key={`mehr:${id}`}
      plain
      dimColor
      label={`    ${s.offen ? zu : `+ ${s.versteckt} ${nomen}`}`}
      onPress={() => update($, aufgeklappt, a => schalte(a, id))}
    />
  )
}

// Groß: fett mit Akzent und ◆; normal: Standard; klein: gedimmt mit ·.
const symbol = (g: string, normal: string) => (g === 'gross' ? '◆' : g === 'klein' ? '·' : normal)
const farbe = (g: string) => (g === 'gross' ? AKZENT : undefined)

type PaneDaten = {
  l: Liste
  bis: string | null
  still: Ruhe
  sparen: boolean
  auf: number | null
  ausgeklappt: string[]
  jetztMs: number
  regelListe: ReturnType<typeof sortiereRegeln>
  liveListe: LiveEintrag[]
  pipeListe: PipelineEintrag[]
  von: ReturnType<typeof teile>
  agenten: Agent[]
  top: PrioEintrag[]
}

// Liest alle Atome des Panes; faellig und minute nur, damit der Render bei ihnen neu läuft.
async function lesePaneDaten($: EngineInterface): Promise<PaneDaten> {
  const l = await read($, liste)
  const bis = await read($, autonomBis)
  const still = await read($, ruhe)
  const sparen = await read($, spar)
  const auf = await read($, offen)
  await read($, faellig)
  await read($, minute)
  const ausgeklappt = await read($, aufgeklappt)
  const jetztMs = Date.now()
  const regelListe = sortiereRegeln(await read($, regeln), jetztMs)
  const liveListe = await read($, live)
  const pipeListe = await read($, pipeline)
  const von = teile(await read($, vonDir), new Date())
  const top = await read($, topPrios)
  return { l, bis, still, sparen, auf, ausgeklappt, jetztMs, regelListe, liveListe, pipeListe, von, agenten: agentenListe, top }
}

// Grundbausteine des Panes: Breite, Kürzen, Kürzungsschnitte, Titel, Punkt, Aufklapp-Zeilen.
function baueAnsicht($: EngineInterface, e: any, d: PaneDaten) {
  // Titelbreite: Pane minus Rand (2) minus Präfix „  x “ (Emoji zählen doppelt: 5).
  const breite = Math.max(16, (e.props.bodyColumns || 38) - 2 - 5)
  // Titel brechen um (Folgezeile unter dem Text); gekürzt wird erst jenseits von MAX_ZEILEN Zeilen, Wortumbruch kostet Reserve.
  // Desktop setzt Proportionalschrift: dort passen gut 1,6 Zeichen je Spalte (Screenshot 11.10.2026, zweite Zeile blieb halb leer).
  const zeichenJe = zeichenJeSpalte(e.surface)
  const gesamt = (b: number) => Math.floor(b * zeichenJe) * MAX_ZEILEN - 4
  const kt = (text: string) => kuerze(text, gesamt(breite))
  const { Box, Button, Link, Text } = $.ui.resolve(e)
  const schnitt = <T,>(liste: T[], id: string, max?: number) => schneide(liste, id, d.ausgeklappt, max)
  const mehr = (id: string, s: ReturnType<typeof schnitt>, nomen?: string) => mehrKnopf(Button, $, id, s, nomen)
  const titel = (z: Eintrag) => (
    <Text wrap="wrap" bold={z.groesse === 'gross'} color={farbe(z.groesse)} dimColor={z.groesse === 'klein'}>
      {kt(z.titel)}
    </Text>
  )
  // Jetzt: Farbe der Dringlichkeit statt Dimmen (auch bei [klein]); [groß] bleibt fett.
  const jetztTitel = (z: DanielEintrag) => (
    <Text wrap="wrap" bold={z.groesse === 'gross'} color={DRINGLICH_FARBE[z.dringlichkeit ?? 'heute']}>
      {kt(z.titel)}
    </Text>
  )
  // Der Punkt vor dem Titel klappt auf; der Titel selbst bricht um (ein Button-Label tut das nicht).
  const punkt = (key: string, zeichen: string, nr: number) => (
    <Button key={key} plain label={`  ${zeichen} `} onPress={() => update($, offen, o => (o === nr ? null : nr))} />
  )
  const stumm = (zeichen: string, farbe: string | undefined) => <Text color={farbe}>  {zeichen} </Text>
  const rest = (text: string, k = 0) => (
    <Text key={k} dimColor wrap="wrap">
      {'    '}
      {text}
    </Text>
  )
  // Bereichskopf mit Klapp-Schalter; `offen` entscheidet, ob der Körper gezeichnet wird.
  const istAuf = (id: string) => bereichOffen(id, d.ausgeklappt)
  const kopf = (id: string, titel: string, zahl?: number, gedimmt?: boolean) =>
    bereichsKopf($.ui.resolve(e), id, istAuf(id), () => void update($, aufgeklappt, a => schalte(a, bereichsKennung(id))), titel, zahl, gedimmt)
  return { Box, Button, Link, Text, breite, gesamt, kt, schnitt, mehr, titel, jetztTitel, punkt, stumm, rest, kopf, istAuf }
}

// Link-Zeile, Kopierknopf und aufgeklappte Details eines Eintrags.
function baueVerweise($: EngineInterface, a: ReturnType<typeof baueAnsicht>) {
  const { Box, Button, Link, Text, breite, gesamt, rest } = a
  // Link-Zeile als Buttons mit String-Label (Markdown zeigte in der CLI 2.1.283 den Rohtext, Link nimmt kein file:).
  // Der Explorer öffnet https im Standardbrowser, Dateien im zugehörigen Programm, Ordner im Explorer.
  const oeffne = async (href: string) => {
    const pfad = loeseZiel(href)?.pfad
    if (!pfad) return
    try {
      await $.process.run(['explorer.exe', pfad])
    } catch {
      $.ui.toast('Öffnen fehlgeschlagen: ' + pfad)
    }
  }
  // https: das Link-Element der Oberfläche (OSC 8), hier mit Themenfarbe und Unterstreichung; file: kann Link nicht,
  // dort bleibt ein schlichter Button (Button hat keine Farbe).
  const verweise = (z: Eintrag, key: string) =>
    z.links.length ? (
      <Box key={key} flexDirection="row" flexWrap="wrap">
        <Text>{'    '}</Text>
        {z.links.flatMap((v, k) => [
          // Trenner außerhalb der Unterstreichung, sonst laufen zwei Links optisch ineinander (Daniel, 10.10.2026).
          k > 0 ? <Text key={`${key}-t${k}`} dimColor>{' · '}</Text> : null,
          v.href.startsWith('https:') ? (
            <Text key={`${key}-${k}`} color={LINK_FARBE} underline>
              {'↗ '}
              <Link href={v.href} label={v.label} />
            </Text>
          ) : (
            <Button key={`${key}-${k}`} plain dimColor label={`↗ ${v.label}`} onPress={() => void oeffne(v.href)} />
          ),
        ])}
      </Box>
    ) : null
  // Markieren im Pane gelingt nicht verlässlich (Desktop: Knöpfe sind user-select:none); aufgeklappt gibt es das Kopieren per Knopf.
  const kopiere = async (text: string, surface: RenderSurface) => {
    const r = await $.ui.copy({ text, surface })
    $.ui.toast(r.isCopied ? 'Kopiert' : 'Kopieren fehlgeschlagen')
  }
  const kopierKnopf = (key: string, text: string) => (
    <Button key={key} plain dimColor label="    Text kopieren" onPress={(press: { surface: RenderSurface }) => void kopiere(text, press.surface)} />
  )
  const details = (z: Eintrag, key: string) => [
    ...[z.titel.length > gesamt(breite) ? z.titel : '', z.rest].filter(Boolean).map((text, k) => rest(text, k)),
    kopierKnopf(`kopie:${key}`, kopierText(z)),
  ]
  return { verweise, details, oeffne }
}

type Ansicht = ReturnType<typeof baueAnsicht> & ReturnType<typeof baueVerweise>

function paneAutonom(a: Ansicht, d: PaneDaten) {
  const { Text } = a
  return (
    <Text dimColor={!d.bis} color={d.bis ? 'success' : undefined}>
      {d.bis ? `● Autonomer Modus bis ${uhrzeit(d.bis)}` : '○ Autonomer Modus aus'}
    </Text>
  )
}

function paneRuhe(a: Ansicht, d: PaneDaten) {
  const { Text } = a
  if (!d.still) return null
  return <Text color="warning">{d.still === 'sanft' ? '🔇 Ruhemodus sanft: Laufende enden, dann höchstens 2 Agenten (Prüfer zählen nicht)' : '🔇 Ruhemodus hart: höchstens 2 Agenten (Prüfer zählen nicht)'}</Text>
}

function paneSpar(a: Ansicht, d: PaneDaten) {
  const { Text } = a
  if (!d.sparen) return null
  return <Text color="suggestion">● Sparmodus: nur Sonnet mittel und Haiku als Subagenten</Text>
}

function paneLive(a: Ansicht, d: PaneDaten) {
  const { Box, kopf, istAuf, titel, punkt, verweise, details, mehr, schnitt } = a
  if (!d.liveListe.length) return null
  const liveS = schnitt(d.liveListe, 'live')
  return (
    <Box flexDirection="column">
      {kopf('live', 'Neu und jetzt live testbar:')}
      {!istAuf('live') ? null : liveS.sichtbar.map((z, i) => (
        <Box flexDirection="column" key={`live-${i}`}>
          {zeile(Box, `live-z-${i}`, punkt(`live:${i}`, '✦', 400 + i), titel(z))}
          {verweise(z, 'v-live-' + i)}
          {d.auf === 400 + i ? details(z, `live:${i}`) : null}
        </Box>
      ))}
      {istAuf('live') ? mehr('live', liveS) : null}
    </Box>
  )
}

function paneJetzt(a: Ansicht, d: PaneDaten) {
  const { Box, Text, kopf, istAuf, jetztTitel, punkt, verweise, details, mehr, schnitt } = a
  const jetztS = schnitt(sortiereJetzt(d.von.jetzt), 'jetzt')
  return (
    <Box flexDirection="column">
      {kopf('jetzt', 'Jetzt', d.von.jetzt.length)}
      {istAuf('jetzt') && d.von.jetzt.length === 0 ? <Text dimColor>  nichts</Text> : null}
      {!istAuf('jetzt') ? null : jetztS.sichtbar.map((z, i) => (
        <Box flexDirection="column" key={`von-${i}`}>
          {zeile(Box, `von-z-${i}`, punkt(`von:${i}`, z.faellig ? '⏰' : DRINGLICH_ICON[z.dringlichkeit ?? 'heute'], 100 + i), jetztTitel(z))}
          {verweise(z, 'v-von-' + i)}
          {d.auf === 100 + i ? details(z, `von:${i}`) : null}
        </Box>
      ))}
      {istAuf('jetzt') ? mehr('jetzt', jetztS) : null}
    </Box>
  )
}

function paneSpaeter(a: Ansicht, d: PaneDaten) {
  const { Box, Text, kopf, istAuf, kt, punkt, verweise, details, mehr, schnitt } = a
  if (!d.von.spaeter.length) return null
  const spaetS = schnitt(d.von.spaeter, 'spaeter')
  return (
    <Box flexDirection="column">
      {kopf('spaeter', 'Später', d.von.spaeter.length, true)}
      {!istAuf('spaeter') ? null : spaetS.sichtbar.map((z: DanielEintrag, i) => (
        <Box flexDirection="column" key={`spaet-${i}`}>
          {zeile(Box, `spaet-z-${i}`, punkt(`spaet:${i}`, ICON[z.icon ?? ''] ?? '○', 200 + i), <Text dimColor wrap="wrap">{kt(z.titel)}</Text>)}
          {verweise(z, 'v-spaet-' + i)}
          {d.auf === 200 + i ? details(z, `spaet:${i}`) : null}
        </Box>
      ))}
      {istAuf('spaeter') ? mehr('spaeter', spaetS) : null}
    </Box>
  )
}

function paneAgenten($: EngineInterface, a: Ansicht, d: PaneDaten) {
  const { Box, Button, Text, kopf, istAuf, breite, gesamt, stumm, mehr, schnitt } = a
  if (!d.agenten.length) return null
  const agentS = schnitt(d.agenten, 'agenten')
  return (
    <Box flexDirection="column">
      {kopf('agenten', agentenText(d.agenten.filter(x => !istPruefer(x)).length, d.agenten.filter(istPruefer).length).replace('Agents', 'Agenten'))}
      {istAuf('agenten') ? <Button key="agenten" plain dimColor label="    Agents öffnen" onPress={() => void schalteSavvyPane($)} /> : null}
      {!istAuf('agenten') ? null : agentS.sichtbar.map((x, i) =>
        zeile(
          Box,
          `agent-${i}`,
          stumm('●', AKZENT),
          <Text wrap="wrap">
            {kuerze(x.description, gesamt(breite) - (x.stepTotal ? 6 : 0))}
            {x.stepTotal ? <Text dimColor>  {x.stepDone ?? 0}/{x.stepTotal}</Text> : null}
          </Text>,
        ),
      )}
      {istAuf('agenten') ? mehr('agenten', agentS) : null}
    </Box>
  )
}

function paneInArbeit(a: Ansicht, d: PaneDaten) {
  const { Box, Text, kopf, istAuf, titel, punkt, verweise, details, mehr, schnitt } = a
  const arbeit = sortiere(d.l.inArbeit)
  const arbeitS = schnitt(arbeit.filter(z => z.groesse !== 'klein'), 'arbeit')
  const kleinS = schnitt(arbeit.filter(z => z.groesse === 'klein'), 'klein', 0)
  // Die Nummer ist die Stelle in der sortierten Liste, damit sie beim Kürzen und Aufklappen stehen bleibt.
  const arbeitZeile = (z: Eintrag) => {
    const i = arbeit.indexOf(z)
    return (
      <Box flexDirection="column" key={`now-${i}`}>
        {zeile(Box, `now-z-${i}`, punkt(`now:${i}`, symbol(z.groesse, '●'), i), titel(z))}
        {verweise(z, 'v-now-' + i)}
        {d.auf === i ? details(z, `now:${i}`) : null}
      </Box>
    )
  }
  return (
    <Box flexDirection="column">
      {kopf('arbeit', 'In Arbeit', d.l.inArbeit.length)}
      {istAuf('arbeit') && d.l.inArbeit.length === 0 ? <Text dimColor>  nichts</Text> : null}
      {istAuf('arbeit') ? arbeitS.sichtbar.map(arbeitZeile) : null}
      {istAuf('arbeit') ? mehr('arbeit', arbeitS) : null}
      {istAuf('arbeit') ? kleinS.sichtbar.map(arbeitZeile) : null}
      {istAuf('arbeit') ? mehr('klein', kleinS, 'Kleinigkeiten') : null}
    </Box>
  )
}

function paneNaechstes(a: Ansicht, d: PaneDaten) {
  const { Box, Text, kopf, istAuf, kt, stumm, verweise, mehr, schnitt } = a
  const later = schnitt(sortiere(d.l.todo), 'todo')
  return (
    <Box flexDirection="column">
      {kopf('todo', 'Als Nächstes', d.l.todo.length, true)}
      {istAuf('todo') && d.l.todo.length === 0 ? <Text dimColor>  nichts</Text> : null}
      {!istAuf('todo') ? null : later.sichtbar.map((z, i) => (
        <Box flexDirection="column" key={`later-${i}`}>
          {zeile(Box, `later-z-${i}`, stumm(symbol(z.groesse, '○'), farbe(z.groesse)), <Text dimColor={z.groesse !== 'gross'} bold={z.groesse === 'gross'} wrap="wrap">{kt(z.titel)}</Text>)}
          {verweise(z, 'v-later-' + i)}
        </Box>
      ))}
      {istAuf('todo') ? mehr('todo', later) : null}
    </Box>
  )
}

function panePipeline(a: Ansicht, d: PaneDaten) {
  const { Box, Text, kopf, istAuf, kt, punkt, verweise, details, mehr, schnitt } = a
  if (!d.pipeListe.length) return null
  const pipeS = schnitt(d.pipeListe, 'pipe')
  return (
    <Box flexDirection="column">
      {kopf('pipe', 'In Pipeline', d.pipeListe.length, true)}
      {!istAuf('pipe') ? null : pipeS.sichtbar.map((z, i) => (
        <Box flexDirection="column" key={`pipe-${i}`}>
          {zeile(
            Box,
            `pipe-z-${i}`,
            punkt(`pipe:${i}`, '⇢', 500 + i),
            <Text wrap="wrap">
              <Text bold color={ORT_FARBE[z.ort]}>
                {z.ort}{' '}
              </Text>
              {kt(z.titel)}
            </Text>,
          )}
          {verweise(z, 'v-pipe-' + i)}
          {d.auf === 500 + i ? details(z, `pipe:${i}`) : null}
        </Box>
      ))}
      {istAuf('pipe') ? mehr('pipe', pipeS) : null}
    </Box>
  )
}

function paneRegeln($: EngineInterface, a: Ansicht, d: PaneDaten) {
  const { Box, Button, Text, kopf, istAuf, breite, gesamt, rest, mehr, schnitt } = a
  if (!d.regelListe.length) return null
  const regelSchnitt = schnitt(d.regelListe, 'regeln')
  return (
    <Box flexDirection="column">
      {kopf('regeln', 'Regelmäßig', d.regelListe.length, true)}
      {!istAuf('regeln') ? null : regelSchnitt.sichtbar.map(({ r, ms, datei }, i) => {
        const min = ms === null ? null : abstandMin(ms, d.jetztMs)
        const chip = ms === null ? '—' : inKurz(ms, d.jetztMs)
        const dringend = min !== null && min <= DRINGEND_MIN
        const nr = 300 + datei
        const klein = kuerze(r.titel, gesamt(breite - CHIP + 1))
        return (
          <Box flexDirection="column" key={`regel-${datei}`}>
            <Box flexDirection="row">
              <Text bold={dringend} color={dringend ? 'warning' : undefined} dimColor={min === null || min > BALD_MIN}>
                {chip.padStart(CHIP)}
              </Text>
              <Button key={`regel:${datei}`} plain label={d.auf === nr ? ' ▾ ' : ' ▸ '} onPress={() => update($, offen, o => (o === nr ? null : nr))} />
              <Box flexGrow={1} flexShrink={1}>
                <Text dimColor={i > 0} wrap="wrap">
                  {klein}
                </Text>
              </Box>
            </Box>
            {d.auf === nr
              ? [r.titel.length > gesamt(breite - CHIP + 1) ? r.titel : '', detailZeile(r, ms, d.jetztMs), r.rest]
                  .filter(Boolean)
                  .map((text, k) => rest(text, k))
              : null}
          </Box>
        )
      })}
      {istAuf('regeln') ? mehr('regeln', regelSchnitt) : null}
      {istAuf('regeln') ? <Text dimColor>  Cron UTC · Wecker feuert zur Stunde ±min</Text> : null}
    </Box>
  )
}

// Breite und Klappzustand für den Top-Prios-Kasten.
function prioUmfeld($: EngineInterface, e: any, d: PaneDaten, oeffne: (href: string) => Promise<void>): PrioUmfeld {
  return {
    zeichenJeZeile: prioZeichenJeZeile(e.props.bodyColumns, e.surface),
    offen: kennung => d.ausgeklappt.includes(kennung),
    schalte: kennung => void update($, aufgeklappt, a => schalte(a, kennung)),
    oeffne: href => void oeffne(href),
  }
}

// Pane: Statuszeile, dann Abschnitte mit je einer umbrechenden Zeile pro Eintrag.
async function zeichnePane($: EngineInterface, e: any) {
  protokoll($, 'pane', `render ${e.surface} spalten=${e.props.bodyColumns}`)
  const d = await lesePaneDaten($)
  const ansicht = baueAnsicht($, e, d)
  const a: Ansicht = { ...ansicht, ...baueVerweise($, ansicht) }
  const { Box } = a
  return (
    <Box flexDirection="column" gap={1} paddingX={1}>
      {topPriosKasten($.ui.resolve(e), d.top, prioUmfeld($, e, d, a.oeffne))}
      {paneAutonom(a, d)}
      {paneRuhe(a, d)}
      {paneSpar(a, d)}
      {paneLive(a, d)}
      {paneJetzt(a, d)}
      {paneSpaeter(a, d)}
      {paneAgenten($, a, d)}
      {paneInArbeit(a, d)}
      {paneNaechstes(a, d)}
      {panePipeline(a, d)}
      {paneRegeln($, a, d)}
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await aktualisiere($)
    return next(e)
  })
  on('prompt.submit', async ($, e, next) => {
    void aktualisiere($)
    return next(e)
  }).catch(($, e, next) => next(e))
  on('turn.complete', async ($, e, next) => {
    void aktualisiere($)
    return next(e)
  })

  // Leiste (Daniel, 10.10.2026): zwei Knöpfe und zwei Bälle in einer Zeile. Die Savvy-Leiste (Balken,
  // Prozent, Avatar) entfällt, weil hier next(e) nicht aufgerufen wird; Fehler fallen auf sie zurück.
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const start = messStart(messungAn)
    if (leistenDaten) return zeichneLeiste($, e, leistenDaten, start)
    // Erster Aufruf vor dem ersten Hintergrundlauf (Neustart des Moduls): einmal nachladen.
    return ermittleLeiste($).then(d => {
      leistenDaten ??= d
      return zeichneLeiste($, e, leistenDaten, start)
    })
  }).catch(($, e, next) => {
    protokoll($, 'FEHLER', String((next.error as { message?: string })?.message ?? next.error))
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, ($, e) => zeichnePane($, e))
}
