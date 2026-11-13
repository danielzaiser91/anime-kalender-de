import { werkTitel } from './titel-hilfen.ts'
import { log } from '../lib/util.ts'
import { type TitelDe } from '../lib/titel-de.ts'
import { type Title } from '../../shared/types.ts'

export function uebernehmeTitelDeVonHand({ handTitel, titles }: {
  handTitel: TitelDe[]
  titles: Map<number, Title>
}) {
  /*
    **Von Hand geprüfte deutsche Werktitel — sie schlagen jede Quelle.**

    Am 16.09.2026 standen 132 Titel ohne deutschen Namen da, 57 davon mit
    belegter deutscher Fassung (Sprechrollen, deutsche Erstausgabe oder ein
    Verweis mit `dub: true`) — die haben also einen, wir kannten ihn nur nicht.
    Beide automatischen Quellen sind dort erschöpft: aniSearch führt für die 54
    archivierten Seiten drei deutsche Sprachblöcke und keinen Namen darin, TMDB
    fällt bei `language=de-DE` still auf den Originaltitel zurück.

    `data/titel-de.yaml` ist die dritte Stufe, dieselbe wie bei der Synchro:
    nachgesehen, mit zwei Quellen belegt, mit Datum. Sie steht vor den beiden
    automatischen Runden, damit ein geprüfter Name nicht von einer Datenbank
    überschrieben wird.
  */
  let deutscheTitelHand = 0
  for (const eintrag of handTitel) {
    const title = titles.get(eintrag.id)
    if (!title || !eintrag.titleDe) continue
    title.titleDe = werkTitel(eintrag.titleDe)
    deutscheTitelHand++
  }
  if (deutscheTitelHand) log(`${deutscheTitelHand} deutsche Titel aus data/titel-de.yaml übernommen`)
}
