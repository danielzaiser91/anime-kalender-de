/* global selbstAn, laufBeenden -- aus melder.js, gemeinsamer Scope eines content_scripts-Eintrags */
/**
 * **Auf der Profilauswahl („Wer schaut gerade?") ist die Erweiterung eingeklappt** (Daniel,
 * 05.11.2026): Ohne Login ergibt keine Bedienung Sinn — „alle durchgehen" fuhr von dort auf
 * `/watch/<id>` und endete auf der E103-Seite, „aniSearch", „Ruhemodus" und „Bericht laden" taten
 * nichts. Nur visuell (`melder.css`, `html.ak-profilwahl`); ein laufender Durchgang endet.
 *
 * Erkannt wird die Seitenstruktur (`data-uia`), nie der sichtbare Text. Belegt am echten HTML der
 * Profilauswahl vom 05.11.2026. Nach der Profilwahl verschwindet das Element, die Marke fällt ab.
 */
const AK_PROFILWAHL_ELEMENT = '[data-uia="profile-gate-screen"]'

function akProfilwahlSeite(doc) {
  return Boolean(doc.querySelector(AK_PROFILWAHL_ELEMENT))
}

/** Ein Takt: Marke setzen oder löschen, einen laufenden Durchgang beenden. Gibt zurück, ob die Auswahl da ist. */
function akProfilwahlTakt(doc, durchgangLaeuft, beenden) {
  const da = akProfilwahlSeite(doc)
  doc.documentElement.classList.toggle('ak-profilwahl', da)
  if (da && durchgangLaeuft()) beenden('Profilauswahl: nicht angemeldet')
  return da
}

setInterval(() => {
  try {
    akProfilwahlTakt(
      document,
      () => typeof selbstAn !== 'undefined' && selbstAn,
      (grund) => laufBeenden(grund),
    )
  } catch {
    /* Vor dem Laden von melder.js gibt es noch keinen Durchgang. */
  }
}, 500)
