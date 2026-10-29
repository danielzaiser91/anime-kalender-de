/**
 * Der Filter-Knopf der Datenbank am Rechner bleibt beim Auf- und Zuklappen exakt an derselben Stelle (Daniel, 29.10.2026:
 * im Mockup sprang er beim Öffnen von rechts nach links). Gemessen wird die Box (x, y, Breite, Höhe) vorher, offen und nachher,
 * bei 1366 und 1920 px, hell und dunkel, ohne und mit gewähltem Filter. Zusätzlich: Escape schließt, der Fokus kehrt zum Knopf zurück.
 *
 * Eigener Browser ohne `--hide-scrollbars` (sonst misst man eine Leiste von 0 px und sieht keinen Sprung).
 */
import { escapeAbweichungen, messeEscape } from './ansicht-filterknopf-escape.mjs'

const BREITEN = [1366, 1920]
const THEMEN = ['hell', 'dunkel']
const ADRESSEN = { 'ohne Filter': 'http://ak.test/#/datenbank', 'mit Filter': 'http://ak.test/#/datenbank?g=Fantasy', 'mit vielen Filtern': 'http://ak.test/#/datenbank?g=Fantasy,Action,Comedy,Drama,Magie,Mecha,Musik,Horror,Romance,Samurai' }
const KNOPF = 'button[data-filter-knopf]'

/** Abweichungen zwischen den Boxen des Knopfs (zu, offen, wieder zu); `boxen` = { zu, offen, danach } mit x, y, width, height. */
export function knopfAbweichungen(wo, boxen) {
  const a = []
  for (const [name, b] of [['offen', boxen.offen], ['nach dem Schließen', boxen.danach]]) {
    for (const k of ['x', 'y', 'width', 'height']) {
      if (Math.abs(b[k] - boxen.zu[k]) > 0.5) a.push(`${wo}: Knopf ${name}: ${k} ${b[k]} statt ${boxen.zu[k]}`)
    }
  }
  return a
}

/** Box des Filter-Knopfs; läuft im Browser. */
function messeKnopf(sel) {
  const knopf = document.querySelector(sel)
  const b = knopf?.getBoundingClientRect()
  const dock = knopf?.closest('.fixed')?.getBoundingClientRect()
  return b ? { x: b.x, y: b.y, width: b.width, height: b.height, dockBreite: dock?.width ?? 0 } : null
}

/** Zugeklappt steht unten nur der Knopf: das Dock ist höchstens 20 px (Rand und Luft) breiter als er. */
export function dockAbweichung(wo, zu) {
  const mehr = zu.dockBreite - zu.width
  return mehr > 20 ? [`${wo}: zugeklappt ${Math.round(zu.dockBreite)} px breit statt nur Knopf (${Math.round(zu.width)} px)`] : []
}

async function pruefeFall(browser, antworte, breite, thema, adresse) {
  const seite = await browser.newPage({ viewport: { width: breite, height: 900 }, colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
  await seite.route('**/*', antworte)
  await seite.goto('about:blank')
  await seite.goto(adresse, { waitUntil: 'networkidle' })
  await seite.waitForTimeout(1500)
  const knopf = seite.locator(KNOPF).first()
  await knopf.waitFor({ state: 'visible' })
  const zu = await seite.evaluate(messeKnopf, KNOPF)
  await knopf.click()
  await seite.waitForTimeout(800)
  const offen = await seite.evaluate(messeKnopf, KNOPF)
  await knopf.click()
  await seite.waitForTimeout(800)
  const danach = await seite.evaluate(messeKnopf, KNOPF)
  await knopf.click()
  await seite.waitForTimeout(500)
  await seite.evaluate(() => document.activeElement?.blur())
  await seite.keyboard.press('Escape')
  await seite.waitForTimeout(300)
  const draussen = await seite.evaluate((sel) => document.querySelector(sel)?.getAttribute('aria-expanded'), KNOPF)
  await knopf.focus()
  await seite.keyboard.press('Escape')
  await seite.waitForTimeout(500)
  const fokus = await seite.evaluate((sel) => document.activeElement === document.querySelector(sel), KNOPF)
  const zuNachEsc = await seite.evaluate((sel) => document.querySelector(sel)?.getAttribute('aria-expanded'), KNOPF)
  const escape = await messeEscape(seite, KNOPF)
  await seite.close()
  return { zu, offen, danach, fokus, zuNachEsc, escape, draussen }
}

/** Alle Fälle; `antworte` ist der `page.route`-Handler der Ansichtsprüfung. */
export async function pruefeFilterknopf(chromium, antworte) {
  const browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] })
  const abweichungen = []
  let faelle = 0
  for (const breite of BREITEN) {
    for (const thema of THEMEN) {
      for (const [art, adresse] of Object.entries(ADRESSEN)) {
        const wo = `Datenbank ${breite} px ${thema} ${art}`
        const m = await pruefeFall(browser, antworte, breite, thema, adresse)
        faelle += 1
        if (!m.zu || !m.offen || !m.danach) {
          abweichungen.push(`${wo}: Filter-Knopf nicht gefunden`)
          continue
        }
        abweichungen.push(...knopfAbweichungen(wo, m), ...dockAbweichung(wo, m.zu))
        abweichungen.push(...escapeAbweichungen(wo, m.escape))
        if (m.draussen !== 'true') abweichungen.push(`${wo}: Escape mit Fokus außerhalb des Docks schließt das Feld`)
        if (m.zuNachEsc !== 'false') abweichungen.push(`${wo}: Escape schließt das Feld nicht`)
        if (!m.fokus) abweichungen.push(`${wo}: Fokus kehrt nach Escape nicht zum Knopf zurück`)
        if (m.zu.height < 44) abweichungen.push(`${wo}: Knopf nur ${m.zu.height} px hoch (soll ≥ 44)`)
      }
    }
  }
  await browser.close()
  return { abweichungen, faelle }
}
