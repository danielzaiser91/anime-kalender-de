/**
 * **Stichprobe über die ausgelieferte Seite: Panels live rendern, Widersprüche finden.**
 *
 * Entstanden am 16.09.2026, nachdem an einem Tag fast jeder Fehler über Daniels Bilder kam.
 * Zieht 50 Titel aus dem ausgelieferten Bestand (Wochenserie, Katalog, nur Disc, Film, ohne
 * Weg, teilweise), rendert je ein Detail-Panel und hält den Kastentext gegen feste Regeln.
 * Befunde mit Bild landen im Temp-Ordner. Die Regeln finden nur bekannte Fehlerarten — die
 * Textliste am Ende wird deshalb auch gelesen, nicht nur gezählt.
 *
 * Aufruf: `npm run check:stichprobe -- <keim>` (fester Keim = dieselbe Auswahl).
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const OUT = (process.env.TEMP ?? '/tmp').replaceAll(String.fromCharCode(92), '/') + '/panel-stichprobe-'
const hol = async (p) => (await fetch(`https://anime-kalender.de/data/${p}?x=${Date.now()}`)).json()
const titles = await hol('titles.json')
const releases = await hol('releases.json')
const heute = new Date().toISOString().slice(0, 10)
const relJe = new Map()
for (const r of releases) relJe.set(r.titleId, [...(relJe.get(r.titleId) ?? []), r])

// Zufall mit festem Keim, damit ein zweiter Lauf dieselben Titel sieht
let keim = Number(process.argv[2] ?? 7)
const zufall = () => ((keim = (keim * 16807) % 2147483647) / 2147483647)
const ziehe = (liste, n) => [...liste].sort(() => zufall() - 0.5).slice(0, n)
const gruppen = {
  woche: titles.filter((t) => (relJe.get(t.id) ?? []).some((r) => r.releaseType === 'weekly')),
  katalog: titles.filter((t) => (t.streams ?? []).some((s) => s.dub === true) && !relJe.has(t.id)),
  nurDisc: titles.filter((t) => !(t.streams ?? []).length && (t.watchLinks ?? []).length),
  film: titles.filter((t) => t.format === 'MOVIE'),
  ohneWeg: titles.filter((t) => !(t.streams ?? []).length && !(t.watchLinks ?? []).length),
  teilweise: titles.filter((t) => (t.streams ?? []).some((s) => s.dubRanges?.length)),
}
const auswahl = [
  ...ziehe(gruppen.woche, 10), ...ziehe(gruppen.katalog, 12), ...ziehe(gruppen.nurDisc, 8),
  ...ziehe(gruppen.film, 8), ...ziehe(gruppen.ohneWeg, 6), ...ziehe(gruppen.teilweise, 6),
]

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 560, height: 1300 } })
const befunde = []
for (const t of auswahl) {
  try {
    await p.goto('about:blank')
    await p.goto(`https://anime-kalender.de/#/datenbank?t=${t.id}`, { waitUntil: 'networkidle' })
    const panel = p.locator('[data-panel="titel"]').last()
    await panel.waitFor({ timeout: 20000 })
    await p.waitForTimeout(1200)
    const kasten = panel.locator('section').first()
    const text = (await kasten.innerText()).replace(/\s+/g, ' ')
    const pillen = await kasten.locator('a, button').allInnerTexts()
    const name = t.titleDe ?? t.titleEn ?? t.titleRomaji
    const probleme = []
    const deStreams = (t.streams ?? []).filter((s) => s.dub === true).length
    if (/Noch keine deutsche Fassung/.test(text) && (deStreams || t.hasVoices)) probleme.push('„keine Fassung" trotz Beleg')
    const alle = /Alle (\d+) Folgen/.exec(text)
    if (alle && t.episodes && Number(alle[1]) !== t.episodes) probleme.push(`„Alle ${alle[1]}" bei ${t.episodes} Folgen`)
    for (const m of text.matchAll(/(\d+) Fg\./g)) if (t.episodes && Number(m[1]) > t.episodes) probleme.push(`Pille ${m[1]} Fg. > ${t.episodes}`)
    if (/\b0 von \d+ Folgen auf Deutsch/.test(text)) probleme.push('„0 von N auf Deutsch"')
    if (pillen.some((x) => x.split('\n')[0].trim() === name)) probleme.push('Pille trägt den Titelnamen')
    if (/nicht mehr abrufbar/.test(await panel.innerText())) probleme.push('Abgang angezeigt (prüfen)')
    const seit = /Auf Deutsch seit (\d{2})\.(\d{2})\.(\d{4})/.exec(text)
    if (seit && t.jpYear && Number(seit[3]) < t.jpYear) probleme.push(`„seit ${seit[3]}" vor JP ${t.jpYear}`)
    if (seit && `${seit[3]}-${seit[2]}-${seit[1]}` > heute) probleme.push('„seit" in der Zukunft')
    if (/Kein Anbieter bekannt/.test(text) && ((t.streams ?? []).length || (t.watchLinks ?? []).length)) probleme.push('„Kein Anbieter" trotz Weg')
    const teil = /(\d+) von (\d+) Folgen auf Deutsch/.exec(text)
    if (teil && new RegExp(`\\b${teil[2]} Fg\\. 🇩🇪 ✓`).test(text)) probleme.push(`„${teil[1]} von ${teil[2]}" neben einer Pille mit allen ${teil[2]}`)
    if (/\b1 Ausgaben\b/.test(text)) probleme.push('„1 Ausgaben"')
    if (/Alle 1 Folgen/.test(text)) probleme.push('„Alle 1 Folgen"')
    /* Drei Fehlerbilder aus der Stichprobe vom 17.09.2026 (Keim 131). */
    const vonGesamt = /\d+ von (\d+) Folgen erschienen/.exec(text)
    const folgenBis = /Folgen \d+ bis (\d+)/.exec(text)
    if (vonGesamt && folgenBis && Number(folgenBis[1]) > Number(vonGesamt[1])) probleme.push(`„von ${vonGesamt[1]}" neben „bis ${folgenBis[1]}"`)
    if (t.episodes === 1 && /DE nur Fg\. 1/.test(text)) probleme.push('„nur Fg. 1" bei einer einzigen Folge')
    if (t.episodes === 1 && /(^|\s)1 Fg\./.test(text)) probleme.push('„1 Fg." bei einem Werk mit einer Folge')
    if (/ - \?/.test(text)) probleme.push('offenes Zeitraumende „- ?"')
    if (/führt ihn bisher/.test(text) && /Kein Anbieter bekannt/.test(text)) probleme.push('„kein Anbieter" doppelt')
    if (/führt ihn bisher/.test(text) && /🇩🇪/.test(text)) probleme.push('„kein Anbieter" neben Anbieter-Pillen')
    if (/Finale Folge/.test(text) && /im TV am/.test(text)) probleme.push('„Finale Folge" aus einer TV-Sichtung')
    if (/Für Folgen \d+ kennen/.test(text)) probleme.push('„Für Folgen N" mit einer einzigen Folge')
    const luecke = /Für Folgen? ([\d–, ]+) kennen wir keinen/.exec(text)
    if (luecke && /Wöchentlich/.test(text)) probleme.push(`Lücke „${luecke[1]}" bei laufender Wochenserie (prüfen)`)
    if (/Noch keine deutsche Fassung/.test(text) && /Deutsche Fassung bei/.test(text)) probleme.push('„keine Fassung" neben „Deutsche Fassung bei"')
    if (pillen.some((x) => x.split('\n').slice(1).some((z) => z.trim() === name))) probleme.push('Pillen-Unterzeile wiederholt den Titel')
    if (/kein uns bekannter Anbieter|kennen wir keinen deutschen Anbieter/.test(text) && /fehlt uns eine Angabe/.test(text)) probleme.push('Lücke doppelt genannt')
    befunde.push({ id: t.id, name, text: text.slice(0, 220), probleme })
    if (probleme.length) await panel.screenshot({ path: OUT + `stich-${t.id}.png` })
  } catch (e) {
    befunde.push({ id: t.id, name: t.titleDe ?? t.titleEn, fehler: String(e).slice(0, 120) })
  }
}
await b.close()
writeFileSync(OUT + 'stichprobe.json', JSON.stringify(befunde, null, 1))
const mit = befunde.filter((x) => x.probleme?.length || x.fehler)
console.log(`${auswahl.length} Panels, ${mit.length} mit Befund`)
for (const x of mit) console.log(x.id, x.name, '|', (x.probleme ?? [x.fehler]).join('; '), '|', x.text ?? '')
