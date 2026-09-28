#!/usr/bin/env node
/**
 * **Wie der Newsletter aussehen könnte — Entwurf, nicht der Bau** (28.09.2026).
 *
 * Daniel: „tv releases in newsletter separiert anzeigen, vor allem wenn es wiederholungen sind …
 * falls es tv premiere ist, sollte sie auch oben angezeigt werden … generell sollte newsletter so
 * priorisiert sein: Favoriten, Premieren, Finale, Kino, Stream, Kauftitel, TV (wiederholungen).
 * Hab ich etwas vergessen? News, eventuell?"
 *
 * Der Entwurf zeigt **nur die Reihenfolge und die Trennung**, mit den Farben der echten Mail
 * (`worker/src/templates.ts`). Er ist ein eigenes Blatt, nicht die Mail: Die Zahlen und Titel sind
 * erfunden, damit man die Gliederung beurteilen kann, ohne den Datensatz zu brauchen.
 *
 * Aufruf: `node tools/newsletter-entwurf.mjs`
 * Ergebnis: `docs/newsletter-entwurf.png`
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const farbe = {
  text: '#e2e8f0',
  leise: '#9aa5bd',
  link: '#7dd3fc',
  gruen: '#34d399',
  gelb: '#fbbf24',
  blau: '#60a5fa',
  lila: '#a78bfa',
  tv: '#2dd4bf',
  disc: '#22c55e',
  kino: '#eab308',
}

/** Eine Abschnittsüberschrift mit farbiger Unterlinie — so wie `heading()` in der Mail. */
const kopf = (text, farbe1, zusatz = '') => `
  <p style="margin:26px 0 0;padding-bottom:6px;border-bottom:2px solid ${farbe1};color:${farbe1};font-weight:700;font-size:15px;letter-spacing:.03em;">${text}</p>
  ${zusatz ? `<p style="margin:6px 0 0;color:${farbe.leise};font-size:13px;">${zusatz}</p>` : ''}`

/** Eine Terminzeile: farbiger Strich, Titel, darunter Zeit · Folge · Anbieter. */
const zeile = (titel, unten, farbe1, abzeichen = '') => `
  <p style="margin:10px 0 0;padding-top:8px;border-top:1px solid #232c40;">
    <span style="display:inline-block;width:3px;height:14px;background:${farbe1};vertical-align:-2px;border-radius:2px;"></span>
    <a href="#" style="color:#fff;text-decoration:none;"><strong>${titel}</strong></a>
    ${abzeichen}
    <br><span style="color:${farbe.leise};font-size:13px;">${unten}</span>
  </p>`

const abzeichen = (text, farbe1) =>
  `<span style="margin-left:6px;padding:1px 7px;border:1px solid ${farbe1};border-radius:999px;color:${farbe1};font-size:11px;font-weight:600;">${text}</span>`

const ENTWURF = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><style>
  body { margin:0; background:#0f1420; font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:${farbe.text}; }
  /* Feste Breite: Sonst zieht eine lange Überschrift das Blatt in die Weite und der Ausschnitt
     schneidet rechts ab (beim ersten Versuch passiert). */
  .blatt { width:640px; box-sizing:border-box; }
</style></head>
<body style="padding:20px 12px;">
<div class="blatt" style="background:#131a28;border:1px solid #232c40;border-radius:14px;padding:22px 24px;">

  <p style="margin:0;color:${farbe.leise};font-size:12px;letter-spacing:.06em;text-transform:uppercase;">Entwurf · Reihenfolge und Trennung</p>
  <h1 style="margin:6px 0 4px;font-size:21px;">Heute: Finale bei Frieren, 3 Premieren</h1>
  <p style="margin:0 0 4px;color:${farbe.leise};font-size:13px;">Montag, 28.09.2026 · dein täglicher Newsletter</p>

  ${kopf('★ Deine Favoriten', farbe.gelb, 'Was dich betrifft — nach Wichtigkeit, nicht nach Uhrzeit.')}
  ${zeile('Frieren — Beyond Journey’s End', '18:25 Uhr · Folge 28/28 · Crunchyroll ansehen ›', farbe.gelb, abzeichen('Finale', farbe.gelb))}
  ${zeile('Dragon Ball Daima', '17:10 Uhr · Folge 5/15 · ProSieben MAXX', farbe.gelb, abzeichen('Premiere', farbe.tv))}

  ${kopf('🎬 Kino', farbe.kino, 'Nur Kinostarts und letzte Spieltage.')}
  ${zeile('Look Back', 'läuft noch bis 01.10. · Kino', farbe.kino, abzeichen('letzte Woche', farbe.kino))}

  ${kopf('▶ Neu bei den Anbietern', farbe.blau, 'Neue Folgen und Katalogtitel bei deinen Diensten.')}
  ${zeile('Solo Leveling', '08:00 Uhr · Folge 13/13 · Crunchyroll ansehen ›', farbe.blau, abzeichen('Finale', farbe.gelb))}
  ${zeile('Chainsaw Man — Reze Arc', 'im Katalog · Prime Video ansehen ›', farbe.blau)}

  ${kopf('💿 Im Handel', farbe.disc, 'Kaufen lohnt sich — hier gibt es die deutsche Fassung.')}
  ${zeile('I Parry Everything!', 'im Handel · DVD / Blu-ray kaufen ›', farbe.disc)}

  ${kopf('📺 TV — Premieren', farbe.tv, 'Erstmals auf Deutsch im Fernsehen. Nicht verpassen.')}
  ${zeile('One Piece Log: Fish-Man Island Saga', '18:25 Uhr · Folge 3 · ProSieben MAXX', farbe.tv, abzeichen('Premiere', farbe.tv))}

  ${kopf('📺 TV — Wiederholungen', '#6b7a99', '5 Sendungen — die Folgen liefen schon auf Deutsch.')}
  <p style="margin:8px 0 0;color:${farbe.leise};font-size:13px;">
    Dragon Ball Fg. 5 · 17:10 · ProSieben MAXX<br>
    Dragon Ball Fg. 6 · 17:35 · ProSieben MAXX<br>
    Detektiv Conan Fg. 144 · 18:00 · ProSieben MAXX<br>
    One Piece Log Fg. 1 · 18:55 · ProSieben MAXX<br>
    <a href="#" style="color:${farbe.link};">alle 5 im Kalender ansehen ›</a>
  </p>

  ${kopf('📰 Neuigkeiten', farbe.lila, 'Ankündigungen, auf die niemand einen Termin setzen kann.')}
  <p style="margin:8px 0 0;font-size:14px;line-height:1.6;">
    <strong>Black Clover Staffel 2</strong> kommt ab 03.10. mit deutschen Untertiteln —
    die Synchro ist angekündigt.
    <a href="#" style="color:${farbe.link};">Quelle: Crunchyroll ›</a><br>
    <strong>Magic Knight Rayearth (2026)</strong> startet am 07.10. bei Crunchyroll, deutsche
    Fassung angekündigt.
    <a href="#" style="color:${farbe.link};">Quelle: Crunchyroll ›</a>
  </p>

  <p style="margin:26px 0 0;color:${farbe.leise};font-size:12px;line-height:1.6;">
    Drei von sieben Zeilen brauchst du nur, wenn du sie brauchst: Was fertig ist (Finale), was
    zuerst kommt (Premiere) und was neu ist (Ankündigung) — der Rest steht weiter da, aber unten.
  </p>
</div>
</body></html>`

mkdirSync('docs', { recursive: true })
const browser = await chromium.launch()
const seite = await browser.newPage({ viewportSize: { width: 680, height: 900 }, deviceScaleFactor: 2 })
await seite.setContent(ENTWURF)
await seite.screenshot({ path: 'docs/newsletter-entwurf.png', fullPage: true })
await browser.close()
console.log('Entwurf gerendert: docs/newsletter-entwurf.png')
