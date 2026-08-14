import type { ReleaseEvent } from '../../shared/types.ts'
import { PLATFORMS, RELEASE_TYPES } from '../../shared/types.ts'
import { formatDate, weekdayName } from '../../shared/time.ts'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Absender und Kopfzeile der beiden Mail-Arten, die dieser Worker verschickt.
 *
 * Sie kommen aus derselben Adresse — `send.anime-kalender.de` ist die einzige
 * bei Resend verifizierte Domain —, aber sie haben nichts miteinander zu tun:
 * Der Newsletter geht an Abonnenten, die Erreichbarkeitsprüfung geht an den
 * Betreiber und überwacht **alle** Projekte, nicht nur den Kalender. Solange
 * beide „Anime-Kalender DE" im Kopf trugen, war die Wochenübersicht im
 * Posteingang nicht vom Digest zu unterscheiden (10.08.2026, beim Suchen des
 * Abmeldelinks in der falschen Mail aufgefallen).
 */
export const BRAND = {
  newsletter: { icon: '📺', name: 'Anime-Kalender DE' },
  monitor: { icon: '🛰️', name: 'Seiten-Wächter' },
} as const

type Brand = (typeof BRAND)[keyof typeof BRAND]

const SHELL = (
  title: string,
  body: string,
  footer: string,
  brand: Brand = BRAND.newsletter,
) => `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#0f1420;padding:24px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:600px;background:#161c2b;border-radius:14px;overflow:hidden;">
<tr><td style="padding:20px 24px;background:#1d2536;">
  <span style="font-size:20px;">${brand.icon}</span>
  <span style="color:#fff;font-size:17px;font-weight:700;margin-left:6px;">${escapeHtml(brand.name)}</span>
</td></tr>
<tr><td style="padding:24px;color:#d7dced;font-size:15px;line-height:1.6;">${body}</td></tr>
<tr><td style="padding:16px 24px;background:#121826;color:#7c879e;font-size:12px;line-height:1.6;">${footer}</td></tr>
</table></td></tr></table></body></html>`

/**
 * Bestätigungsmail — in zwei Fassungen.
 *
 * `aenderung` gilt, wenn die Adresse **bereits ein aktives Abo** hat und
 * jemand das Anmeldeformular erneut damit abgeschickt hat. Für den Empfänger
 * ist das ein völlig anderer Vorgang: Er hat ein laufendes Abo, und jemand —
 * womöglich er selbst auf einem anderen Gerät, womöglich ein Fremder — möchte
 * daran etwas ändern. Die Mail muss deshalb zwei Dinge unmissverständlich
 * sagen: Was sich ändern würde, und dass **Nichtstun sicher ist**.
 *
 * Der Unterschied ist nicht kosmetisch. Bis zum 14.08.2026 wurden die
 * Änderungen sofort wirksam, und diese Mail war nur eine Benachrichtigung nach
 * getaner Tat — wer sie ignorierte, behielt fremde Einstellungen. Jetzt
 * passiert ohne Klick nichts, und genau das muss dastehen, sonst klickt jemand
 * aus Sorge auf einen Link, den ein Fremder ausgelöst hat.
 */
export function confirmMail(
  confirmUrl: string,
  aenderung = false,
): { subject: string; html: string; text: string } {
  if (aenderung) {
    const subject = 'Änderung an deinem Newsletter bestätigen'
    const html = SHELL(
      subject,
      `<p style="margin:0 0 14px;">Für diese Adresse besteht bereits ein Abo, und es wurde eine
       <strong style="color:#e2e8f0;">Änderung angefordert</strong> — an Rhythmus, Plattformauswahl
       oder gemerkten Titeln.</p>
       <p style="margin:0 0 14px;">Warst du das, bestätige sie mit einem Klick. Bis dahin bleibt
       dein Abo <strong style="color:#e2e8f0;">unverändert</strong>.</p>
       <p style="margin:0 0 20px;"><a href="${confirmUrl}"
         style="display:inline-block;background:#38bdf8;color:#06121d;text-decoration:none;padding:11px 20px;border-radius:9px;font-weight:700;">
         Änderung übernehmen</a></p>
       <p style="margin:0;color:#9aa5bd;font-size:13px;">Falls der Knopf nicht geht:<br>
       <a href="${confirmUrl}" style="color:#7dd3fc;word-break:break-all;">${confirmUrl}</a></p>`,
      'Warst du das nicht, ignoriere diese Mail einfach. Ohne deinen Klick ändert sich nichts, und dein Abo läuft unverändert weiter.',
    )
    const text =
      `Für diese Adresse besteht bereits ein Abo, und es wurde eine Änderung angefordert.\n` +
      `Bis zu deinem Klick bleibt alles, wie es ist.\n\n` +
      `Änderung übernehmen: ${confirmUrl}\n\n` +
      `Warst du das nicht, ignoriere diese Mail — ohne deinen Klick ändert sich nichts.`
    return { subject, html, text }
  }

  const subject = 'Bitte bestätige deine Newsletter-Anmeldung'
  const html = SHELL(
    subject,
    `<p style="margin:0 0 14px;">Fast geschafft. Ein Klick noch, dann bekommst du die anstehenden
     Anime-Releases mit deutscher Synchro per Mail.</p>
     <p style="margin:0 0 20px;"><a href="${confirmUrl}"
       style="display:inline-block;background:#38bdf8;color:#06121d;text-decoration:none;padding:11px 20px;border-radius:9px;font-weight:700;">
       Anmeldung bestätigen</a></p>
     <p style="margin:0;color:#9aa5bd;font-size:13px;">Falls der Knopf nicht geht:<br>
     <a href="${confirmUrl}" style="color:#7dd3fc;word-break:break-all;">${confirmUrl}</a></p>`,
    'Diese Mail wurde angefordert. Warst du das nicht, ignoriere sie einfach — ohne Bestätigung wird nichts gespeichert.',
  )
  const text = `Anmeldung bestätigen: ${confirmUrl}\n\nWarst du das nicht, ignoriere diese Mail — ohne Bestätigung wird nichts gespeichert.`
  return { subject, html, text }
}

/**
 * Wiederherstellungsmail — der einzige Weg zurück an die gemerkten Titel.
 *
 * Sie muss drei Dinge leisten, und alle drei stehen bewusst im Text:
 * **warum** sie kommt, dass sie **dreißig Minuten** gilt, und dass **Nichtstun
 * sicher ist**, falls sie jemand anderes ausgelöst hat. Der letzte Punkt ist
 * der wichtigste: Wer eine unerwartete Mail über sein Abo bekommt, soll sie
 * beruhigt ignorieren können, statt aus Sorge auf einen Link zu klicken, den
 * ein Fremder angefordert hat.
 */
export function restoreMail(url: string): { subject: string; html: string; text: string } {
  const subject = 'Deine gemerkten Titel wiederherstellen'
  const html = SHELL(
    subject,
    `<p style="margin:0 0 14px;">Für diese Adresse wurde angefordert, die gemerkten Titel in einen
     Browser zurückzuholen — etwa nach dem Löschen der Browserdaten oder auf einem neuen Gerät.</p>
     <p style="margin:0 0 20px;"><a href="${url}"
       style="display:inline-block;background:#38bdf8;color:#06121d;text-decoration:none;padding:11px 20px;border-radius:9px;font-weight:700;">
       Favoriten wiederherstellen</a></p>
     <p style="margin:0 0 14px;color:#9aa5bd;font-size:13px;">Der Link gilt
     <strong style="color:#cbd5e1;">dreißig Minuten</strong> und lässt sich nur einmal benutzen.</p>
     <p style="margin:0;color:#9aa5bd;font-size:13px;">Falls der Knopf nicht geht:<br>
     <a href="${url}" style="color:#7dd3fc;word-break:break-all;">${url}</a></p>`,
    'Warst du das nicht, ignoriere diese Mail einfach. Ohne deinen Klick passiert nichts, und an deinem Abo ändert sich nichts.',
  )
  const text =
    `Für diese Adresse wurde angefordert, die gemerkten Titel in einen Browser zurückzuholen.\n\n` +
    `Wiederherstellen: ${url}\n\n` +
    `Der Link gilt dreißig Minuten und lässt sich nur einmal benutzen.\n` +
    `Warst du das nicht, ignoriere diese Mail — ohne deinen Klick passiert nichts.`
  return { subject, html, text }
}

/** Direktlinks je Release-Slug, aus `releases.json` geladen. */
export interface ReleaseLink {
  platformUrl?: string
  buyUrl?: string
}

/** Was jede Zeile zum Verlinken braucht. */
interface RowContext {
  siteUrl: string
  links: Map<string, ReleaseLink>
}

/**
 * Die Ansicht im Kalender, die genau diesen Termin zeigt.
 *
 * Bewusst über die Teilen-Seite `/r/<slug>/` statt direkt über `#/woche?…`:
 * Alles hinter dem `#` erreicht keinen Server, eine weitergeleitete Mail hätte
 * damit nie eine Vorschau. Die Teilen-Seite hat eigene Vorschaubilder und
 * springt anschließend selbst in die Wochenansicht — der Hash sagt ihr nur,
 * welcher Tag gemeint ist.
 */
function calendarUrl(ctx: RowContext, ev: ReleaseEvent): string {
  const slug = encodeURIComponent(ev.releaseSlug)
  return `${ctx.siteUrl.replace(/\/$/, '')}/r/${slug}/#/woche?d=${ev.date}&r=${slug}`
}

/** Zum Anbieter selbst: Streamingseite, bei Disc-Releases die Kaufseite. */
function watchUrl(ctx: RowContext, ev: ReleaseEvent): string | undefined {
  const link = ctx.links.get(ev.releaseSlug)
  if (!link) return undefined
  return ev.releaseType === 'disc' ? (link.buyUrl ?? link.platformUrl) : (link.platformUrl ?? link.buyUrl)
}

function eventRow(ctx: RowContext, ev: ReleaseEvent, highlight: boolean): string {
  const type = RELEASE_TYPES[ev.releaseType]
  const time = ev.time ? `${ev.time} Uhr` : ev.releaseType === 'disc' ? 'im Handel' : 'Zeit offen'
  const episode = ev.episode ? ` · Folge ${ev.episode}${ev.episodeCount ? `/${ev.episodeCount}` : ''}` : ''
  const platform = PLATFORMS[ev.platform]
  const watch = watchUrl(ctx, ev)

  // Der Anbietername ist der Knopf zum Ansehen. Fehlt der Deeplink, bleibt er
  // schlichter Text — ein Link ins Leere wäre schlimmer als keiner.
  const platformPart = watch
    ? `<a href="${escapeHtml(watch)}" style="color:${platform.color};text-decoration:none;font-weight:600;">${escapeHtml(
        platform.name,
      )} ${ev.releaseType === 'disc' ? 'kaufen' : 'ansehen'} &rsaquo;</a>`
    : escapeHtml(platform.name)

  return `<tr>
    <td style="padding:7px 0;border-top:1px solid #232c40;">
      <span style="display:inline-block;width:3px;height:14px;background:${type.color};vertical-align:-2px;border-radius:2px;"></span>
      ${highlight ? '<span style="color:#fbbf24;">★</span> ' : ''}<a href="${escapeHtml(
        calendarUrl(ctx, ev),
      )}" style="color:#fff;text-decoration:none;"><strong>${escapeHtml(ev.name)}</strong></a><br>
      <span style="color:#9aa5bd;font-size:13px;">${escapeHtml(time)}${escapeHtml(episode)} · ${platformPart}${
        ev.estimated ? ' · Termin abgeleitet' : ''
      }</span>
    </td>
  </tr>`
}

/** Termine nach Tag gruppiert ausgeben. */
function dateSections(ctx: RowContext, events: ReleaseEvent[], highlight: boolean): string {
  const byDate = new Map<string, ReleaseEvent[]>()
  for (const ev of events) {
    const list = byDate.get(ev.date)
    if (list) list.push(ev)
    else byDate.set(ev.date, [ev])
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(
      ([date, list]) => `<p style="margin:16px 0 2px;color:#7dd3fc;font-weight:700;font-size:14px;">
        ${weekdayName(date)}, ${formatDate(date)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${list
          .map((ev) => eventRow(ctx, ev, highlight))
          .join('')}</table>`,
    )
    .join('')
}

function textSections(ctx: RowContext, events: ReleaseEvent[]): string {
  const byDate = new Map<string, ReleaseEvent[]>()
  for (const ev of events) {
    const list = byDate.get(ev.date)
    if (list) list.push(ev)
    else byDate.set(ev.date, [ev])
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(
      ([date, list]) =>
        `${weekdayName(date)}, ${formatDate(date)}\n` +
        list
          .map((ev) => {
            const watch = watchUrl(ctx, ev)
            return (
              `  - ${ev.name}${ev.episode ? ` (Folge ${ev.episode})` : ''} — ${
                ev.time ? `${ev.time} Uhr` : ev.releaseType === 'disc' ? 'im Handel' : 'Zeit offen'
              }, ${PLATFORMS[ev.platform].name}\n` +
              `    Kalender: ${calendarUrl(ctx, ev)}` +
              (watch ? `\n    ${ev.releaseType === 'disc' ? 'Kaufen' : 'Ansehen'}: ${watch}` : '')
            )
          })
          .join('\n'),
    )
    .join('\n\n')
}

/**
 * Ein gemerkter Titel, der **neu** eine deutsche Synchro bekommen hat.
 *
 * Das ist die Nachricht, auf die jemand monatelang wartet — und die es ohne
 * eigenen Weg nie in eine Mail schaffen würde: Eine Ankündigung ist kein
 * Termin, fällt also durch das Tages- und Wochenfenster des Newsletters
 * (Daniel, 13.08.2026).
 */
export interface NeuMitSynchro {
  id: number
  name: string
  slug: string
  /** Tag, an dem der Titel erstmals mit belegter Synchro im Bestand stand. */
  seit: string
  /** Erster bekannter deutscher Termin — fehlt, wenn nur angekündigt. */
  termin?: string
}

export interface DigestOptions {
  /** AniList-IDs der gemerkten Titel. */
  favorites?: Set<number>
  /** Adresse, über die der Nutzer seine Favoriten abgleichen kann. */
  syncUrl?: string
  /** Direktlinks zum Anbieter, je Release-Slug. */
  links?: Map<string, ReleaseLink>
  /** Gemerkte Titel, die seit der letzten Mail eine Synchro bekommen haben. */
  neuMitSynchro?: NeuMitSynchro[]
}

export function digestMail(
  events: ReleaseEvent[],
  frequency: 'daily' | 'weekly',
  siteUrl: string,
  unsubUrl: string,
  options: DigestOptions = {},
): { subject: string; html: string; text: string } {
  const favorites = options.favorites ?? new Set<number>()
  /**
   * Wie der Rhythmus in der Mail benannt wird — einmal zentral.
   *
   * Ohne Uhrzeit, obwohl der Versand um sieben läuft: `SEND_HOUR_BERLIN` ist
   * einstellbar, und eine Mail, die eine feste Stunde nennt, wird bei der
   * ersten Änderung zur Falschaussage. „Morgens" bleibt wahr.
   */
  const rhythmus =
    frequency === 'daily'
      ? { name: 'tägliche Newsletter', wann: 'jeden Morgen', andere: 'wöchentlich' }
      : { name: 'wöchentliche Newsletter', wann: 'jeden Montagmorgen', andere: 'täglich' }
  const mine = events.filter((e) => favorites.has(e.titleId))
  const rest = events.filter((e) => !favorites.has(e.titleId))
  const neu = options.neuMitSynchro ?? []
  const ctx: RowContext = { siteUrl, links: options.links ?? new Map() }

  /**
   * Der Betreff nennt zuerst, was den Leser wirklich betrifft — und nichts
   * betrifft ihn mehr als eine Serie, auf deren Synchro er gewartet hat.
   * Deshalb steht das vor allem anderen, auch vor den Favoriten-Folgen.
   */
  const subject =
    neu.length > 0
      ? neu.length === 1
        ? `${neu[0].name} bekommt eine deutsche Synchro`
        : `${neu.length} deiner gemerkten Titel bekommen eine deutsche Synchro`
      : mine.length > 0
        ? `${mine.length} ${mine.length === 1 ? 'Folge' : 'Folgen'} deiner Favoriten${
            rest.length ? ` und ${rest.length} weitere Releases` : ''
          }`
        : frequency === 'daily'
          ? `Heute mit deutscher Synchro: ${events.length} ${events.length === 1 ? 'Release' : 'Releases'}`
          : `Diese Woche mit deutscher Synchro: ${events.length} ${events.length === 1 ? 'Release' : 'Releases'}`

  const heading = (text: string, colour: string) =>
    `<p style="margin:26px 0 0;padding-bottom:6px;border-bottom:2px solid ${colour};color:${colour};font-weight:700;font-size:15px;letter-spacing:.03em;">${text}</p>`

  /**
   * Die Nachricht ganz oben, in Grün und mit eigenem Kasten.
   *
   * Sie unterscheidet sich in einem Punkt vom Rest der Mail: Hier steht nicht,
   * *wann* etwas läuft, sondern *dass* es die Sache überhaupt gibt. Wer den
   * Titel gemerkt hat, hat womöglich Monate darauf gewartet — das verdient
   * mehr als eine Zeile in einer Terminliste.
   */
  const neuBlock = neu.length
    ? `<p style="margin:0 0 6px;padding-bottom:6px;border-bottom:2px solid #34d399;color:#34d399;font-weight:700;font-size:15px;letter-spacing:.03em;">
         🎉 Endlich: deutsche Synchro
       </p>
       <p style="margin:0 0 10px;color:#9aa5bd;font-size:13px;">
         ${neu.length === 1 ? 'Ein Titel, den du gemerkt hast, hat' : `${neu.length} Titel, die du gemerkt hast, haben`}
         jetzt eine belegte deutsche Fassung.
       </p>
       ${neu
         .map(
           (n) => `<p style="margin:0 0 8px;padding:11px 13px;background:#10251d;border-left:3px solid #34d399;border-radius:0 8px 8px 0;">
             <a href="${siteUrl}#/datenbank?t=${n.id}" style="color:#e2e8f0;font-weight:700;text-decoration:none;font-size:15px;">${n.name}</a><br>
             <span style="color:#9aa5bd;font-size:13px;">${
               n.termin ? `Erster deutscher Termin: ${n.termin.split('-').reverse().join('.')}` : 'Angekündigt — ein Termin steht noch aus.'
             }</span>
           </p>`,
         )
         .join('')}`
    : ''

  let body = neuBlock
  if (mine.length > 0) {
    body += heading('★ Deine Favoriten', '#fbbf24') + dateSections(ctx, mine, true)
  }
  if (rest.length > 0) {
    body +=
      mine.length > 0
        ? heading('Weitere Releases', '#3f4b63') + dateSections(ctx, rest, false)
        : `<p style="margin:0;">${
            frequency === 'daily' ? 'Das steht heute an:' : 'Das steht in den nächsten sieben Tagen an:'
          }</p>` + dateSections(ctx, rest, false)
  }

  // Ohne gemerkte Titel ist der Hinweis nützlich; mit gemerkten wäre er Lärm.
  const favouriteHint =
    favorites.size === 0 && options.syncUrl
      ? `<p style="margin:22px 0 0;padding:12px 14px;background:#1d2536;border-radius:9px;color:#9aa5bd;font-size:13px;line-height:1.6;">
           Du hast noch keine Favoriten hinterlegt. Markiere im Kalender die Serien, denen du folgst —
           ihre neuen Folgen stehen dann ganz oben in dieser Mail.<br>
           <a href="${options.syncUrl}" style="color:#7dd3fc;">Favoriten übernehmen</a>
         </p>`
      : ''

  const html = SHELL(
    subject,
    `${body}${favouriteHint}
     <p style="margin:24px 0 0;"><a href="${siteUrl}"
       style="display:inline-block;background:#38bdf8;color:#06121d;text-decoration:none;padding:10px 18px;border-radius:9px;font-weight:700;">
       Im Kalender ansehen</a></p>`,
    // Welche Mail das hier ist, gehört hinein: Wer sie seit Monaten bekommt,
    // weiß sonst nicht mehr, ob er den täglichen oder den wöchentlichen
    // Rhythmus gewählt hat — und findet auch nicht, wo er das ändert.
    `Das hier ist der <strong style="color:#cbd5e1;">${rhythmus.name}</strong> — er kommt ${rhythmus.wann}.
     Du erhältst ihn, weil du das Abo bestätigt hast.<br>
     <a href="${siteUrl}#/newsletter" style="color:#7dd3fc;">Auf ${rhythmus.andere} umstellen</a> ·
     <a href="${unsubUrl}" style="color:#7dd3fc;">Abmelden</a> ·
     <a href="${siteUrl}#/datenschutz" style="color:#7dd3fc;">Datenschutz</a>${
       options.syncUrl ? ` · <a href="${options.syncUrl}" style="color:#7dd3fc;">Favoriten abgleichen</a>` : ''
     }`,
  )

  const text =
    `${subject}\n\n` +
    (neu.length > 0
      ? `ENDLICH: DEUTSCHE SYNCHRO\n\n` +
        neu
          .map(
            (n) =>
              `* ${n.name} — ${
                n.termin ? `erster deutscher Termin: ${n.termin.split('-').reverse().join('.')}` : 'angekündigt, Termin steht noch aus'
              }\n  ${siteUrl}#/datenbank?t=${n.id}`,
          )
          .join('\n') +
        '\n\n'
      : '') +
    (mine.length > 0 ? `DEINE FAVORITEN\n\n${textSections(ctx, mine)}\n\n` : '') +
    (rest.length > 0 ? `${mine.length > 0 ? 'WEITERE RELEASES\n\n' : ''}${textSections(ctx, rest)}\n\n` : '') +
    `Kalender: ${siteUrl}\n` +
    (options.syncUrl ? `Favoriten abgleichen: ${options.syncUrl}\n` : '') +
    `\nDas hier ist der ${rhythmus.name} — er kommt ${rhythmus.wann}.\n` +
    `Auf ${rhythmus.andere} umstellen: ${siteUrl}#/newsletter\n` +
    `Abmelden: ${unsubUrl}`

  return { subject, html, text }
}

interface MonitorLine {
  name: string
  url: string
  ok: boolean
  reason?: string
  ms: number
  downSince?: string
  /** Wie viele Läufe hintereinander diese Seite schon rot ist. */
  failStreak?: number
}

/**
 * Störungsmeldung. Kommt höchstens einmal am Tag, deshalb steht alles drin,
 * was zur Einschätzung nötig ist — nachfragen kann man ihr nicht.
 *
 * `okCount` wird übergeben statt aus `totalCount - down.length` gerechnet:
 * Gemeldet werden nur bestätigte Störungen, aber gleichzeitig kann eine
 * weitere Seite im ersten roten Lauf stecken. Die wäre in der Differenz
 * fälschlich als „antwortet normal" mitgezählt.
 */
export function outageMail(
  down: MonitorLine[],
  totalCount: number,
  siteUrl: string,
  okCount = totalCount - down.length,
): { subject: string; html: string; text: string } {
  // Ein erzwungener Lauf (`force=alert`) schickt die Mail auch, wenn nichts
  // gestört ist — dann steht eine gesunde Seite als Beispiel darin. Ohne
  // Unterscheidung trüge die Testmail „Störung" im Betreff und behauptete im
  // Text einen Ausfall, den es nicht gibt.
  const echteStoerung = down.some((d) => !d.ok)
  const subject = !echteStoerung
    ? 'Testlauf der Störungsmeldung — alles erreichbar'
    : down.length === 1
      ? `Störung: ${down[0].name} nicht erreichbar`
      : `Störung: ${down.length} von ${totalCount} Diensten nicht erreichbar`

  const rows = down
    .map(
      (d) => `<tr><td style="padding:8px 0;border-top:1px solid #232c40;">
        <strong style="color:#fff;">${escapeHtml(d.name)}</strong><br>
        <span style="color:#f87171;font-size:13px;">${escapeHtml(d.reason ?? 'nicht erreichbar')}</span><br>
        <span style="color:#7c879e;font-size:12px;">${escapeHtml(d.url)}${
          d.downSince ? ` · zuletzt erreichbar ${escapeHtml(d.downSince)}` : ' · noch nie erreichbar gewesen'
        }${d.failStreak ? ` · ${d.failStreak} Fehlversuche in Folge` : ''}</span>
      </td></tr>`,
    )
    .join('')

  const html = SHELL(
    subject,
    `<p style="margin:0 0 8px;">Die stündliche Prüfung aller Seiten lief gerade. ${
       !echteStoerung
         ? 'Es ist nichts gestört — diese Mail wurde von Hand ausgelöst, die Seite unten steht nur als Beispiel:'
         : 'Folgendes antwortet seit mindestens zwei Prüfungen nicht mehr:'
     }</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
     <p style="margin:20px 0 0;color:#9aa5bd;font-size:13px;">
       ${okCount} von ${totalCount} Diensten antworten normal.
       Diese Meldung kommt höchstens einmal am Tag — bleibt eine Seite länger weg,
       erfährst du es erst im Wochenbericht wieder.</p>`,
    `Erreichbarkeitsprüfung aller Projekte · kein Newsletter ·
     <a href="${siteUrl}" style="color:#7dd3fc;">anime-kalender.de</a>`,
    BRAND.monitor,
  )

  const text =
    `${subject}\n\n` +
    down
      .map(
        (d) =>
          `- ${d.name}: ${d.reason ?? 'nicht erreichbar'}\n  ${d.url}${
            d.downSince ? `\n  zuletzt erreichbar: ${d.downSince}` : ''
          }${d.failStreak ? `\n  ${d.failStreak} Fehlversuche in Folge` : ''}`,
      )
      .join('\n') +
    `\n\n${okCount} von ${totalCount} Seiten antworten normal.`

  return { subject, html, text }
}

/**
 * Wochenübersicht. Kommt auch, wenn alles läuft — genau das ist ihr Zweck:
 * Sie beweist, dass die Überwachung selbst noch lebt. Ohne sie wäre Stille
 * nicht von „alles in Ordnung" zu unterscheiden.
 */
export function weeklyStatusMail(
  lines: MonitorLine[],
  siteUrl: string,
): { subject: string; html: string; text: string } {
  const down = lines.filter((l) => !l.ok)
  const subject =
    down.length === 0
      ? `Wochenbericht: alle ${lines.length} Dienste laufen`
      : `Wochenbericht: ${down.length} von ${lines.length} Diensten gestört`

  const rows = lines
    .slice()
    .sort((a, b) => Number(a.ok) - Number(b.ok) || a.name.localeCompare(b.name, 'de'))
    .map(
      (l) => `<tr>
        <td style="padding:5px 8px 5px 0;border-top:1px solid #232c40;white-space:nowrap;color:${
          l.ok ? '#34d399' : '#f87171'
        };">${l.ok ? '●' : '▲'}</td>
        <td style="padding:5px 0;border-top:1px solid #232c40;color:#d7dced;">${escapeHtml(l.name)}</td>
        <td style="padding:5px 0;border-top:1px solid #232c40;text-align:right;color:#7c879e;font-size:13px;white-space:nowrap;">${
          l.ok ? `${l.ms} ms` : escapeHtml(l.reason ?? 'weg')
        }</td>
      </tr>`,
    )
    .join('')

  const html = SHELL(
    subject,
    `<p style="margin:0 0 8px;">Stand der letzten Prüfung aller ${lines.length} überwachten
     Seiten:</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
     <p style="margin:18px 0 0;color:#7c879e;font-size:12px;">
       Diese Mail kommt einmal die Woche, auch wenn alles läuft — daran erkennst du,
       dass die Überwachung selbst noch arbeitet.</p>`,
    `Erreichbarkeitsprüfung aller Projekte · kein Newsletter ·
     <a href="${siteUrl}" style="color:#7dd3fc;">anime-kalender.de</a>`,
    BRAND.monitor,
  )

  const text =
    `${subject}\n\n` +
    lines.map((l) => `${l.ok ? 'ok  ' : 'WEG '} ${l.name} — ${l.ok ? `${l.ms} ms` : (l.reason ?? '')}`).join('\n')

  return { subject, html, text }
}

export function page(title: string, message: string, siteUrl: string): Response {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0e17;color:#e6e9f0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
<div style="max-width:420px;padding:32px;text-align:center;">
<div style="font-size:38px;">📺</div>
<h1 style="font-size:20px;margin:12px 0 8px;">${escapeHtml(title)}</h1>
<p style="color:#9aa5bd;line-height:1.6;margin:0 0 22px;">${escapeHtml(message)}</p>
<a href="${siteUrl}" style="display:inline-block;background:#38bdf8;color:#06121d;text-decoration:none;padding:10px 18px;border-radius:9px;font-weight:700;">Zum Kalender</a>
</div></body></html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}
