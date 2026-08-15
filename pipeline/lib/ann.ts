/**
 * Was Anime News Network über die **deutsche** Sprecherbesetzung sagt.
 *
 * ANN ist die zweite Quelle neben AniList, und sie ist keine Verdopplung: Am
 * 15.08.2026 an acht Titeln gemessen, für die AniList **keine** deutschen
 * Stimmen führt, hatten **fünf** welche bei ANN — Eyeshield 21 (6 Rollen),
 * Gankutsuou (8), FAKE (5), MUSHI-SHI (3), Three Little Ghosts (1). 622 unserer
 * Titel fallen in diese Gruppe.
 *
 * Warum das mehr ist als eine schönere Sprecherliste: Ein deutscher Sprecher zu
 * einer Rolle **belegt**, dass eine deutsche Fassung existiert. Nach der
 * Rücknahme der Crunchyroll-Gastauskunft am 15.08.2026 ist das die einzige
 * maschinelle Auskunft, die wir zu dieser Frage überhaupt noch haben.
 *
 * **Die Grenze bleibt scharf:** Sprechrollen belegen, *dass* es eine deutsche
 * Fassung gibt — nicht, *wo* sie läuft. Daraus darf niemals ein `stream.dub`
 * werden; genau diese Vermischung war der Crunchyroll-Fehler.
 *
 * ANNs Bedingungen (<https://www.animenewsnetwork.com/encyclopedia/api.php>):
 * Quellennennung, ein Link zum jeweiligen Encyclopedia-Eintrag auf jeder Seite,
 * die die Angaben zeigt, und **eine Anfrage pro Sekunde** je IP.
 */

/** Eine Rolle, wie sie im Datensatz landet. */
export interface AnnRolle {
  character: string
  actor: string
}

/**
 * Adresse des Encyclopedia-Eintrags — Pflicht, wo die Angaben gezeigt werden.
 *
 * Steht hier und nicht in der Oberfläche, damit es genau eine Stelle gibt, an
 * der die Form festgelegt ist. Eine zweite Fassung liefe irgendwann auseinander,
 * und dann stünde da ein toter Link unter einer Auflage, die wir erfüllen müssen.
 */
export function annUrl(annId: number): string {
  return `https://www.animenewsnetwork.com/encyclopedia/anime.php?id=${annId}`
}

/**
 * Liest die deutschen Sprechrollen aus einer Encyclopedia-Antwort.
 *
 * Bewusst mit regulären Ausdrücken statt mit einem XML-Parser: Gebraucht werden
 * zwei Felder aus einer flachen, seit Jahren unveränderten Struktur, und eine
 * Abhängigkeit für 20 Zeilen wäre teurer als die Zeilen selbst. Bricht ANN die
 * Struktur, fällt das sofort auf — dann steht hier eine leere Liste, und der
 * Prüflauf meldet den Einbruch.
 *
 * Die Struktur, gemessen am 15.08.2026 an Frieren (`anime=26334`):
 *
 *     <cast gid="1438955067" lang="DE">
 *       <role>Frieren</role>
 *       <person id="123456">Julia Casper</person>
 *     </cast>
 */
export function deutscheRollen(xml: string): AnnRolle[] {
  const rollen: AnnRolle[] = []
  for (const block of xml.matchAll(/<cast\b[^>]*\blang="DE"[^>]*>([\s\S]*?)<\/cast>/g)) {
    const character = /<role>([\s\S]*?)<\/role>/.exec(block[1])?.[1]
    const actor = /<person\b[^>]*>([\s\S]*?)<\/person>/.exec(block[1])?.[1]
    if (!character || !actor) continue
    rollen.push({ character: entschluesseln(character), actor: entschluesseln(actor) })
  }
  return rollen
}

/**
 * ANN liefert HTML-Entities mitten im XML — „Julia Casper" ist harmlos, aber
 * „Frieren&#039;s" nicht. Ohne diesen Schritt stünden Apostrophe als Zahlencode
 * in der Oberfläche.
 */
function entschluesseln(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim()
}

/**
 * Führt die Rollen beider Quellen zusammen.
 *
 * AniList steht vorn, weil dort die Rollenart (`MAIN`/`SUPPORTING`) mitkommt und
 * die Liste dadurch sinnvoll sortierbar ist. Doppelte werden über Figur **und**
 * Sprecher erkannt: Dieselbe Figur kann bei einer Neusynchronisation eine andere
 * Stimme haben, und beide Besetzungen sind richtig.
 */
export function rollenZusammenfuehren<T extends AnnRolle>(anilist: T[], ann: AnnRolle[]): (T | AnnRolle)[] {
  const schluessel = (r: AnnRolle) => `${r.character.toLowerCase()}|${r.actor.toLowerCase()}`
  const bekannt = new Set(anilist.map(schluessel))
  return [...anilist, ...ann.filter((r) => !bekannt.has(schluessel(r)))]
}
