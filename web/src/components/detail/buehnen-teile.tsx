import { FORMAT_DE } from '@shared/mappings.ts'
import type { FranchiseMember, Title } from '@shared/types.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { jpAngabe } from './kino.tsx'
import { WeitereTitel } from './weitere.tsx'

/** Das Cover und der Verlauf darüber — liegen hinter dem Kopfbereich der Bühne. */
export function BuehnenBildFlaeche({ buehnenBild }: { buehnenBild: string | undefined }) {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover"
        style={{
          backgroundImage: buehnenBild ? `url(${buehnenBild})` : undefined,
          backgroundPosition: '50% 10%',
          zIndex: -2,
        }}
      />
      {/*
        **Ein Verlauf, der erst in der unteren Hälfte anfängt.**

        Vorher lagen zwei übereinander — einer von oben, einer von links —
        und beide begannen sofort: Das Cover war schon in der ersten Zeile
        zur Hälfte abgedunkelt. Der von links ist ganz entfallen, denn er
        schob den Kontrast vom Titel weg, und der Titel liegt nicht mehr
        hier. Übrig bleibt der von unten, der bei 52 % transparent
        anfängt und in den Panel-Grund ausläuft — damit das Cover ohne
        Kante in die Seite übergeht.

        **Die Farben kommen aus `styles.css` und wechseln mit dem Thema** —
        fest eingetragen lag der dunkle Titel im hellen Thema auf einem
        dunklen Verlauf.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex: -1,
          background:
            'linear-gradient(180deg, transparent 0%, transparent 52%, var(--buehne-mitte) 78%, var(--buehne-unten) 92%, var(--panel-grund) 100%)',
        }}
      />
    </>
  )
}

/** Die Unterzeile auf dem Cover: Werkangaben und weitere Schreibweisen. */
export function BuehnenUnterzeile({ title, unterzeile, folgenImKasten, eigenerTeil, t }: {
  title: Title
  unterzeile: (string | undefined)[]
  folgenImKasten: boolean
  eigenerTeil: FranchiseMember | undefined
  t: Translate
}) {
  return (
    <>
      {/*
        Die Unterzeile überlappt das Cover — sie kostet damit keine eigene
        Höhe. In der Ecke wie die Bedienelemente gegenüber, gerundet nur
        zum Bild hin.

        **Die Schreibweisen stehen darin, nicht darunter** (Daniel,
        03.09.2026: „weitere schreibweisen unter subtitle schieben, selber
        container nächste zeile"). Als eigene Zeile im Inhaltsbereich
        kosteten sie 24 px für eine Angabe, die fast niemand aufklappt.
      */}
      {/*
        **Kein Kasten ohne Inhalt.**

        Die Unterzeile setzt sich aus vier Angaben zusammen — Format,
        Folgenzahl, Jahr, Studio. Fehlen alle vier, stand hier trotzdem
        ein grauer Balken über dem Cover: eine leere Fläche, die aussieht
        wie ein Ladefehler (Daniel, 04.09.2026, mit Bild; er konnte den
        Zustand nicht wiederholen, er trat beim Wechsel zwischen Tabs
        auf).

        Die Ursache ist damit nicht gefunden — sie steht als Aufgabe in
        `status.md`. Aber der sichtbare Schaden entsteht erst hier, und er
        gehört unabhängig von seiner Ursache verhindert: Ein Kasten, der
        nichts zu sagen hat, wird nicht gezeichnet.
      */}
      {unterzeile.length > 0 && (
      <div className="absolute left-0 top-0 z-10 max-w-[calc(100%-4rem)] rounded-br-lg bg-[rgba(8,12,18,.74)] px-2.5 py-1 backdrop-blur-[3px]">
      <p className="text-xs text-slate-300">
        {[
          title.format ? (FORMAT_DE[title.format] ?? title.format) : undefined,
          /*
            **„1 Folgen" gab es hier zu lesen** — bei „Venus Wars" stand
            „Film · 1 Folgen · JP 1989" (03.09.2026). Falsch in beidem: Der
            Plural stimmt nicht, und ein Film hat keine Folgen, sondern ist
            einer. Bei genau einer Einheit sagt das Format schon alles.
          */
          title.episodes && title.episodes > 1 && !folgenImKasten
            ? `${title.episodes} ${t('detail.episodes')}`
            : undefined,
          title.runtimeMin ? t(title.episodes && title.episodes > 1 ? 'detail.laufzeitJe' : 'detail.laufzeit', { n: title.runtimeMin }) : undefined,
          jpAngabe(eigenerTeil?.jpStart ?? (title.westlich ? title.jpStart : undefined), title.jpYear, title.land),
          title.studios?.[0],
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <WeitereTitel title={title} />
      </div>
      )}
    </>
  )
}
