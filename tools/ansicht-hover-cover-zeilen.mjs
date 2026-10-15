/**
 * Cover-Vorschau je Ansicht der Woche (Im Handel, Im Fernsehen; 15.10.2026): Zeigen auf eine Zeile zeigt genau das Cover
 * dieses Titels, und die Karte liegt neben dem Zeiger und der Zeile vollständig im Fenster — auch am rechten und unteren Rand.
 * Erwartet wird aus `dist/data/woche.json` (Ereignisse → Titel → Cover), nicht aus dem, was die Zeile selbst übergibt.
 * Hat die Woche für eine Ansicht keine Ereignisse mit Cover, wird sie übersprungen; sonst muss es Zeilen geben.
 */
import { readFileSync } from 'node:fs'

const ANSICHTEN = [
  { name: 'Im Handel', plattform: 'disc', wahl: '[data-hover-zeile]:not([data-tv-zeile])' },
  { name: 'Im Fernsehen', plattform: 'tv', wahl: '[data-tv-zeile][data-hover-zeile]' },
]
const FENSTER = { width: 1280, height: 900 }
const REIHEN = 8
const RAND_MIN = 4
const ABSTAND_MIN = 8
const ABSTAND_MAX = 40
/** Mindesthöhe über einer Zeile, damit die 170 px hohe Karte darüber Platz hat. */
const VORSCHAU_PLATZ = 190

/** Dateiname eines Cover-Links ohne Größenordner und Abfrage: gleich für jede Größe desselben Bildes. */
function bildName(url) {
  return url.split('?')[0].split('/').pop()
}

/** Erwartete Cover-Dateinamen für eine Zeile: Titel der Ereignisse dieser Ansicht, deren Name im Zeilentext steht (längster Name gewinnt). */
export function erwarteteBilder(woche, plattform, zeilenText) {
  const cover = new Map(woche.titles.map((t) => [t.id, t.coverImage]))
  const treffer = woche.events.filter((e) => e.platform === plattform && zeilenText.includes(e.name))
  const laengster = Math.max(0, ...treffer.map((e) => e.name.length))
  const ids = new Set(treffer.filter((e) => e.name.length === laengster).map((e) => e.titleId))
  return [...ids].map((id) => cover.get(id)).filter(Boolean).map(bildName)
}

/** Lage der Karte gegen Fenster, Zeiger und Zeile; leer, wenn sie stimmt. Alle Maße in Pixeln des Fensters. */
export function lageAbweichungen({ karte, zeile, zeiger, fenster }) {
  const a = []
  const rechts = karte.x + karte.width
  const unten = karte.y + karte.height
  if (karte.x < RAND_MIN || karte.y < RAND_MIN || rechts > fenster.breite - RAND_MIN || unten > fenster.hoehe - RAND_MIN) {
    a.push(`liegt nicht im sichtbaren Bereich (${Math.round(karte.x)},${Math.round(karte.y)} bis ${Math.round(rechts)},${Math.round(unten)} im Fenster ${fenster.breite}×${fenster.hoehe})`)
  }
  const luftLinks = karte.x - zeiger.x
  const luftRechts = zeiger.x - rechts
  if (Math.max(luftLinks, luftRechts) < ABSTAND_MIN || Math.max(luftLinks, luftRechts) > ABSTAND_MAX) {
    a.push(`liegt nicht neben dem Zeiger (Abstand ${Math.round(Math.max(luftLinks, luftRechts))} px, erwartet ${ABSTAND_MIN}–${ABSTAND_MAX})`)
  }
  const luftDarunter = karte.y - (zeile.y + zeile.height)
  const luftDarueber = zeile.y - unten
  if (Math.max(luftDarunter, luftDarueber) < RAND_MIN || Math.max(luftDarunter, luftDarueber) > ABSTAND_MAX) {
    a.push(`liegt nicht unmittelbar unter oder über der Zeile (Abstand ${Math.round(Math.max(luftDarunter, luftDarueber))} px)`)
  }
  return a
}

/** Zeigt mit der Maus auf die Zeile (Mitte, oder `ausRechts` Pixel vom rechten Zeilenrand) und liefert die Maße der Karte, sonst null. */
async function zeigeUndMesse(seite, zeile, ausRechts) {
  await seite.mouse.move(2, 2)
  await seite.waitForTimeout(150)
  const box = await zeile.boundingBox()
  const x = ausRechts === undefined ? box.x + Math.min(box.width / 2, 60) : box.x + box.width - ausRechts
  await seite.mouse.move(x, box.y + box.height / 2)
  const karte = seite.locator('[data-hover-cover]').first()
  try {
    await karte.waitFor({ state: 'visible', timeout: 1500 })
  } catch {
    return null
  }
  const bild = karte.locator('img')
  await bild.evaluate((i) => i.decode().catch(() => {}))
  return {
    text: await zeile.innerText(),
    bild: await bild.evaluate((i) => i.currentSrc),
    karte: await karte.boundingBox(),
    amBody: await karte.evaluate((k) => k.parentElement === document.body),
    zeigerEreignisse: await karte.evaluate((k) => getComputedStyle(k).pointerEvents),
    zeile: box,
    zeiger: { x, y: box.y + box.height / 2 },
    fenster: { breite: seite.viewportSize().width, hoehe: seite.viewportSize().height },
  }
}

/** Die erste der ersten acht Zeilen, die eine Karte bekommt, samt ihrer Zeile; null, wenn keine. */
async function ersteMitKarte(seite, wahl) {
  const zeilen = seite.locator(wahl)
  const anzahl = Math.min(await zeilen.count(), REIHEN)
  for (let i = 0; i < anzahl; i++) {
    const zeile = zeilen.nth(i)
    await zeile.scrollIntoViewIfNeeded()
    const m = await zeigeUndMesse(seite, zeile)
    if (m) return { ort: zeile, ...m }
  }
  return null
}

/** Randfälle an derselben Zeile: Fenster knapp unter ihr (Karte muss darüber) und knapp rechts von ihr (Karte muss links vom Zeiger). */
async function messeRaender(seite, zeile) {
  const befunde = []
  await seite.mouse.move(2, 2)
  await zeile.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 300))
  const box = await zeile.boundingBox()
  if (box.y < VORSCHAU_PLATZ) befunde.push('unten am Fenster: Zeile liegt zu weit oben, um die Lage zu messen')
  await seite.setViewportSize({ width: FENSTER.width, height: Math.ceil(box.y + box.height) + 24 })
  await seite.waitForTimeout(200)
  const unten = await zeigeUndMesse(seite, zeile)
  if (!unten) befunde.push('unten am Fenster: keine Vorschau')
  else befunde.push(...lageAbweichungen(unten).map((l) => `unten am Fenster: ${l}`))
  await seite.setViewportSize({ width: 1100, height: FENSTER.height })
  await seite.waitForTimeout(200)
  await zeile.scrollIntoViewIfNeeded()
  const rechts = await zeigeUndMesse(seite, zeile, 4)
  if (!rechts) befunde.push('am rechten Fensterrand: keine Vorschau')
  else befunde.push(...lageAbweichungen(rechts).map((l) => `am rechten Fensterrand: ${l}`))
  await seite.setViewportSize(FENSTER)
  await seite.waitForTimeout(200)
  await seite.mouse.move(2, 2)
  return befunde
}

/** Misst eine Ansicht; liefert die Befunde (leer = in Ordnung) und ob sie übersprungen wurde. */
async function messeAnsicht(seite, ansicht, woche) {
  const hatCover = woche.events.some((e) => e.platform === ansicht.plattform && woche.titles.some((t) => t.id === e.titleId && t.coverImage))
  if (!hatCover) return { name: ansicht.name, uebersprungen: true, befunde: [] }
  const m = await ersteMitKarte(seite, ansicht.wahl)
  if (!m) return { name: ansicht.name, befunde: ['keine der ersten Zeilen bekam eine Vorschau (Zeilen fehlen oder tragen keinen Zeiger)'] }
  const befunde = []
  const erwartet = erwarteteBilder(woche, ansicht.plattform, m.text)
  const titel = m.text.replace(/\s+/g, ' ').slice(0, 60)
  if (!erwartet.length) befunde.push(`Zeile „${titel}“ ist keinem Ereignis der Woche zuzuordnen`)
  else if (!erwartet.includes(bildName(m.bild))) befunde.push(`zeigt das Cover ${bildName(m.bild)} statt ${erwartet.join(' oder ')} (Zeile „${titel}“)`)
  befunde.push(...lageAbweichungen(m).map((l) => `neben dem Zeiger: ${l}`))
  if (!m.amBody) befunde.push('die Karte hängt nicht am body (ein Vorfahr mit transform würde ihr `fixed` verschieben)')
  if (m.zeigerEreignisse !== 'none') befunde.push(`die Karte fängt Zeigerereignisse ab (pointer-events: ${m.zeigerEreignisse})`)
  befunde.push(...(await klickSchliesst(seite, m.ort)))
  befunde.push(...(await messeRaender(seite, m.ort)))
  return { name: ansicht.name, zeile: titel, befunde }
}

/** Ein Klick öffnet das Panel; die Karte muss beim Drücken weg sein. Losgelassen wird abseits, damit kein Panel aufgeht. */
async function klickSchliesst(seite, zeile) {
  await zeile.scrollIntoViewIfNeeded()
  if (!(await zeigeUndMesse(seite, zeile))) return ['Klick: keine Vorschau zum Schließen']
  await seite.mouse.down()
  await seite.waitForTimeout(150)
  const bleibt = await seite.locator('[data-hover-cover]').count()
  await seite.mouse.move(2, 2)
  await seite.mouse.up()
  return bleibt ? ['die Vorschau bleibt beim Drücken der Maustaste stehen'] : []
}

/** Namen, die weder in einem anderen Namen der Ansicht stecken noch einen enthalten — damit die Zeile eindeutig zu finden ist. */
function eindeutigeTitel(woche, plattform) {
  const ev = woche.events.filter((e) => e.platform === plattform)
  const einzig = ev.filter((e) => ev.every((o) => o.titleId === e.titleId || (!o.name.includes(e.name) && !e.name.includes(o.name))))
  return [...new Map(einzig.map((e) => [e.titleId, e])).values()]
}

/**
 * Titel ohne Cover und verborgene Titel (localStorage `hidden`) bekommen keine Vorschau und keinen Zeiger.
 * Läuft zuletzt: lädt die Woche mit einem Datensatz neu, in dem je Ansicht der erste Titel kein Cover hat, und verbirgt den zweiten.
 */
async function messeSonderfaelle(seite, woche) {
  const gewaehlt = ANSICHTEN.map((a) => ({ ...a, titel: eindeutigeTitel(woche, a.plattform) }))
  const ohneCover = new Set(gewaehlt.map((a) => a.titel[0]?.titleId))
  const verborgen = gewaehlt.map((a) => a.titel[1]?.titleId).filter(Boolean)
  const ohne = (titles) => titles.map((t) => (ohneCover.has(t.id) ? { ...t, coverImage: undefined } : t))
  const antwort = (body) => (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  /* Der Wochenstart und danach der volle Datensatz (titles-core) liefern beide Titel — Cover in beiden entfernen. */
  const core = JSON.parse(readFileSync(new URL('../dist/data/titles-core.json', import.meta.url), 'utf8'))
  await seite.route(/\/data\/woche\.json/, antwort({ ...woche, titles: ohne(woche.titles) }))
  await seite.route(/\/data\/titles-core\.json/, antwort(ohne(core)))
  await seite.addInitScript((ids) => localStorage.setItem('hidden', JSON.stringify(ids)), verborgen)
  await seite.goto('about:blank')
  await seite.goto('http://ak.test/#/woche', { waitUntil: 'networkidle' })
  await seite.waitForTimeout(2500)
  const befunde = []
  for (const a of gewaehlt) {
    for (const [art, e] of [['ohne Cover', a.titel[0]], ['verborgen', a.titel[1]]]) {
      if (!e) continue
      const zeile = seite.locator('li', { hasText: e.name }).first()
      if (!(await zeile.count())) {
        befunde.push(`${a.name}: Zeile „${e.name}“ (${art}) nicht gefunden`)
        continue
      }
      await zeile.scrollIntoViewIfNeeded()
      if ((await zeile.getAttribute('data-hover-zeile')) !== null) befunde.push(`${a.name}: Zeile „${e.name}“ (${art}) trägt einen Zeiger`)
      const m = await zeigeUndMesse(seite, zeile).catch(() => null)
      if (m) befunde.push(`${a.name}: Zeile „${e.name}“ (${art}) bekommt eine Vorschau`)
    }
  }
  await seite.mouse.move(2, 2)
  return { name: 'Ohne Cover und verborgen', zeile: `${gewaehlt.map((a) => a.titel.length).join('/')} Titel`, befunde }
}

/** Alle Ansichten der Woche; je Eintrag `{ name, uebersprungen?, befunde }`. */
export async function messeAnsichten(seite) {
  const woche = JSON.parse(readFileSync(new URL('../dist/data/woche.json', import.meta.url), 'utf8'))
  const ergebnisse = []
  for (const ansicht of ANSICHTEN) ergebnisse.push(await messeAnsicht(seite, ansicht, woche))
  ergebnisse.push(await messeSonderfaelle(seite, woche))
  return ergebnisse
}
