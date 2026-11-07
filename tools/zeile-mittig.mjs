/**
 * Zeile vor einem Zeiger-Test in die Fenstermitte holen. `scrollIntoViewIfNeeded` lässt eine Zeile stehen, die formal im Fenster
 * liegt, aber unter dem sticky Kopf steckt (Samstag: Scroll am Maximum, Zeile bei y=36); die Maus trifft dann den Kopf.
 */

/** Harte Frist, bis die Seite zur Ruhe gekommen sein muss; danach misst die Probe, was da ist (und meldet ehrlich). */
const RUHE_FRIST_MS = 4000
/** So viele Bilder in Folge ohne Bewegung gelten als Stillstand. */
const RUHE_BILDER = 8

/**
 * Läuft im Browser: holt das Element mittig und wartet, bis die Lage über `ruhe` Bilder hält. Die Wochenansicht gleitet nach
 * jeder Ankunft weich zum nächsten Termin (`woche-sprung.ts`); ein einmaliges `scrollIntoView` mitten darin wird vom Gleiten
 * überholt, die Zeile landet nach der Messung unter dem Kopf (Flackern der Kette 06.11.2026, 3 von 8 lokalen Läufen).
 * Mit `ruhe` = 0 entfällt das Warten (Test des alten Wegs).
 */
async function haltMittig(el, p) {
  const bild = () => new Promise((fertig) => { requestAnimationFrame(fertig); setTimeout(fertig, 50) })
  const ende = performance.now() + p.frist
  let ruhig = 0
  let letzte = null
  do {
    el.scrollIntoView({ block: 'center' })
    if (p.ruhe === 0) return true
    await bild()
    ruhig = scrollY === letzte ? ruhig + 1 : 0
    letzte = scrollY
  } while (ruhig < p.ruhe && performance.now() < ende)
  return ruhig >= p.ruhe
}

/** Scrollt das Element so, dass es mittig im Fenster liegt (sticky Kopf und Fußleiste verdecken die Mitte nicht) und die Lage hält. */
export async function zeileMittig(zeile, ruhe = RUHE_BILDER) {
  await zeile.evaluate(haltMittig, { ruhe, frist: RUHE_FRIST_MS })
}

/** Wartet auf Stillstand des Bildlaufs, ohne selbst zu scrollen (für Proben, die mit `scrollIntoViewIfNeeded` arbeiten). */
export async function ruheAbwarten(seite) {
  await seite.evaluate(async (p) => {
    const bild = () => new Promise((fertig) => { requestAnimationFrame(fertig); setTimeout(fertig, 50) })
    const ende = performance.now() + p.frist
    let ruhig = 0
    let letzte = null
    while (ruhig < p.ruhe && performance.now() < ende) {
      await bild()
      ruhig = scrollY === letzte ? ruhig + 1 : 0
      letzte = scrollY
    }
  }, { ruhe: RUHE_BILDER, frist: RUHE_FRIST_MS })
}

/** Meldung, wenn am Zeigerpunkt (x, y) nicht die Zeile oder ein Kind von ihr liegt; sonst null. */
export async function verdeckung(zeile, x, y) {
  const trifft = await zeile.evaluate((el, p) => {
    const oben = document.elementFromPoint(p.x, p.y)
    return oben !== null && el.contains(oben)
  }, { x, y })
  return trifft ? null : `Zeile vom Kopf verdeckt (Punkt ${Math.round(x)},${Math.round(y)} trifft eine andere Fläche)`
}
