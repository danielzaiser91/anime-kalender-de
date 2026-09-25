/**
 * **Crunchyrolls Wochenprogramm lesen — die einzige Quelle für kommende Synchro-Folgen.**
 *
 * Gemessen am 25.09.2026: Der Simulcast-Kalender, den `scrape-crunchyroll.ts` liest, führt
 * künftige Synchro-Folgen nicht (Fenster 14.09.–04.10., letzter Synchro-Slot 25.09.). Das
 * Wochenprogramm tut es: „Hana-Kimi Staffel 2, 🇩🇪 Folge 10-12, 18:00 Uhr*, *erscheint am
 * 2. Oktober". Daniel wählte diese Aufgabe am 25.09.2026 als erste aus der Quellenprüfung.
 *
 * **Warum ein Browser:** Die Seite liegt hinter Cloudflares Prüfschritt; `curl` bekam 14 KB
 * ohne Artikel. Der Text steht im gerenderten DOM (Storyblok, serverseitig), einen JSON-Abruf
 * gibt es nicht (Netzwerkverkehr gelesen). robots.txt sperrt `/news` nicht.
 *
 * **Aufbau, gemessen:** Wochentags-Überschriften („Montag" … „Sonntag", dann „Katalogtitel")
 * in Dokumentreihenfolge; je Eintrag ein `<h3>` mit Serienlink (`/series/<Kennung>/…`), darunter
 * je Fassung ein `<p>` mit Flaggenbild — `deutschland-flagge.png` ist die Synchro,
 * `japan-flag.png` Japanisch mit Untertiteln — und „Folge N" oder „Folge N-M", „HH:MM Uhr",
 * gelegentlich „*erscheint am <Tag>. <Monat>". Die `Column-N`-Kennungen taugen nicht als
 * Wochentag (`Column-1` kommt doppelt vor, die Katalogtitel stehen in `Column-15`).
 *
 * **Was dieser Lauf nicht tut:** zuordnen oder bauen. Er schreibt `data/crunchyroll-woche.json`;
 * die Zuordnung über die Serienkennung macht der Bau (PoC: `tools/crunchyroll-woche-poc.mjs`).
 *
 * Aufruf: npx tsx pipeline/scrape-crunchyroll-woche.ts [--adresse <Artikel>] [--head]
 */
import { chromium } from 'playwright'
import { log, writeJson } from './lib/util.ts'

const args = process.argv.slice(2)
const HEADED = args.includes('--head')
const UEBERSICHT = 'https://www.crunchyroll.com/de/news/seasonal-lineup'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'

export interface WochenEintrag {
  /** Crunchyroll-Serienkennung aus dem Link — der Schlüssel für die Zuordnung. */
  seriesId: string | null
  /** Titel, wie der Artikel ihn schreibt („Hana-Kimi Staffel 2"). */
  titel: string
  /** `de` (Synchro), `ja` (Untertitel), sonst die Flaggendatei. */
  sprache: string
  /** Erste und letzte Folge der Zeile. */
  von: number
  bis: number
  /** ISO-Tag: aus dem Wochentag, oder aus „*erscheint am …", wenn die Zeile es nennt. */
  datum: string
  /** „HH:MM" (Berlin). */
  zeit: string | null
  /** true, wenn das Datum aus „*erscheint am …" stammt. */
  abweichend: boolean
}

export interface WochenProgramm {
  geholtAm: string
  artikel: string
  ueberschrift: string
  /** Montag der Woche, ISO. */
  wocheAb: string
  eintraege: WochenEintrag[]
}

const MONATE: Record<string, number> = {
  januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6, juli: 7,
  august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
}
const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

const iso = (j: number, m: number, t: number) => `${j}-${String(m).padStart(2, '0')}-${String(t).padStart(2, '0')}`
function plusTage(isoTag: string, n: number): string {
  const d = new Date(`${isoTag}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** „Crunchyrolls aktuelles Wochenprogramm vom 21. bis 27. September" (+ Jahr) → Montag als ISO. */
export function wocheAus(ueberschrift: string, jahr: number): string | null {
  const m = /vom\s+(\d{1,2})\.\s*(?:([A-Za-zäöü]+)\s+)?bis\s+(\d{1,2})\.\s*([A-Za-zäöü]+)/i.exec(ueberschrift)
  if (!m) return null
  const monatBis = MONATE[m[4].toLowerCase()]
  const monatVon = m[2] ? MONATE[m[2].toLowerCase()] : monatBis
  if (!monatVon || !monatBis) return null
  /* Eine Woche über den Jahreswechsel („vom 29. Dezember bis 4. Januar") beginnt im Vorjahr. */
  return iso(monatVon === 12 && monatBis === 1 ? jahr - 1 : jahr, monatVon, Number(m[1]))
}

/** „*erscheint am 2. Oktober" → ISO, im Jahr der Woche; ein Januar nach einer Dezemberwoche zählt ins Folgejahr. */
export function abweichendesDatum(text: string, wocheAb: string): string | null {
  const m = /erscheint am\s+(\d{1,2})\.\s*([A-Za-zäöü]+)/i.exec(text)
  if (!m) return null
  const monat = MONATE[m[2].toLowerCase()]
  if (!monat) return null
  const jahr = Number(wocheAb.slice(0, 4))
  const wochenMonat = Number(wocheAb.slice(5, 7))
  return iso(wochenMonat === 12 && monat < 6 ? jahr + 1 : jahr, monat, Number(m[1]))
}

/** Eine Zeile „Folge 10-12 / 18:00 Uhr* / *erscheint am 2. Oktober" zerlegen. */
export function zeileLesen(text: string): { von: number; bis: number; zeit: string | null } | null {
  const f = /Folge\s+(\d+)(?:\s*[-–]\s*(\d+))?/i.exec(text)
  if (!f) return null
  const z = /(\d{1,2}):(\d{2})\s*Uhr/i.exec(text)
  return { von: Number(f[1]), bis: Number(f[2] ?? f[1]), zeit: z ? `${z[1].padStart(2, '0')}:${z[2]}` : null }
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: !HEADED })
  try {
    const seite = await browser.newPage({ userAgent: UA, locale: 'de-DE' })
    /*
      `tsx` (esbuild, keepNames) setzt in benannte Funktionen einen Helfer `__name` ein — im
      Browser gibt es ihn nicht, und `page.evaluate` warf „__name is not defined" (25.09.2026).
    */
    await seite.addInitScript('window.__name = (f) => f')
    let artikel = args[args.indexOf('--adresse') + 1]
    if (!args.includes('--adresse')) {
      /* Den aktuellen Artikel über die Kategorie finden — seine Adresse ändert sich je Season. */
      await seite.goto(UEBERSICHT, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await seite.waitForTimeout(3000)
      const links = await seite.$$eval('a[href*="wochenprogramm"]', (as) => as.map((a) => (a as HTMLAnchorElement).href))
      artikel = links.sort().at(-1) ?? ''
      if (!artikel) throw new Error('Kein Wochenprogramm-Artikel in der Kategorie gefunden')
    }
    log(`Wochenprogramm: ${artikel}`)
    await seite.goto(artikel, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await seite.waitForSelector('h3 a[href*="/series/"]', { timeout: 30_000 })

    const roh = await seite.evaluate((tage) => {
      const text = (e: Element | null) => (e?.textContent ?? '').replace(/Opens in a new tab/g, '').trim()
      const h1 = document.querySelector('h1')
      const aktualisiert = /Aktualisiert:\s*\d{1,2}\.\s*\S+\s*(\d{4})/.exec(document.body.innerText)?.[1] ?? null
      const eintraege: { tag: string | null; seriesUrl: string | null; titel: string; zeilen: { flagge: string; text: string }[] }[] = []
      let tag: string | null = null
      const alle = document.querySelectorAll('body *')
      for (const el of alle) {
        const t = el.childElementCount === 0 ? text(el) : ''
        if (t && (tage.includes(t) || t === 'Katalogtitel')) {
          tag = t
          continue
        }
        if (el.tagName !== 'H3' || !tag) continue
        const link = el.querySelector('a[href*="/series/"]') as HTMLAnchorElement | null
        const zeilen = [...(el.parentElement?.querySelectorAll('p') ?? [])]
          .map((p) => ({ img: p.querySelector('img') as HTMLImageElement | null, p }))
          .filter(({ img }) => img && /flag|flagge|drapeau/i.test(img.src + img.alt))
          .map(({ img, p }) => ({ flagge: (img as HTMLImageElement).src, text: (p as HTMLElement).innerText }))
        eintraege.push({ tag, seriesUrl: link?.href ?? null, titel: text(el), zeilen })
      }
      return { ueberschrift: text(h1), jahr: aktualisiert, eintraege }
    }, TAGE)

    const jahr = Number(roh.jahr) || new Date().getUTCFullYear()
    const wocheAb = wocheAus(roh.ueberschrift, jahr)
    if (!wocheAb) throw new Error(`Woche nicht lesbar aus „${roh.ueberschrift}"`)
    const eintraege: WochenEintrag[] = []
    for (const e of roh.eintraege) {
      if (!e.tag || e.tag === 'Katalogtitel') continue
      const tagDatum = plusTage(wocheAb, TAGE.indexOf(e.tag))
      for (const z of e.zeilen) {
        const gelesen = zeileLesen(z.text)
        if (!gelesen) continue
        const anders = abweichendesDatum(z.text, wocheAb)
        eintraege.push({
          seriesId: /\/series\/([A-Z0-9]+)/.exec(e.seriesUrl ?? '')?.[1] ?? null,
          titel: e.titel,
          sprache: /deutschland/i.test(z.flagge) ? 'de' : /japan/i.test(z.flagge) ? 'ja' : (z.flagge.split('/').at(-3) ?? '?'),
          ...gelesen,
          datum: anders ?? tagDatum,
          abweichend: Boolean(anders),
        })
      }
    }
    const programm: WochenProgramm = { geholtAm: new Date().toISOString(), artikel, ueberschrift: roh.ueberschrift, wocheAb, eintraege }
    writeJson('data/crunchyroll-woche.json', programm)
    const de = eintraege.filter((e) => e.sprache === 'de')
    log(`${roh.ueberschrift}: ${eintraege.length} Zeilen, davon ${de.length} Synchro (${de.filter((e) => e.abweichend).length} mit eigenem Datum)`)
  } finally {
    await browser.close()
  }
}

if (process.argv[1]?.endsWith('scrape-crunchyroll-woche.ts')) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
