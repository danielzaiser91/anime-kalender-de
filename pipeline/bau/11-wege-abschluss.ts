import { type DubCheck } from '../lib/dub-confirmed.ts'
import { type Title, type Release } from '../../shared/types.ts'
import { type EntfernterVerweis } from './grundlagen.ts'
import { type AnisearchEintrag } from './01-quellen.ts'
import { fuehreAusgabenZusammen } from './11-4-ausgaben.ts'
import { bereinigeWege } from './11-3-bereinigung.ts'
import { streicheMagentaPartner } from './11-5-magenta-partner.ts'
import { kennzeichneDeutschLautJustwatch } from './11-6-jw-vertrauen.ts'
import { ergaenzeWegeAusJustwatch } from './11-2-justwatch.ts'
import { ergaenzeWegeAusTerminen } from './11-7-wege-aus-terminen.ts'
import { kennzeichneFreenetLautSchwester } from './11-8-schwester-shop.ts'
import { sichereKapitelShopWege, verwirfKapitelShopWege } from './11-9-kapitel-shop.ts'
import { uebernehmeFskAusJustwatch } from './11-2-1-fsk-justwatch.ts'
import { ergaenzeDiscUndZugang } from './11-1-disc-und-zugang.ts'
import { entferneFremdeNachStaffeln, kennungAusAdresse, type CrStaffel } from './cr-serie-geteilt.ts'
import { ANISEARCH_ID_BASIS } from './anisearch-titel.ts'
import { setzeCoverNachRegel } from './cover-regel.ts'
import { setzeProduktFelder } from './produkt-regel.ts'
import { log } from '../lib/util.ts'
import { entferneBezugswegeTrotzNein } from '../lib/handbeleg-bezugswege.ts'
import { behalteNurHandbelegteWege } from '../lib/handbeleg-weg.ts'

export function schliesseWegeAb({
  titles,
  anisearch,
  releases,
  zugangJeAdresse,
  tmdbMehrdeutig,
  toteAdressen,
  linkBefunde,
  verweiseEntfernt,
  crAdresseZu,
  beantworteteSuchen,
  suchOffen,
  alleChecks,
  lautPruefungTot,
  checksJePlattform,
  belegFuer,
}: {
  titles: Map<number, Title>
  anisearch: Record<string, AnisearchEintrag>
  releases: Release[]
  zugangJeAdresse: Map<string, 'abo' | 'kauf'>
  tmdbMehrdeutig: Set<string>
  toteAdressen: Set<string>
  linkBefunde: Record<string, { status: number | string; prime?: boolean; geprueftAm?: string; }>
  verweiseEntfernt: EntfernterVerweis[]
  crAdresseZu: (name: string) => string | undefined
  beantworteteSuchen: Set<string>
  suchOffen: { id: number; titel: string; plattform: string; url: string; }[]
  alleChecks: DubCheck[]
  lautPruefungTot: (url: string) => boolean
  checksJePlattform: Map<string, DubCheck[]>
  belegFuer: Parameters<typeof ergaenzeWegeAusTerminen>[0]['belegFuer']
}) {
  ergaenzeDiscUndZugang({ titles, anisearch, releases, zugangJeAdresse })

  fuelleWegeAusJustwatch({ titles, tmdbMehrdeutig, toteAdressen })
  uebernehmeFskAusJustwatch({ titles, tmdbMehrdeutig })

  bereinigeWege({
    titles,
    anisearch,
    toteAdressen,
    linkBefunde,
    verweiseEntfernt,
    crAdresseZu,
    beantworteteSuchen,
    suchOffen,
  })

  streicheMagentaPartner(titles)

  /*
    **Titel nur bei aniSearch tragen keine Wege, die der Name erraten hat** (07.10.2026: „Sword Art Online II: Debriefing" und acht weitere bekamen über den Namen die Crunchyroll-Serie
    ihrer Hauptfassung — samt „Neu auf Deutsch bei Crunchyroll" in den News). Eine Kennung bei aniSearch belegt, dass es den Titel gibt, nicht, wo er läuft.
  */
  for (const t of titles.values()) if (t.id >= ANISEARCH_ID_BASIS) behalteNurHandbelegteWege(t, alleChecks)

  /* Die Wege aus JustWatch und aniSearch kommen nach der Katalog-Runde noch einmal dazu: Was keiner Staffel der Serie entspricht, fliegt hier endgültig (07.10.2026). */
  const fremd = entferneFremdeNachStaffeln(titles, kennungAusAdresse())
  if (fremd) log(`${fremd} Crunchyroll-Wege nach dem Abschluss entfernt: sie gehören keiner Staffel der Serie`)

  fuehreAusgabenZusammen({ alleChecks, titles, tmdbMehrdeutig, anisearch, lautPruefungTot, checksJePlattform })
  kennzeichneDeutschLautJustwatch({ titles, tmdbMehrdeutig, alleChecks })

  /* Zuletzt: Wer einen sicheren Termin bei einem Anbieter hat, aber noch keinen Weg dorthin, bekommt einen. Ohne Tonurteil, außer ein Handbeleg gilt: dann dessen Urteil, bei „nicht verfügbar“ kein Weg. */
  ergaenzeWegeAusTerminen({ titles, releases, toteAdressen, verweiseEntfernt, belegFuer })

  kennzeichneFreenetLautSchwester(titles)

  entferneBezugswegeTrotzNein(titles, alleChecks)

  sichereKapitelShopWege(titles)

  // Das Cover steht nach allen Wege-Änderungen fest und vor `baueMeta`, damit Hauptbestand, Verschobene, Reihen und Meldungen dasselbe Bild sehen.
  setzeCoverNachRegel(titles)
  setzeProduktFelder(titles)
}

/**
 * JustWatch füllt Lücken erst, nachdem die Serien-Wege weg sind, die keiner Staffel ihrer Serie entsprechen.
 * Sonst besetzt der falsche Weg den Crunchyroll-Platz, den JustWatch mit der eigenen Film-Adresse füllen würde
 * (Kabaneri-Zusammenfassungsfilme zeigten auf die Serienseite und standen danach ganz ohne Weg da).
 */
export function fuelleWegeAusJustwatch({ titles, tmdbMehrdeutig, toteAdressen, staffeln }: {
  titles: Map<number, Title>
  tmdbMehrdeutig: Set<string>
  toteAdressen: Set<string>
  staffeln?: Map<string, CrStaffel[]>
}) {
  const fremd = entferneFremdeNachStaffeln(titles, kennungAusAdresse(), staffeln)
  if (fremd) log(`${fremd} Crunchyroll-Wege vor der Ergänzung aus JustWatch entfernt: sie gehören keiner Staffel der Serie`)
  ergaenzeWegeAusJustwatch({ titles, tmdbMehrdeutig, toteAdressen })
  verwirfKapitelShopWege(titles)
}
