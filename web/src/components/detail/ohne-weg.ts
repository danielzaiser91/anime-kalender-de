import type { OhneWegEintrag, OhneWegGrund } from '@shared/ohne-weg.ts'
import { formatDate } from '@shared/time.ts'
import { loadJson } from '../../lib/data.ts'

/*
  Die Sätze stehen hier und nicht in `TEXTE` (`i18n.tsx`): Dieses Modul gehört zum Detail-Panel-Chunk, `TEXTE` zum Start-Chunk —
  jedes Wort dort kostet jeden Erstbesucher Bytes (Start-Budget), diese Zeile sieht nur, wer ein Panel ohne Streaming-Weg öffnet.
*/
const OFFEN = 'Ein Streaming-Angebot ist noch nicht belegt.'
const SAETZE: Record<Exclude<OhneWegGrund, 'angekuendigt' | 'offen'>, string> = {
  'kein-dub': 'Bisher nur im Originalton gefunden, geprüft am {datum}.',
  'nur-kauf': 'Laut JustWatch nur zum Kaufen oder Leihen, geprüft am {datum}.',
  'film-ohne-abo': 'Laut JustWatch kein Streaming-Angebot, geprüft am {datum}.',
  'abo-ohne-ton': 'Laut JustWatch im Stream ohne deutschen Ton, geprüft am {datum}.',
  'abo-andere-staffel': 'Laut JustWatch gehört das deutsche Abo zu einer anderen Staffel, geprüft am {datum}.',
  'kein-angebot': 'Kein Angebot gefunden (geprüft am {datum}).',
  'nur-disc': 'Auf DVD oder Blu-ray erschienen, Streaming bisher nicht gefunden, geprüft am {datum}.',
}

/**
 * Der Satz zum Grund; ein Grund ohne Tag (Datei kaputt) sagt nur, dass nichts belegt ist — nie ein Datum erfinden.
 * `angekuendigt` hat keinen Satz: Der Starttag steht schon im Kasten (Banner, „Streamstart noch nicht bekannt“), eine zweite Zeile sagte dasselbe.
 */
export function ohneWegText(e: OhneWegEintrag): string | undefined {
  if (e.reason === 'angekuendigt') return undefined
  const datum = e.checkedAt
  if (e.reason === 'offen' || !datum) return OFFEN
  return SAETZE[e.reason].replace('{datum}', () => formatDate(datum))
}

let ohneWegPromise: Promise<Record<number, OhneWegEintrag>> | undefined

/** Warum ein Titel keinen Streaming-Weg hat (`ohne-weg.json`) — eine Datei für alle, erst geladen, wenn ein Titel ohne Weg offen ist. */
export function loadOhneWeg(titleId: number): Promise<OhneWegEintrag | undefined> {
  ohneWegPromise ??= loadJson<Record<number, OhneWegEintrag>>('ohne-weg.json').catch(() => ({}))
  return ohneWegPromise.then((alle) => alle[titleId])
}
