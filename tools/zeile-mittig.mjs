/**
 * Zeile vor einem Zeiger-Test in die Fenstermitte holen. `scrollIntoViewIfNeeded` lässt eine Zeile stehen, die formal im Fenster
 * liegt, aber unter dem sticky Kopf steckt (Samstag: Scroll am Maximum, Zeile bei y=36); die Maus trifft dann den Kopf.
 */

/** Scrollt das Element so, dass es mittig im Fenster liegt (sticky Kopf und Fußleiste verdecken die Mitte nicht). */
export async function zeileMittig(zeile) {
  await zeile.evaluate((el) => el.scrollIntoView({ block: 'center' }))
}

/** Meldung, wenn am Zeigerpunkt (x, y) nicht die Zeile oder ein Kind von ihr liegt; sonst null. */
export async function verdeckung(zeile, x, y) {
  const trifft = await zeile.evaluate((el, p) => {
    const oben = document.elementFromPoint(p.x, p.y)
    return oben !== null && el.contains(oben)
  }, { x, y })
  return trifft ? null : `Zeile vom Kopf verdeckt (Punkt ${Math.round(x)},${Math.round(y)} trifft eine andere Fläche)`
}
