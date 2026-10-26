import type { FranchiseMember, Title } from '@shared/types.ts'
import {
  anzeigeName,
  eindeutschenStaffel,
  hauptstaffeln,
  staffelBeschriftungen,
  reihenAnfang,
  istStaffel,
  ohneStaffelEins,
  reihenVertreter,
  zaehlgruppeVon,
} from '@shared/titles.ts'
import type { Dataset } from '../../lib/data.ts'
import { kurzName } from './reihen-regeln.ts'

/**
 * Wie die Reihe heißt — nicht, wie die gerade gewählte Staffel heißt.
 *
 * Im Kopf stand vorher „That Time I Got Reincarnated as a Slime Season 4",
 * während vier Zeilen darunter „… Staffel 4" stand: dasselbe zweimal, einmal
 * auf Englisch. Der Kopf nennt jetzt die Reihe, die Staffel steht im
 * Umschalter darunter.
 */
export function reihenNameVon(title: Title | undefined, reihe: FranchiseMember[], data: Dataset): string {
  if (!title) return ''
  /* Der Kopf nennt die Zählgruppe des geöffneten Titels: Eine Neuverfilmung heißt nicht wie das Original (Yaiba 2025, 26.10.2026). */
  const gruppe = zaehlgruppeVon(reihe, title.id)
  const teile = gruppe.length ? gruppe : reihe
  if (teile.length < 2) return anzeigeName(title)
  const vertreter = reihenVertreter(teile.map((m) => ({ ...m, id: m.id })))
  const kopf = ohneStaffelEins(vertreter.name)
  const kopfIstDeutsch = data.titleById.get(vertreter.id)?.titleDe === vertreter.name
  /* Der erste Teil nennt oft sich selbst, nicht die Reihe — siehe `reihenAnfang()`. */
  return reihenAnfang(kopf, teile.map((m) => m.name), kopfIstDeutsch)
}

/**
 * Was diesen Teil von der Reihe unterscheidet — „Staffel 3", „Der Film".
 *
 * Steht unter dem Karussell an der Stelle, an der vorher noch einmal der
 * Reihenname stand. Der Grund: Welcher Teil gerade offen ist, war allein am
 * blauen Rahmen einer von acht Vorschaukarten zu erkennen, und das ging unter.
 * Der Unterschied ist die wichtigste Auskunft im Kopf,
 * also steht er im Klartext und am größten.
 *
 * Ermittelt wird er durch Abzug: Was am Namen des Teils über den Reihennamen
 * hinausgeht, ist das Unterscheidende. Bleibt nichts übrig — der Teil heißt
 * genau wie die Reihe, typisch für die erste Staffel —, treten Format und
 * Jahr an seine Stelle, denn „2023" unterscheidet immer noch.
 *
 * **Nur innerhalb einer Reihe.** Bei einem Titel, der allein steht, gibt es
 * nichts zu unterscheiden, und der Rückfall auf das Jahr wird zur Absurdität:
 * Über „Banana Fish" stand am 15.08.2026 in großer, fetter Schrift „2018".
 * Deshalb prüft die Ausgabestelle zusätzlich, ob die Reihe überhaupt mehr als
 * einen Teil hat.
 */
export function teilNameVon(title: Title | undefined, reihenName: string, reihenTeile: FranchiseMember[]): string {
  if (!title) return ''
  const voll = eindeutschenStaffel(anzeigeName(title))
  let rest = voll.toLowerCase().startsWith(reihenName.toLowerCase())
    ? voll.slice(reihenName.length).replace(/^[\s:–—-]+/, '').trim()
    : voll
  /*
    **Trägt der Name einen fremden Reihennamen, zählt nur die Staffelangabe.**

    Über „Staffel 3 Teil 2" stand im Kopf „Kusuriya no Hitorigoto Staffel 3
    Teil 2", in der Liste darunter korrekt „Staffel 3 Teil 2" — bei Teil 1
    stimmten beide. Der Grund ist der Abzug oben: Für
    Teil 2 kennen wir keinen deutschen Namen, der Titel beginnt deshalb nicht
    mit unserem Reihennamen, und der Abzug greift nicht.

    Die Liste zieht dieselbe Regel seit dem 03.09.2026 — der Kopf nicht, und
    damit stand derselbe Teil an zwei Stellen verschieden da. Welche Reihe
    gemeint ist, sagt die Zeile darüber; einen deutschen Namen erfindet auch
    diese Regel nicht.

    **Nur bei einer Staffel.** Beim Beiwerk ist der fremde Reihenname gerade
    das Unterscheidende — „Maomao no Hitorigoto Staffel 2" ist nicht die
    zweite Staffel der Hauptserie.
  */
  const staffelTeil = /(?:^|\s)(Staffel\s+\d+(?:\s*[-–—]?\s*Teil\s+\d+)?)\s*$/i.exec(rest)
  /* Nur ein fremder Name (rest === voll) wird gekürzt — „Pokémon: Schwarz & Weiß Staffel 2" behält „Schwarz & Weiß" (17.09.2026). */
  if (istStaffel(title.format) && staffelTeil && rest === voll && rest !== staffelTeil[1] && staffelBeschriftungen(hauptstaffeln(reihenTeile), reihenName).has(title.id)) rest = staffelTeil[1]!
  /**
   * Bleibt nichts übrig, heißt der Teil wie die Reihe — dann steht auch der
   * volle Name hier, und die Ausgabestelle unterdrückt die Zeile als
   * Wiederholung.
   *
   * Vorher trat hier Format und Jahr an die Stelle des Namens, und über
   * „Fairy Tail" stand in großer Schrift „2009" (Daniel, 15.08.2026 — schon
   * das zweite Mal, nachdem bei Banana Fish „2018" dort stand). Eine nackte
   * Jahreszahl als Überschrift beantwortet keine Frage; welcher Teil gewählt
   * ist, zeigt das Karussell.
   */
  /*
    **Staffel und Teil kommen aus derselben Zählung wie in der Liste.**

    Über Mushoku Tensei Staffel 3 stand „Staffel 5": Gezählt wurde die
    Position unter allen Fernsehstaffeln, und AniList führt die beiden
    zweiten Hälften („Cour 2") als eigene Einträge.
    `staffelBeschriftungen()` ordnet einen Teil seiner Staffel zu.
  */
  const beschriftung = staffelBeschriftungen(hauptstaffeln(reihenTeile), reihenName).get(title.id)
  if (beschriftung) return beschriftung
  return kurzName(rest, voll)
}
