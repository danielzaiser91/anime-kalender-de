/**
 * **Prime-Suche: Kartenname ohne Untertitel (31.10.2026).**
 *
 * Wir führen „Operation: Nussknacker - Auf die Nüsse, fertig, los!" (Teil 1), Prime nennt dieselbe
 * Karte „Operation Nussknacker". Vor dem ersten Doppelpunkt steht nur „Operation", der Kopf vor dem
 * Gedankenstrich ist aber der ganze Reihenname. Gilt nur, wenn der Kopf für sich trägt (zwei Wörter,
 * zehn Zeichen im Kern) — „Gundam - Iron-Blooded Orphans" trifft sonst jede Karte „Gundam".
 * Teil 2 trägt seine Nummer schon im Kopf („Operation Nussknacker 2 - …"), seine Karte
 * „Operation Nussknacker" meint darum nie Teil 2.
 */
{
  const MINDEST_KERN = 10

  /** Der Teil vor dem ersten Gedankenstrich mit Leerzeichen drumherum, sonst `null`. */
  function kopfVorStrich(titel) {
    const teile = String(titel ?? '').split(/\s[-–—]\s/)
    return teile.length > 1 ? teile[0].replace(/[:\s]+$/, '').trim() : null
  }

  /** Passt der Kartentitel genau auf den Kopf des Auftragstitels? `titelKern` kommt vom Aufrufer. */
  globalThis.akPrimeKopfPasst = (auftragTitel, kartenTitel, titelKern) => {
    const kopf = kopfVorStrich(auftragTitel)
    if (!kopf || kopf.split(/\s+/).length < 2) return false
    const kern = titelKern(kopf)
    return kern.length >= MINDEST_KERN && kern === titelKern(kartenTitel)
  }
}
