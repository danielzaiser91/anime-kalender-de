/**
 * Statusfarben in der gebauten App (docs/wissen/design-regeln.md, Abschnitt 5; 14.10.2026): die gewählte Pille (ein Tipp)
 * trägt `--ak-gut`, die ausgeschlossene Pille (zwei Tipps) trägt `--ak-fehler`, Feature und Bugfix der Patch Notes tragen
 * `--ak-gut-text` und `--ak-warnung-text` — in beiden Themen. Gemessen wird der berechnete Stil gegen den Wert des Tokens,
 * nicht die Klasse. Aufgerufen von `ansicht-bild.mjs` am Rechner (Datenbank und News); die Seite liefert die App aus `dist/`.
 */
const THEMEN = ['dunkel', 'hell']

/** Berechnete Farbe eines Tokens: ein Wegwerf-Element nimmt `var(--ak-…)` an. Läuft im Browser. */
function tokenFarben(namen) {
  return Object.fromEntries(
    namen.map((name) => {
      const probe = document.createElement('div')
      probe.style.color = `var(--ak-${name})`
      document.body.appendChild(probe)
      const farbe = getComputedStyle(probe).color
      probe.remove()
      return [name, farbe]
    }),
  )
}

/** Die Genre-Pillen, an denen gemessen wird: ein Tipp wählt Action, zwei Tipps schließen Comedy aus (beide stehen in jedem Bestand; Ecchi nicht: standardmäßig ausgeblendet). */
const PILLE_UND_TIPPS = { include: ['Action', 1], exclude: ['Comedy', 2] }

/** Tippt die Genre-Pille einmal; sie wird in ihrem aktuellen Zustand gefunden (ausgeschlossen trägt ein ⊘ davor). Läuft im Browser. */
function tippePille(name) {
  const pille = [...document.querySelectorAll('button.rounded-full[aria-pressed]')].find((b) => b.offsetParent && b.textContent.replace('⊘', '').trim().startsWith(name))
  pille.click()
}

/** Stil der Genre-Pille im erwarteten Zustand (`true` gewählt, `mixed` ausgeschlossen). Läuft im Browser. */
function stilNachKlick({ name, zustand }) {
  const pillen = [...document.querySelectorAll(`button.rounded-full[aria-pressed="${zustand}"]`)].filter((b) => b.offsetParent && b.textContent.includes(name))
  const s = pillen[0] && getComputedStyle(pillen[0])
  return { pilleRand: s?.borderTopColor, pilleDurch: s?.textDecorationLine }
}

/** Patch-Notes-Farben: ein Eintrag mit `.feature` bzw. `.bugfix` bekommt die Textfarbe der Kennfarbe. Läuft im Browser. */
function patchnotesFarben() {
  const zeile = document.createElement('div')
  zeile.className = 'pn-zeile'
  zeile.innerHTML = '<span class="feature">a</span><span class="bugfix">b</span>'
  document.body.appendChild(zeile)
  const r = { feature: getComputedStyle(zeile.querySelector('.feature')).color, bugfix: getComputedStyle(zeile.querySelector('.bugfix')).color }
  zeile.remove()
  return r
}

/** Öffnet das Filterfenster der Datenbank, wählt eine Pille (ein Tipp) und schließt eine aus (zwei Tipps). */
async function filterMessung(seite) {
  await seite.goto('about:blank')
  await seite.goto('http://ak.test/#/datenbank', { waitUntil: 'networkidle' })
  await seite.waitForTimeout(2000)
  await seite.locator('div.fixed button[aria-expanded]').first().click()
  await seite.locator('[data-filter-scroll]').first().waitFor({ state: 'visible' })
  await seite.waitForTimeout(800)
  const aus = {}
  for (const modus of ['include', 'exclude']) {
    const [name, anzahl] = PILLE_UND_TIPPS[modus]
    for (let i = 0; i < anzahl; i++) {
      await seite.evaluate(tippePille, name)
      await seite.waitForTimeout(300)
    }
    aus[modus] = await seite.evaluate(stilNachKlick, { name, zustand: modus === 'include' ? 'true' : 'mixed' })
  }
  return aus
}

/** Öffnet die Patch Notes und misst Feature und Bugfix. */
async function patchnotesMessung(seite) {
  await seite.goto('about:blank')
  await seite.goto('http://ak.test/#/news', { waitUntil: 'networkidle' })
  await seite.locator('header').first().waitFor({ state: 'visible', timeout: 20_000 })
  await seite.waitForTimeout(2000)
  await seite.getByRole('button', { name: /Neu auf der Webseite/ }).first().click()
  await seite.locator('.pn-schleier').first().waitFor({ state: 'visible', timeout: 10_000 })
  await seite.waitForTimeout(500)
  return seite.evaluate(patchnotesFarben)
}

/** Abweichungen eines Themas als Texte; `soll` sind die Tokenfarben aus `tokenFarben`. */
export function abweichungen(thema, soll, f, p) {
  const a = []
  const pruefe = (was, ist, erwartet) => {
    if (ist !== erwartet) a.push(`${thema}: ${was} ist ${ist}, erwartet ${erwartet}`)
  }
  pruefe('gewählte Pille (Rand)', f.include.pilleRand, soll.gut)
  pruefe('ausgeschlossene Pille (Rand)', f.exclude.pilleRand, soll.fehler)
  if (!/line-through/.test(f.exclude.pilleDurch ?? '')) a.push(`${thema}: ausgeschlossene Pille ist nicht durchgestrichen`)
  pruefe('Patch Notes Feature', p.feature, soll['gut-text'])
  pruefe('Patch Notes Bugfix', p.bugfix, soll['warnung-text'])
  return a
}

/** Wahr, wenn eine Messung rot ist; druckt den Befund. */
export async function pruefeStatusfarben(seite) {
  const alle = []
  for (const thema of THEMEN) {
    await seite.emulateMedia({ colorScheme: thema === 'dunkel' ? 'dark' : 'light' })
    const f = await filterMessung(seite)
    const p = await patchnotesMessung(seite)
    const soll = await seite.evaluate(tokenFarben, ['gut', 'fehler', 'gut-text', 'warnung-text'])
    alle.push(...abweichungen(thema, soll, f, p))
  }
  console.log(`\nStatusfarben (Pille, Patch Notes; hell und dunkel): ${alle.length ? '' : 'ok'}`)
  for (const l of alle) console.log(`  ✕ ${l}`)
  return alle.length > 0
}
