/**
 * Zeile vor einem Zeiger-Test in die Fenstermitte holen. `scrollIntoViewIfNeeded` lässt eine Zeile stehen, die formal im Fenster
 * liegt, aber unter dem sticky Kopf steckt (Samstag: Scroll am Maximum, Zeile bei y=36); die Maus trifft dann den Kopf.
 */

/**
 * Scrollt das Element so, dass es mittig im Fenster liegt (sticky Kopf und Fußleiste verdecken die Mitte nicht).
 * Nachladendes Layout (Bilder, Listen) verschiebt die Zeile nach dem Scroll aus dem Fenster (CI: y=-158, -270); darum wird
 * erneut zentriert, bis die Lage `RUHE_BILDER` Bilder lang unverändert blieb.
 */
const RUHE_BILDER = 8
export async function zeileMittig(zeile) {
  await ruhigImFenster(zeile, true)
}

/** Wartet, bis die Lage der Zeile ruhig ist, und holt sie nur dann in die Mitte, wenn sie ganz außerhalb des Fensters liegt (eine bewusst gewählte Lage bleibt). */
export async function zeileImFenster(zeile) {
  await ruhigImFenster(zeile, false)
}

async function ruhigImFenster(zeile, immerMittig) {
  await zeile.evaluate((el, p) => new Promise((fertig) => {
    let letzte = null
    let still = 0
    let versuche = 0
    const draussen = () => {
      const r = el.getBoundingClientRect()
      return r.bottom <= 0 || r.top >= window.innerHeight
    }
    const schritt = () => {
      const oben = el.getBoundingClientRect().top
      if (oben === letzte) still++
      else {
        still = 0
        letzte = null
        if (p.immerMittig || draussen()) el.scrollIntoView({ block: 'center' })
        letzte = el.getBoundingClientRect().top
      }
      if (still >= p.ruhe || ++versuche > 300) fertig(undefined)
      else requestAnimationFrame(schritt)
    }
    schritt()
  }), { ruhe: RUHE_BILDER, immerMittig })
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
  }, { ruhe: 8, frist: 4000 })
}

/** Meldung, wenn am Zeigerpunkt (x, y) nicht die Zeile oder ein Kind von ihr liegt; sonst null. */
export async function verdeckung(zeile, x, y) {
  const trifft = await zeile.evaluate((el, p) => {
    const oben = document.elementFromPoint(p.x, p.y)
    return oben !== null && el.contains(oben)
  }, { x, y })
  return trifft ? null : `Zeile vom Kopf verdeckt (Punkt ${Math.round(x)},${Math.round(y)} trifft eine andere Fläche)`
}
