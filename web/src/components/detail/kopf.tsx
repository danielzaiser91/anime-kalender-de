import { TrailerKino } from './kino.tsx'
import { anzeigeName } from '@shared/titles.ts'
import { AniSearchVerweis } from './pillen.tsx'
import { type FranchiseMember, type Title, type Release } from '@shared/types.ts'
import type { JSX } from 'react'

export function PanelKopf({ bewertung, reihenTeile, teilName, reihenName, title, kinoRelease }: {
  bewertung: JSX.Element | null
  reihenTeile: FranchiseMember[]
  teilName: string
  reihenName: string
  title: Title
  kinoRelease: Release
}) {
  return (
    <>
      <div className="relative -mt-24 flex flex-col gap-3 p-4">
        {/*
          Der Reihenname steht **über** dem Karussell, der gewählte Teil
          darunter (Daniel, 15.08.2026: „ich hab s3 ausgewählt, es ist kaum
          erkennbar… das ist der wichtigste teil").

          Vorher trugen beide Zeilen denselben Reihennamen, und welcher Teil
          gerade offen war, stand nur als blauer Rahmen an einer der
          Vorschaukarten — bei acht Karten nebeneinander ein Rahmen zu viel,
          um ihn zu bemerken. Jetzt beantwortet die Zeile unter dem Karussell
          die Frage im Klartext: „Staffel 3".

          Die beiden Bedienelemente teilen sich entsprechend auf: Der
          Reihen-Stern gehört zur Reihe und steht oben, Stern und Auge
          gehören zum gewählten Teil und stehen unten. Das ersetzt zugleich
          die frühere absolute Positionierung — zwei Sterne übereinander
          brauchte es nur, solange beide in derselben Zeile hingen.
        */}
        {/*
          Titel und Bedienelemente stehen seit dem 24.08.2026 auf der Bühne
          weiter oben. Hier stand bis dahin beides — der Reihenname als
          Überschrift und daneben Teilen, Auge, Stern und Reihen-Stern.

          Die frühere Begründung dafür bleibt gültig und ist mit umgezogen:
          Die Bedienelemente gehören an den Anfang des Kopfbereichs, nicht
          unter das Karussell, wo sie bei einem Einzeltitel eine eigene Zeile
          für zwei Symbole gebraucht hätten.
        */}


        <div className="min-w-0 flex-1">
          {/*
            Die zweite Titelzeile entfällt, wenn sie nur die erste wiederholt.

            Bei „Banana Fish" stand der Name viermal untereinander: als
            Reihenname über dem Karussell, hier noch einmal, und darunter als
            Umschrift und in Originalschrift — dreimal davon identisch
            (Daniel, 15.08.2026: „banana fish steht dort 3x"). Ein Titel ohne
            weitere Reihenteile hat schlicht keinen unterscheidenden Zusatz;
            dann trägt ihn die Zeile über dem Karussell allein.
          */}
          {/*
            **Die Wertung steht vor dem Namen, nicht darunter.**

            Sie war eine eigene Zeile unter dem Staffelnamen — 24 px für eine
            Pille, die neben ihn passt (Daniel, 03.09.2026: „Rating vor
            ,Staffel 1'"). `items-baseline` setzt sie auf die Schriftlinie des
            Namens statt an seine Oberkante.
          */}
          {/*
            **Der aniSearch-Verweis steht rechts in derselben Zeile.**

            Daniel am 07.09.2026: „hier im grün markierten bereich wäre platz
            für ein AniSearch Link. mach das" — und gleich danach der
            Geltungsbereich: „anisearch link für alle titel dort einfügen wo
            wir anisearch links haben, ansonsten anisearch search seite mit dem
            titel da einfügen. überall soll da ein link sein."

            Deshalb wird die Zeile jetzt **immer** gerendert, nicht mehr nur
            bei einem Reihenteil mit eigenem Namen. Der Staffelname darin folgt
            weiter seiner alten Bedingung; ohne ihn bleibt eine Zeile aus
            Wertung links und Verweis rechts — beides Angaben, die vorher
            entweder gar nicht oder nur an einer Stelle standen.
          */}
          <div className="flex flex-wrap items-baseline gap-2">
            {bewertung}
            {reihenTeile.length > 1 && teilName !== reihenName && (
              <h3 className="min-w-0 flex-1 text-xl font-bold leading-tight text-slate-900 dark:text-white">
                {teilName}
              </h3>
            )}
            {/*
              **Der Trailer steht bei den Angaben zum Werk, nicht bei den
              Anbietern.** Er beantwortet eine andere Frage als „wo kann ich
              das sehen" — nämlich „will ich das überhaupt".
            */}
            {(title.trailer || kinoRelease) && <TrailerKino trailer={title.trailer} titel={anzeigeName(title)} />}
            <AniSearchVerweis title={title} />
          </div>
          {/*
            Die Pillen-Zeile trug nur noch die Wertung — Status und FSK sind
            seit dem 13.08.2026 im Terminblock, wo sie je Release gelten. Eine
            eigene Zeile für eine einzelne Pille ist Platz ohne Auskunft; sie
            steht jetzt neben dem Staffelnamen (siehe `bewertung` oben).
          */}
          {/*
            Format, Jahr und Studio stehen seit dem 24.08.2026 in der Bühne,
            direkt unter dem Titel — dieselbe Angabe zweimal im selben Bild
            wäre eine Zeile für nichts.

            Die Genres sind ans Ende gewandert, in den Details-Bereich. Ihre
            Begründung vom 12.08.2026 bleibt gültig — sie beantworten „ist das
            überhaupt meins?" —, aber diese Frage stellt sich **nach** der,
            wegen der jemand das Panel öffnet: wann kommt es, wo läuft es. Wer
            den Titel schon kennt, überspringt die Genres ohnehin.
          */}
        </div>
      </div>
    </>
  )
}
