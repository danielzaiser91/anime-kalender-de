/**
 * **Messbelege: ein Bild des Anbieter-Kalenders an dem Tag, an dem wir etwas gemessen haben**
 * (docs/wissen/news-plan.md, Schritt 5).
 *
 * „Nicht erschienen" und „verspätet erschienen" sind unsere eigene Beobachtung. Der Link in der
 * Meldung führt auf Crunchyrolls Kalender dieses Tages — der zeigt aber den heutigen Stand. Was wir
 * beim Messen gesehen haben, hält dieser Lauf fest: je Vermerk ein Bild und das HTML der Seite in
 * der privaten Ablage des Workers (`/beleg`), einmal beim Bemerken, einmal beim Nachreichen.
 *
 * Läuft stündlich direkt hinter `termine-pruefen.ts`; fehlt nichts, öffnet er keinen Browser.
 * Ohne Ablage (kein Token, Worker nicht erreichbar) wird nichts vermerkt — der nächste Lauf
 * versucht es wieder. Nur Vermerke der letzten 14 Tage: Danach zeigt die Seite einen anderen Stand.
 *
 * Aufruf: npx tsx pipeline/messbelege.ts
 */
import { gzipSync } from 'node:zlib'
import { chromium } from 'playwright'
import { log, readJson, warn, writeJson } from './lib/util.ts'
import { ablegen } from './lib/beleg-ablage.ts'
import { recordSource } from './lib/health.ts'
import { kalenderTag } from './lib/news-verspaetung.ts'
import { todayIso } from '../shared/time.ts'
import { offeneMessbelege } from './lib/ausgeblieben.ts'
import type { Messbeleg, VerpassterTermin } from './termine-pruefen.ts'

const DATEI = 'data/termine-verpasst.json'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
/** Mehr fällt an einem Tag kaum an; die Grenze schützt vor einem Lauf, der alles auf einmal nachholt. */
const HOECHSTENS = 6

async function main(): Promise<void> {
  if (!process.env.LAUF_TOKEN) return recordSource('messbelege', 0, 'kein LAUF_TOKEN')
  const verpasst = readJson<VerpassterTermin[]>(DATEI, [])
  const auftraege = offeneMessbelege(verpasst, todayIso(), HOECHSTENS)
  /* Nichts offen ist der Normalfall, kein Ausfall. */
  if (!auftraege.length) return recordSource('messbelege', 0, undefined, 0, true)
  const browser = await chromium.launch()
  let abgelegt = 0
  try {
    const seite = await browser.newPage({ userAgent: UA, locale: 'de-DE', timezoneId: 'Europe/Berlin', viewport: { width: 1400, height: 900 } })
    /* Dieselbe Seite für mehrere Aufträge desselben Tages wird nur einmal geöffnet. */
    const jeTag = new Map<string, Messbeleg | undefined>()
    for (const a of auftraege) {
      if (!jeTag.has(a.tag)) {
        await seite.goto(kalenderTag(a.tag), { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await seite.waitForSelector('article.release', { timeout: 15_000 }).catch(() => undefined)
        /* Der Cookie-Banner liegt sonst quer über dem Kalender (Probe 02.10.2026); entfernt, nicht beantwortet. */
        await seite.evaluate(() => document.querySelector('#onetrust-consent-sdk')?.remove())
        const am = new Date().toISOString()
        const basis = `www.crunchyroll.com/simulcastcalendar/${a.tag}/${am.slice(0, 16).replace(':', '')}`
        const bild = await ablegen(`${basis}.jpg`, await seite.screenshot({ fullPage: true, type: 'jpeg', quality: 50 }), 'image/jpeg')
        const html = bild && (await ablegen(`${basis}.html.gz`, gzipSync(await seite.content()), 'application/gzip'))
        jeTag.set(a.tag, bild ? { am, url: kalenderTag(a.tag), bild, ...(html ? { html } : {}) } : undefined)
        /* Eine gescheiterte Ablage ist kein Befund — der Rest wartet auf den nächsten Lauf. */
        if (!bild) break
      }
      const beleg = jeTag.get(a.tag)
      if (!beleg) continue
      a.v[a.feld] = beleg
      abgelegt++
    }
  } finally {
    await browser.close()
  }
  if (abgelegt) writeJson(DATEI, verpasst, true)
  log(`Messbelege: ${abgelegt} von ${auftraege.length} abgelegt`)
  recordSource('messbelege', abgelegt, abgelegt ? undefined : 'Ablage nicht erreichbar', abgelegt)
}

main().catch((err) => {
  warn(`Messbelege: ${(err as Error).message}`)
  recordSource('messbelege', 0, (err as Error).message, 0)
  process.exitCode = 0
})
