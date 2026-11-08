/**
 * **OmU-Begleiter: Der deutsche Termin kommt, sobald der Katalog die Folge führt** (Black Clover Staffel 2, 07.11.2026).
 *
 * Trägt der einzige Crunchyroll-Termin einer Staffel `sprache: 'omu'` und führt der deutsche Katalog datierte Folgen genau dieser
 * Staffel, entsteht daneben ein `<slug>-synchro`-Termin. Ohne ihn trug der Weg „deutsch“, während jeder Termin „nur OmU“ sagte,
 * und `deutschNurAusSpracheTermin` brach den ganzen Bau ab (Läufe 42389332341 bis 42409615936: 4 Rücknahmen, live 21:39 statt ~17:20).
 *
 * Der Begleiter hängt nicht an der Ableitung `termineAusSerie`: Bei geteilten Serien trägt dort nur ein Frischefenster von 21 Tagen,
 * danach wäre der Bau wieder rot. Ein Hand-Eintrag oder ein abgeleiteter Termin ohne `sprache` am selben Titel hat Vorrang.
 * Hinweis: Bei einer geteilten Serie löst ab Tag 22 der Begleiter (`-synchro`) den abgeleiteten Termin ab; der Slug wechselt dann.
 */
import { crunchyrollSeriesId } from '../lib/crunchyroll.ts'
import type { CrDubData, CrSerie, CrStaffel } from '../lib/crunchyroll-dub.ts'
import { crHerkunft } from '../lib/cr-batch-wache.ts'
import { nachBerlin } from '../lib/crunchyroll-termine.ts'
import { log } from '../lib/util.ts'
import type { Release, Title } from '../../shared/types.ts'
import { STAFFEL_IM_NAMEN, katalogStaffeln } from './widerlegung-staffel.ts'

/** Zahl der Releases je Ausgang, damit kein Verwerfungspfad still bleibt. */
export interface BegleiterZaehlung {
  erzeugt: number
  ohneBlock: number
  vorOmuStart: number
  handVorhanden: number
}

interface DeutscheFolge {
  tag: string
  zeit: string
  laufend?: number
}

/** Der eine Katalogblock der Staffel, die zu `title` passt, samt Serienadresse — `null`, wenn keiner oder mehrere passen. */
function katalogBlock(serien: CrSerie[], kennung: string, nummern: number[]): { block: CrStaffel; url: string } | null {
  const treffer = serien
    .filter((s) => s.katalog === 'de' && s.seriesId === kennung)
    .flatMap((s) => (s.staffeln ?? []).map((block) => ({ block, url: s.url })))
    .filter(({ block }) => nummern.includes(Number(STAFFEL_IM_NAMEN.exec(block.name)?.[1])))
    .filter(({ block }) => (block.deutscheFolgen ?? []).some((f) => f.verfuegbarAb))
  const namen = new Set(treffer.map((t) => t.block.name))
  return namen.size === 1 ? treffer[0]! : null
}

/** Die datierten deutschen Folgen eines Blocks mit Berliner Tag und Uhrzeit. */
function datierteFolgen(block: CrStaffel): DeutscheFolge[] {
  const raus: DeutscheFolge[] = []
  for (const f of block.deutscheFolgen ?? []) {
    const b = f.verfuegbarAb ? nachBerlin(f.verfuegbarAb) : null
    if (b) raus.push({ tag: b.datum, zeit: b.zeit, laufend: f.laufend })
  }
  return raus
}

/** Der Begleiter-Termin aus den Folgen ab dem OmU-Start; ohne Folgenzahl (die Länge der laufenden Staffel ist offen). */
function begleiterTermin(omu: Release, title: Title, block: CrStaffel, url: string, folgen: DeutscheFolge[]): Release {
  const tage = folgen.map((f) => f.tag).sort()
  const zeiten = new Set(folgen.map((f) => f.zeit))
  const beobachtet = Object.fromEntries(folgen.filter((f) => (f.laufend ?? 0) >= 1).map((f) => [f.laufend!, f.tag]))
  return {
    slug: `${omu.slug}-synchro`,
    titleId: omu.titleId,
    name: omu.name,
    platform: 'crunchyroll',
    platformUrl: omu.platformUrl,
    releaseType: 'weekly',
    schedule: {
      firstEpisodeDate: tage[0]!,
      ...(zeiten.size === 1 ? { time: [...zeiten][0] } : {}),
      ...(Object.keys(beobachtet).length ? { observed: beobachtet } : {}),
    },
    fsk: title.fsk,
    herkunft: `${crHerkunft(folgen.length, block.name)}, Begleiter zum OmU-Termin`,
    year: Number(tage[0]!.slice(0, 4)),
    sources: [url],
  }
}

/**
 * Legt zu jedem Crunchyroll-Termin mit `sprache: 'omu'` ohne deutsches Gegenstück den Synchro-Termin an (`sprache: 'offen'` bleibt unberührt)
 * und gibt zurück, wie viele Termine entstanden oder aus welchem Grund keiner.
 */
export function legeOmuBegleiterAn(releases: Release[], titles: Map<number, Title>, crDub: CrDubData): BegleiterZaehlung {
  const z: BegleiterZaehlung = { erzeugt: 0, ohneBlock: 0, vorOmuStart: 0, handVorhanden: 0 }
  for (const omu of releases.filter((r) => r.platform === 'crunchyroll' && r.sprache === 'omu')) {
    const gegenstueck = releases.some((r) => r.platform === 'crunchyroll' && r.sprache === undefined && r.titleId === omu.titleId)
    if (gegenstueck) {
      z.handVorhanden++
      continue
    }
    const title = titles.get(omu.titleId)
    const kennung = crunchyrollSeriesId(omu.platformUrl)
    const gefunden = title && kennung ? katalogBlock(crDub.serien, kennung, katalogStaffeln(title, titles, kennung)) : null
    if (!title || !gefunden) {
      z.ohneBlock++
      continue
    }
    const folgen = datierteFolgen(gefunden.block).filter((f) => f.tag >= omu.schedule.firstEpisodeDate)
    if (!folgen.length) {
      z.vorOmuStart++
      continue
    }
    releases.push(begleiterTermin(omu, title, gefunden.block, gefunden.url, folgen))
    z.erzeugt++
  }
  return z
}

/** Wie `legeOmuBegleiterAn`, dazu die Zählzeile im Bau-Log (nur wenn es überhaupt einen OmU-Termin gab). */
export function legeOmuBegleiterAnUndMelde(releases: Release[], titles: Map<number, Title>, crDub: CrDubData): BegleiterZaehlung {
  const z = legeOmuBegleiterAn(releases, titles, crDub)
  if (z.erzeugt + z.ohneBlock + z.vorOmuStart + z.handVorhanden) {
    log(`OmU-Begleiter: ${z.erzeugt} erzeugt, ${z.ohneBlock} ohne Block, ${z.vorOmuStart} mit Folgen nur vor dem OmU-Start, ${z.handVorhanden} mit Gegenstück am Titel`)
  }
  return z
}
