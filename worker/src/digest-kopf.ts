import type { ReleaseEvent } from '../../shared/types.ts'
import { formatDate } from '../../shared/time.ts'
import type { DigestOptions, NeuMitSynchro } from './templates.ts'

/* Teile von `digestMail()`: Betreff, Kopfkästen, Fußzeile. */

/**
 * Der Betreff nennt zuerst, was den Leser wirklich betrifft — und nichts
 * betrifft ihn mehr als eine Serie, auf deren Synchro er gewartet hat.
 * Deshalb steht das vor allem anderen, auch vor den Favoriten-Folgen.
 *
 * **Seit dem 28.09.2026 auch Finale und TV-Premiere**. Vorher zählte der Betreff Releases —
 * „Heute mit deutscher Synchro: 6 Releases" —, und darunter standen fünf Wiederholungen.
 */
export function digestBetreff({ neu, neuGemerkt, neuAusReihe, auchBei, mine, rest, meine, events, frequency }: {
  neu: NeuMitSynchro[]
  neuGemerkt: NeuMitSynchro[]
  neuAusReihe: NeuMitSynchro[]
  auchBei: NonNullable<DigestOptions['auchBei']>
  mine: ReleaseEvent[]
  rest: ReleaseEvent[]
  meine: ReleaseEvent[]
  events: ReleaseEvent[]
  frequency: 'daily' | 'weekly'
}): string {
  const finaleHeute = meine.find((e) => e.staffelfinale)
  const premiereHeute =
    meine.find((e) => e.platform === 'tv' && e.tvPremiere) ?? rest.find((e) => e.platform === 'tv' && e.tvPremiere)
  return neu.length > 0
      ? neuGemerkt.length === 0 && neuAusReihe.length === 1
        ? `Neu in deiner Reihe: ${neuAusReihe[0].name}`
        : neu.length === 1
          ? `${neu[0].name} bekommt eine deutsche Synchro`
          : `${neu.length} Neuzugänge zu deinen gemerkten Titeln`
      : auchBei.length > 0 && mine.length === 0 && events.length === 0
        ? auchBei.length === 1
          ? `${auchBei[0].name} jetzt auch bei ${auchBei[0].anbieter}`
          : `${auchBei.length} Favoriten jetzt bei weiteren Anbietern`
        : finaleHeute
          ? `Finale bei ${finaleHeute.name}`
          : premiereHeute
            ? `TV-Premiere: ${premiereHeute.name}`
            : mine.length > 0
              ? `${mine.length} ${mine.length === 1 ? 'Folge' : 'Folgen'} deiner Favoriten${
                  rest.length ? ` und ${rest.length} weitere Releases` : ''
                }`
              : frequency === 'daily'
                ? `Heute mit deutscher Synchro: ${events.length} ${events.length === 1 ? 'Release' : 'Releases'}`
                : `Diese Woche mit deutscher Synchro: ${events.length} ${events.length === 1 ? 'Release' : 'Releases'}`
}

/** Die Kästen ganz oben: neue Synchro, Neues aus Reihen, weitere Anbieter. */
export function neuBloecke({ neu, neuGemerkt, neuAusReihe, auchBei, siteUrl }: {
  neu: NeuMitSynchro[]
  neuGemerkt: NeuMitSynchro[]
  neuAusReihe: NeuMitSynchro[]
  auchBei: NonNullable<DigestOptions['auchBei']>
  siteUrl: string
}): string {
  /**
   * Die Nachricht ganz oben, in Grün und mit eigenem Kasten.
   *
   * Sie unterscheidet sich in einem Punkt vom Rest der Mail: Hier steht nicht,
   * *wann* etwas läuft, sondern *dass* es die Sache überhaupt gibt. Wer den
   * Titel gemerkt hat, hat womöglich Monate darauf gewartet — das verdient
   * mehr als eine Zeile in einer Terminliste.
   */
  /*
    **Zwei Bloecke, weil es zwei Nachrichten sind.**

    Der erste ist die Nachricht, auf die jemand gewartet hat: Ein gemerkter
    Titel hat jetzt eine deutsche Fassung. Der zweite ist die, von der er noch
    nicht wusste, dass er auf sie wartet — eine neue Staffel, ein Film, ein
    Special zu einer Reihe, von der er etwas gemerkt hat.

    Der zweite Block erklaert sich selbst. Ohne den Satz „weil du … gemerkt
    hast" wirkt ein fremder Titel in einer Favoriten-Mail wie ein Versehen.
  */
  const eintrag = (n: NeuMitSynchro) =>
    `<p style="margin:0 0 8px;padding:11px 13px;background:#10251d;border-left:3px solid #34d399;border-radius:0 8px 8px 0;">
       <a href="${siteUrl}#/datenbank?t=${n.id}" style="color:#e2e8f0;font-weight:700;text-decoration:none;font-size:15px;">${n.name}</a><br>
       <span style="color:#9aa5bd;font-size:13px;">${
         n.termin ? `Erster deutscher Termin: ${formatDate(n.termin)}` : 'Angekündigt — ein Termin steht noch aus.'
       }</span>
     </p>`

  const neuBlock = neuGemerkt.length
    ? `<p style="margin:0 0 6px;padding-bottom:6px;border-bottom:2px solid #34d399;color:#34d399;font-weight:700;font-size:15px;letter-spacing:.03em;">
         🎉 Endlich: deutsche Synchro
       </p>
       <p style="margin:0 0 10px;color:#9aa5bd;font-size:13px;">
         ${neuGemerkt.length === 1 ? 'Ein Titel, den du gemerkt hast, hat' : `${neuGemerkt.length} Titel, die du gemerkt hast, haben`}
         jetzt eine belegte deutsche Fassung.
       </p>
       ${neuGemerkt.map(eintrag).join('')}`
    : ''

  const reihenBlock = neuAusReihe.length
    ? `<p style="margin:0 0 6px;padding-bottom:6px;border-bottom:2px solid #60a5fa;color:#60a5fa;font-weight:700;font-size:15px;letter-spacing:.03em;">
         ✨ Neu in deinen Reihen
       </p>
       <p style="margin:0 0 10px;color:#9aa5bd;font-size:13px;">
         ${neuAusReihe.length === 1 ? 'Ein neuer Teil einer Reihe' : `${neuAusReihe.length} neue Teile von Reihen`},
         von denen du etwas gemerkt hast.
       </p>
       ${neuAusReihe.map(eintrag).join('')}`
    : ''

  /* Ein weiterer Weg zu einer Synchro, die es schon gab — kleiner als „Endlich". */
  const auchBlock = auchBei.length
    ? `<p style="margin:${neu.length ? '22px' : '0'} 0 6px;padding-bottom:6px;border-bottom:2px solid #a78bfa;color:#a78bfa;font-weight:700;font-size:15px;letter-spacing:.03em;">
         📺 Jetzt auch bei
       </p>
       ${auchBei
         .map(
           (a) =>
             `<p style="margin:0 0 6px;color:#cbd5e1;font-size:14px;"><a href="${siteUrl}#/datenbank?t=${a.id}" style="color:#e2e8f0;font-weight:700;text-decoration:none;">${a.name}</a> — jetzt auch auf Deutsch bei ${a.anbieter}</p>`,
         )
         .join('')}`
    : ''

  return neuBlock + reihenBlock + auchBlock
}

/** Fußzeile der Mail: Rhythmus, Abbestellen, Datenschutz. */
export function digestFuss(rhythmus: { name: string; wann: string; andere: string }, options: DigestOptions, siteUrl: string, unsubUrl: string): string {
  // Welche Mail das hier ist, gehört hinein: Wer sie seit Monaten bekommt,
  // weiß sonst nicht mehr, ob er den täglichen oder den wöchentlichen
  // Rhythmus gewählt hat — und findet auch nicht, wo er das ändert.
  return `Das hier ist der <strong style="color:#cbd5e1;">${rhythmus.name}</strong> — er kommt ${rhythmus.wann}.
     Du erhältst ihn, weil du das Abo bestätigt hast.<br>
     <a href="${options.rhythmusUrl ?? `${siteUrl}#/newsletter`}" style="color:#7dd3fc;">${
       options.rhythmusUrl ? `Auf ${rhythmus.andere} umstellen` : 'Rhythmus ändern'
     }</a> ·
     <!-- „Abmelden" allein sagt nicht, wovon — in einer Mail mit mehreren Links
          daneben liest es sich wie „vom Kalender abmelden" oder wie ein
          Ausloggen. Daniel hat am 18.08.2026 alle Fußzeilen-Links durchgeklickt
          und dabei sein Abo beendet, ohne es zu wollen. -->
     <a href="${unsubUrl}" style="color:#7dd3fc;">Newsletter abbestellen</a> ·
     <a href="${siteUrl}#/datenschutz" style="color:#7dd3fc;">Datenschutz</a>${
       options.syncUrl ? `<br><a href="${options.syncUrl}" style="color:#7dd3fc;">Dieses Gerät mit dem Newsletter verbinden</a>` : ''
     }`
}
