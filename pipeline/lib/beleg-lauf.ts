/**
 * **Der Lauf der Beleg-Lesung** (aus `pipeline/belege-lesen.ts` ausgelagert, damit Schlange, Lesen, Speichern und Wächter mit Attrappen laufen können):
 * Adressen lesen, Bild und Text ablegen, Lesung merken, Störungen und Fehlschläge führen.
 */
import type { Page } from 'playwright'
import { log, warn } from './util.ts'
import {
  braucheBild, ohneMarkenJeTitel, crunchyrollDatum, entzieheBild, kopfzeilenDatum, isoTag, merkeLesung, textHash, traegtArtikeldatum, warteschlange, type BelegGedaechtnis, type Lesung,
} from './beleg-lesung.ts'
import { ablegen } from './beleg-ablage.ts'
import { neueStoerungen, ohneRuhende, seiteninfo } from './beleg-stoerung.ts'
import { merkeFehlschlag, vergissFehlschlag, type Fehlschlaege } from './beleg-fehlschlag.ts'
import { BILD_FASSUNG, belegAusschnitt } from './beleg-bild.ts'
import { markenLuecken, meldeMarkenLuecken } from './beleg-marken.ts'
import type { Gruppe } from './beleg-suche.ts'

const STOERUNGEN_BIS_ABBRUCH = 3
/** Unter so vielen Zeichen ist es kein Artikel, sondern eine Hülle oder Fehlerseite. */
const MINDESTTEXT = 400

export interface Gelesen {
  text: string
  veroeffentlicht?: string
  aktualisiert?: string
}

/** Nachladende Seiten (Kommentare, Newsticker) ändern den Text noch nach dem Laden — gelesen wird erst, wenn die Länge eine Sekunde lang gleich bleibt, sonst schwankt der Hash (05.10.2026). */
async function textStehtStill(seite: Page, waehler: string[]): Promise<void> {
  const laenge = () => seite.evaluate((w) => Math.max(...w.map((x) => (document.querySelector(x) as HTMLElement | null)?.innerText?.length ?? 0)), waehler)
  let vorher = await laenge()
  for (let i = 0; i < 6; i++) {
    await seite.waitForTimeout(1000)
    const jetzt = await laenge()
    if (jetzt === vorher) return
    vorher = jetzt
  }
}

export async function lies(seite: Page, url: string): Promise<Gelesen> {
  await seite.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  /* Der Text steht in `<article>` (Crunchyroll-News, Anime2You) oder in `<main>` (aniSearch; ADN hat ein leeres `<article>`); Joyn, Disney+ und Kinoheld sind Anwendungsseiten ohne beides, dort zählt die ganze Seite. */
  const ganzeSeite = /\/\/(?:www\.)?(?:joyn\.de|disneyplus\.com|kinoheld\.de)\//.test(url)
  const waehler = ganzeSeite ? ['body'] : ['article', 'main']
  await seite
    .waitForFunction(({ n, w }) => Math.max(...w.map((s) => (document.querySelector(s) as HTMLElement | null)?.innerText?.length ?? 0)) > n, { n: MINDESTTEXT, w: waehler }, { timeout: 20_000 })
    .catch(() => undefined)
  /* Anwendungsseiten laden Folgenkarten und Bilder nach; ohne Pause zeigt das Foto schwarze Platzhalter (Joyn, 05.10.2026). */
  if (ganzeSeite) await seite.waitForTimeout(5000)
  await textStehtStill(seite, waehler)
  return seite.evaluate((w) => {
    const meta = (p: string) => document.querySelector(`meta[property="${p}"]`)?.getAttribute('content') ?? undefined
    const body = document.body.innerText
    const texte = w.map((s) => (document.querySelector(s) as HTMLElement | null)?.innerText ?? '')
    return {
      text: texte.sort((a, b) => b.length - a.length)[0]!,
      veroeffentlicht: meta('article:published_time') ?? /Veröffentlicht:\s*([^\n]+)/.exec(body)?.[1],
      aktualisiert: meta('article:modified_time') ?? /Aktualisiert:\s*([^\n]+)/.exec(body)?.[1],
    }
  }, waehler)
}

/** Alles, was die Lesung einer Adresse aus dem Lauf braucht. */
export interface Lesekontext {
  gedaechtnis: BelegGedaechtnis
  heute: string
  suchbegriffe: Map<string, string[]>
  gruppen: Map<string, Gruppe[]>
  tage: Map<string, string[]>
}

/** Liest eine Adresse, legt Bild und Text ab und merkt die Lesung; wirft bei jeder Störung. Gibt zurück, ob ein neuer Stand entstand. */
export async function leseUndMerke(seite: Page, url: string, k: Lesekontext, leser: Leser = ECHT): Promise<boolean> {
  const { gedaechtnis, heute, suchbegriffe, gruppen, tage } = k
  const g = await leser.lies(seite, url)
  if (g.text.length < MINDESTTEXT) throw new Error(`kein Artikeltext (${g.text.length} Zeichen, ${await leser.info(seite)})`)
  const hash = textHash(g.text)
  const mitDatum = traegtArtikeldatum(url)
  const lesung: Lesung = {
    am: heute,
    hash,
    hf: 2,
    veroeffentlicht: mitDatum ? (isoTag(g.veroeffentlicht) ?? crunchyrollDatum(g.veroeffentlicht)) : undefined,
    aktualisiert: mitDatum ? (isoTag(g.aktualisiert) ?? crunchyrollDatum(g.aktualisiert)) : undefined,
    /* Eine Produktseite nennt den Erscheinungstag der Ausgabe — eine andere Aussage als ein Veröffentlichungsdatum. */
    ausgabe: mitDatum ? undefined : (isoTag(g.veroeffentlicht) ?? crunchyrollDatum(g.veroeffentlicht)),
  }
  /* Eine als Wand entzogene Lesung zeigt nur die Wand — sie zählt weder als Vergleich noch bleibt sie neben der neuen stehen. */
  /* Das Datum in der Kopfzeile muss zu den Seitendaten passen — sonst stimmt eines von beiden nicht. */
  const kopf = mitDatum ? kopfzeilenDatum(g.text) : undefined
  if (kopf && lesung.veroeffentlicht && kopf !== lesung.veroeffentlicht && kopf !== lesung.aktualisiert) {
    lesung.datumsabweichung = kopf
    warn(`Beleg ${url}: Kopfzeile nennt ${kopf}, Seitendaten ${lesung.veroeffentlicht} — untersuchen`)
  }
  /* Nur eine Lesung mit Wand-Prüfung (`qs: ok`) taugt zum Vergleich: Altbestand wurde mit anderem Text gehasht, eine Wand zeigt nur die Wand. Beide werden ersetzt, nicht ergänzt. */
  const letzte = gedaechtnis[url]?.lesungen.filter((l) => l.qs === 'ok').at(-1)
  /* Ein neuer Text bei gleichen Daten darf nicht vorkommen: Er heißt, dass Unwesentliches den Hash ändert (Daniel, 03.10.2026). */
  if (letzte && letzte.hf === 2 && letzte.hash !== hash && letzte.veroeffentlicht === lesung.veroeffentlicht && letzte.aktualisiert === lesung.aktualisiert && letzte.ausgabe === lesung.ausgabe) {
    lesung.aenderungOhneDatum = true
    warn(`Beleg ${url}: Text geändert, Daten gleich — untersuchen (tools/belege-pruefen.mjs)`)
  }
  /* Derselbe Text hat dasselbe Bild — eine Lesung mit neuem Datum verweist darauf, statt es neu zu erzeugen. */
  if (letzte?.hash === hash) Object.assign(lesung, { bild: letzte.bild, text: letzte.text, html: letzte.html, markierung: letzte.markierung, markierungen: letzte.markierungen, bildfassung: letzte.bildfassung })
  if (letzte?.hash === hash) lesung.ohneMarke = letzte.ohneMarke
  /* Ein neuer Stand bekommt sein Bild; fehlt es einem alten (Ablage war nicht erreichbar), wird es nachgeholt. */
  const ziel = letzte?.hash === hash ? letzte : lesung
  /* Auch ein Bild ohne Fundstelle wird neu gemacht (04.10.2026): Ältere Belege bekommen so ihre Markierung. */
  if (braucheBild(ziel, suchbegriffe.get(url) ?? [], gruppen.get(url) ?? [])) {
    const basis = `${new URL(url).hostname}/${textHash(url)}/${ziel.am}-${hash}`
    const beleg = await leser.bild(seite, suchbegriffe.get(url) ?? [], tage.get(url) ?? [], gruppen.get(url) ?? [])
    if (beleg === 'wand') {
      entzieheBild(gedaechtnis, url)
      throw new Error('Zustimmungswand bleibt im Bild — kein Beleg')
    }
    if (beleg === 'leer') throw new Error(`Aufnahme einfarbig — kein Beleg (${await leser.info(seite)})`)
    if (beleg) {
      ziel.qs = 'ok'; ziel.bildfassung = BILD_FASSUNG
      if (beleg.markierung) ziel.markierung = lesung.markierung = beleg.markierung
      if (beleg.markierungen) ziel.markierungen = lesung.markierungen = beleg.markierungen
      if (beleg.ohneMarke) ziel.ohneMarke = lesung.ohneMarke = beleg.ohneMarke
      ziel.bild = await leser.ablegen(`${basis}.webp`, beleg.bild, 'image/webp')
      ziel.text = await leser.ablegen(`${basis}.txt.gz`, beleg.text, 'application/gzip')
    }
    /* Ohne Ausschnitt (keine Überschrift auf der Seite) bleibt die Lücke: ein Fehlschlag mit Pause, kein gelesener Beleg — sonst wäre der Lauf täglich rot. Eine Lücke trotz Ausschnitt ist ein Fehler im Lesen: sie fängt der Wächter am Lauf-Ende. */
    if (!beleg && markenLuecken(ziel, gruppen.get(url) ?? []).length > 0) throw new Error(`kein Ausschnitt — Marken je Titel fehlen (${await leser.info(seite)})`)
  }
  if (gedaechtnis[url]) gedaechtnis[url]!.lesungen = gedaechtnis[url]!.lesungen.filter((l) => l.qs === 'ok')
  return merkeLesung(gedaechtnis, url, lesung)
}

/** Was der Lauf von außen braucht — im Test durch Attrappen ersetzt. */
export interface Leser {
  lies: (seite: Page, url: string) => Promise<Gelesen>
  bild: typeof belegAusschnitt
  ablegen: typeof ablegen
  info: (seite: Page) => Promise<string>
}

export const ECHT: Leser = { lies, bild: belegAusschnitt, ablegen, info: seiteninfo }

/** Die Eingaben eines Laufs: Gedächtnis, Adressen aus Terminen und Meldungen, Zuordnung der Titel und Fehlschläge. */
export interface Lauf extends Lesekontext {
  adressen: string[]
  fehlschlaege: Fehlschlaege
  limit: number
  abstand: number
}

/** Browser und Ausgabe des Laufs: zwei Seiten (Crunchyroll mit Desktop-UA, die übrigen), Schließen, Speichern. */
export interface Umgebung {
  oeffne: () => Promise<{ cr: Page; andere: Page; schliessen: () => Promise<void> }>
  speichern: (gelesen: number) => void
  leser?: Leser
}

/** Die Schlange abarbeiten: je Adresse lesen, Störungen und Fehlschläge führen, am Ende speichern. */
export async function fuehreLaufAus(l: Lauf, u: Umgebung): Promise<void> {
  const { gedaechtnis, heute, gruppen, fehlschlaege } = l
  const sofort = ohneMarkenJeTitel(gedaechtnis, gruppen)
  /* Ohne Obergrenze: Sie zählt erst beim Abruf (`ohneRuhende`), damit ruhende Anbieter keine Plätze belegen. */
  const schlange = warteschlange([...l.adressen, ...sofort], gedaechtnis, heute, l.abstand, Infinity, sofort, fehlschlaege)
  log(`Belege: ${schlange.length} Artikel fällig`)
  const kontext = { gedaechtnis, heute, suchbegriffe: l.suchbegriffe, gruppen, tage: l.tage }
  const browser = await u.oeffne()
  let gelesen = 0
  let neu = 0
  const gelesenAdressen: string[] = []
  const stoerungen = neueStoerungen(STOERUNGEN_BIS_ABBRUCH)
  try {
    for (const url of ohneRuhende(schlange, l.limit, stoerungen)) {
      try {
        const seite = url.includes('crunchyroll.com') ? browser.cr : browser.andere
        if (await leseUndMerke(seite, url, kontext, u.leser)) neu++
        gelesen++
        gelesenAdressen.push(url)
        stoerungen.erfolg(url)
        vergissFehlschlag(fehlschlaege, url)
      } catch (e) {
        warn(`Beleg nicht gelesen: ${url} — ${(e as Error).message}`)
        stoerungen.fehl(url)
        merkeFehlschlag(fehlschlaege, url, heute)
      }
    }
  } finally {
    await browser.schliessen()
  }
  u.speichern(gelesen)
  log(`Belege: ${gelesen} gelesen, ${neu} mit neuem Stand, ${Object.keys(gedaechtnis).length} im Gedächtnis`)
  meldeMarkenLuecken(gedaechtnis, gruppen, gelesenAdressen)
}
