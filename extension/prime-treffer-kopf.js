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

  /**
   * Passt der Kartentitel genau auf den Kopf des Auftragstitels? `titelKern` kommt vom Aufrufer.
   *
   * **Nur wenn die Reihe in derselben Trefferliste durchnummeriert ist:** Eine Folgekarte („Name 2 - …") mit
   * demselben Kopf zeigt, dass die Karte ohne Zusatz Teil 1 ist. Ohne sie wäre „Dragon Ball Z" die Karte
   * zu „Dragon Ball Z - Kampf der Götter" — ein Film oder Spin-off bekäme die Serienkarte als Treffer.
   * `alleKartenTitel`: die Titel aller Karten der Liste.
   */
  globalThis.akPrimeKopfPasst = (auftragTitel, kartenTitel, titelKern, alleKartenTitel) => {
    const kopf = kopfVorStrich(auftragTitel)
    if (!kopf || kopf.split(/\s+/).length < 2) return false
    const kern = titelKern(kopf)
    if (kern.length < MINDEST_KERN || kern !== titelKern(kartenTitel)) return false
    const folge = new RegExp(`^${kern}[2-9]`)
    return alleKartenTitel.some((t) => folge.test(titelKern(t)))
  }
}
