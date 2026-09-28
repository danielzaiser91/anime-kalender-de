#!/usr/bin/env node
/**
 * **Wie die Laufstatus-Anzeige aussehen könnte — Entwurf, nicht der Bau** (28.09.2026).
 *
 * Daniel: „mach design vorschläge … es soll ein viel besseres monitoring tool sein, wo man auf
 * einen blick alles sieht, aktuell blick ich kaum noch durch … so ein kontingent fehler sollte
 * viel sichtbarer sein und visuell einfacher zu verstehen sein."
 *
 * Der Entwurf ist ein eigenes Blatt, **nicht** die Anzeige selbst: Er zeigt nur Aufbau, Farben
 * und Abstände, mit echten Lauf-Arten und erfundenen Zeiten (die echten stehen heute nicht zur
 * Verfügung — das Kontingent ist erschöpft). Farbwerte und Anordnung liest man am Bild, nicht am
 * Quelltext — dieselbe Begründung wie bei `lauf-status-pillen-bild.mjs`.
 *
 * Aufruf: `node tools/lauf-status-entwurf.mjs`
 * Ergebnis: `docs/lauf-status-entwurf-uebersicht.png`, `docs/lauf-status-entwurf-detail.png`
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'

/** Eine Kachel: Ampel, Kurzname, was gerade gilt, und der Mini-Verlauf der letzten Läufe. */
const kachel = (kurz, lang, zustand, gilt, verlauf, laeuft = false) => `
  <div class="kachel ${zustand}"${lang === 'Deploy' ? ' id="deploy"' : ''} title="${lang}">
    <div class="zeile1"><span class="punkt"></span><span class="name">${kurz}</span><span class="gilt">${gilt}</span></div>
    <div class="verlauf">${verlauf.split('').map((z) => `<i class="${z}"></i>`).join('')}</div>
    ${laeuft ? '<div class="balken"><i style="width:100%"></i></div>' : ''}
  </div>`

/** Eine Zeile im Verlauf einer Lauf-Art: Ampel, Kurztext, Dauer, Uhrzeit. */
const verlaufZeile = (zustand, was, dauer, wann) => `
  <div class="vzeile"><span class="punkt ${zustand}"></span><span class="was">${was}</span><span class="dauer">${dauer}</span><span class="wann">${wann}</span></div>`

const ENTWURF = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; width: 420px; font: 13px/1.45 -apple-system, "Segoe UI", sans-serif;
         background: #191b1f; color: #e6e7ea; }
  .entwurf { background: #2a2f3a; color: #9aa0a8; font-size: 11px; letter-spacing: .4px;
             padding: 4px 12px; text-transform: uppercase; }
  header { display: flex; align-items: baseline; justify-content: space-between;
           padding: 10px 12px 6px; }
  h1 { margin: 0; font-size: 15px; font-weight: 600; }
  h1 b { color: #4a9eff; font-weight: 600; }
  .uhr { color: #9aa0a8; font-size: 12px; }

  /* Der Kontingent-Fehler: ein Balken über allem, in einem Satz, mit der Zeit, ab der es
     weitergeht. Kein Fehlerrot — es ist Stillstand, keine Panne. */
  .limit { margin: 0 12px 10px; border: 1px solid #8a6d1f; border-radius: 8px;
           background: rgba(224, 179, 65, .12); padding: 9px 11px; }
  .limit .kopf { font-weight: 600; color: #e0b341; margin-bottom: 2px; }
  .limit .text { color: #cfd2d8; }
  .limit .klein { color: #9aa0a8; font-size: 11px; margin-top: 3px; }

  .abschnitt { color: #9aa0a8; font-size: 11px; text-transform: uppercase; letter-spacing: .5px;
               margin: 12px 12px 6px; }
  .raster { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 0 12px; }
  .kachel { border: 1px solid #333840; border-left-width: 3px; border-radius: 7px;
            background: #22252b; padding: 7px 9px 8px; position: relative; overflow: hidden; }
  .kachel.laeuft { border-left-color: #4a9eff; background: #1f2733; }
  .kachel.ok { border-left-color: #46c07a; }
  .kachel.warnung { border-left-color: #e0b341; }
  .kachel.fehler { border-left-color: #e05252; }
  .kachel.ruht { border-left-color: #39414c; opacity: .78; }
  .zeile1 { display: flex; align-items: center; gap: 6px; }
  .punkt { width: 8px; height: 8px; border-radius: 50%; background: #9aa0a8; flex: none; }
  .laeuft .punkt { background: #4a9eff; } .ok .punkt { background: #46c07a; }
  .warnung .punkt { background: #e0b341; } .fehler .punkt { background: #e05252; }
  .ruht .punkt { background: #39414c; }
  .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gilt { margin-left: auto; color: #9aa0a8; font-size: 11px; white-space: nowrap;
          font-variant-numeric: tabular-nums; padding-left: 6px; }
  .laeuft .gilt { color: #4a9eff; }
  .verlauf { display: flex; gap: 2px; margin-top: 6px; }
  .verlauf i { flex: 1; height: 5px; border-radius: 2px; background: #39414c; }
  .verlauf i.s { background: #46c07a; } .verlauf i.f { background: #e05252; }
  .verlauf i.w { background: #e0b341; } .verlauf i.c { background: #5a6270; }
  .balken { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: #2c3442; }
  .balken i { display: block; height: 100%; background: #4a9eff; }

  footer { display: flex; justify-content: space-between; color: #9aa0a8; font-size: 11px;
           padding: 12px; }
  footer b { color: #e6e7ea; font-weight: 600; }

  /* — Detailansicht — */
  .zurueck { color: #4a9eff; font-size: 12px; }
  .jetzt { margin: 0 12px; border: 1px solid #2f4a6b; border-radius: 8px; background: #1f2733;
           padding: 10px 11px; }
  .jetzt .kopf { font-weight: 600; color: #4a9eff; }
  .jetzt .ziel { color: #cfd2d8; margin-top: 4px; }
  .jetzt .balken2 { height: 6px; border-radius: 3px; background: #2c3442; margin: 8px 0 4px; }
  .jetzt .balken2 i { display: block; height: 100%; border-radius: 3px; background: #4a9eff; }
  .jetzt .schritt { color: #9aa0a8; font-size: 11px; }
  .block { border: 1px solid #333840; border-radius: 8px; background: #22252b; margin: 10px 12px 0;
           padding: 9px 11px; }
  .block .titel { color: #9aa0a8; font-size: 11px; text-transform: uppercase; letter-spacing: .5px;
                  margin-bottom: 4px; }
  .block .ergebnis { font-size: 14px; font-weight: 600; color: #46c07a; }
  .block .bei { color: #9aa0a8; font-size: 11px; }
  .vzeile { display: flex; align-items: center; gap: 7px; padding: 3px 0; }
  .vzeile .was { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vzeile .dauer, .vzeile .wann { color: #9aa0a8; font-size: 11px; font-variant-numeric: tabular-nums; }
  .vzeile .punkt.s { background: #46c07a; } .vzeile .punkt.f { background: #e05252; }
  .vzeile .punkt.w { background: #e0b341; } .vzeile .punkt.c { background: #5a6270; }
  .gh { display: block; margin: 12px 12px 0; padding: 9px; text-align: center; color: #4a9eff;
        border: 1px solid #333840; border-radius: 8px; background: #22252b; font-weight: 600; }
</style></head><body>

<div class="entwurf">Entwurf · so könnte die Anzeige aussehen</div>

<header><h1>Laufstatus <b>2 laufen</b></h1><span class="uhr">18:31</span></header>

<div class="limit">
  <div class="kopf">Datenbank am Tageslimit</div>
  <div class="text">Alle Zeiten unten sind von <b>18:29</b> und bleiben es bis <b>02:00</b>
    (in 7 h 31 min). Kein Defekt — es kommen nur keine neuen Werte dazu.</div>
  <div class="klein">Die Seite selbst läuft weiter. Nichts zu tun.</div>
</div>

<div class="abschnitt">Lauf-Arten</div>
<div class="raster">
  ${kachel('Deploy', 'Deploy auf GitHub Pages', 'laeuft', '1:18', 'cwwdsss', true)}
  ${kachel('Bestand', 'Bestand — zusammenführen und bauen', 'laeuft', '2:58', 'ssswd', true)}
  ${kachel('Stündlich', 'Stündlich — Sendezeiten', 'ok', '12 min', 'ssssssssssss')}
  ${kachel('Wöchentlich', 'Wöchentlich — tiefer Durchlauf', 'ok', '6 h', 'ssss')}
  ${kachel('Wache', 'Wache — Delta und Briefkasten', 'ok', '3 h', 'sssssss')}
  ${kachel('ADN', 'ADN — laufende Serien', 'ok', '5 h', 'ssss')}
  ${kachel('Auf Abruf', 'Datenlauf auf Abruf', 'ruht', 'gestern', 'ccss')}
  ${kachel('Rückstand CR', 'Crunchyroll — Rückstand nachholen', 'ruht', '5 T.', 'cssc')}
  ${kachel('Tonspuren', 'Monatlich — Tonspuren', 'ok', '2.9.', 'ss')}
  ${kachel('PR-Merge', 'Claude — Daten-PR zusammenführen', 'ok', '3 h', 'ssssss')}
  ${kachel('Auftrag', 'Claude — Auftrag abarbeiten', 'ruht', '2 T.', 'css')}
  ${kachel('Reparatur', 'Claude — roten Datenlauf untersuchen', 'ruht', '1 T.', 'css')}
  ${kachel('Verpasst', 'Claude — ausgebliebene Folgen recherchieren', 'ok', '8 h', 'ssss')}
  ${kachel('Regionstest', 'Crunchyroll — Regionstest', 'ruht', 'nie', '')}
</div>

<footer><span><b>2781</b> Titel · <b>609</b> Releases · <b>3127</b> Termine</span><span>geprüft 18:31</span></footer>
</body></html>`

const DETAIL = `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><style>
  body { margin: 0; width: 420px; font: 13px/1.45 -apple-system, "Segoe UI", sans-serif;
         background: #191b1f; color: #e6e7ea; }
  header { display: flex; align-items: baseline; gap: 8px; padding: 10px 12px 8px; }
  h1 { margin: 0; font-size: 15px; font-weight: 600; flex: 1; }
  .zurueck { color: #4a9eff; font-size: 12px; }
  .jetzt { margin: 0 12px; border: 1px solid #2f4a6b; border-radius: 8px; background: #1f2733;
           padding: 10px 11px; }
  .jetzt .kopf { font-weight: 600; color: #4a9eff; }
  .jetzt .ziel { color: #cfd2d8; margin-top: 4px; }
  .jetzt .balken2 { height: 6px; border-radius: 3px; background: #2c3442; margin: 8px 0 4px; }
  .jetzt .balken2 i { display: block; height: 100%; border-radius: 3px; background: #4a9eff; }
  .jetzt .schritt { color: #9aa0a8; font-size: 11px; }
  .abschnitt { color: #9aa0a8; font-size: 11px; text-transform: uppercase; letter-spacing: .5px;
               margin: 12px 12px 6px; }
  .block { border: 1px solid #333840; border-radius: 8px; background: #22252b; margin: 0 12px;
           padding: 9px 11px; }
  .block .ergebnis { font-size: 14px; font-weight: 600; color: #46c07a; }
  .block .bei { color: #9aa0a8; font-size: 11px; }
  .verlauf { border: 1px solid #333840; border-radius: 8px; background: #22252b; margin: 0 12px;
             padding: 7px 11px; }
  .vzeile { display: flex; align-items: center; gap: 7px; padding: 3px 0; }
  .vzeile .punkt, .block .punkt { width: 8px; height: 8px; border-radius: 50%; flex: none;
                                  background: #9aa0a8; }
  .vzeile .was { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vzeile .dauer, .vzeile .wann, .block .bei { color: #9aa0a8; font-size: 11px;
                                                font-variant-numeric: tabular-nums; }
  .s { background: #46c07a !important; } .f { background: #e05252 !important; }
  .w { background: #e0b341 !important; } .c { background: #5a6270 !important; }
  .gh { display: block; margin: 12px 12px 16px; padding: 9px; text-align: center; color: #4a9eff;
        border: 1px solid #333840; border-radius: 8px; background: #22252b; font-weight: 600; }
  .entwurf { background: #2a2f3a; color: #9aa0a8; font-size: 11px; letter-spacing: .4px;
             padding: 4px 12px; text-transform: uppercase; }
</style></head><body>
<div class="entwurf">Entwurf · Detailansicht einer Lauf-Art</div>
<header><span class="zurueck">‹ Lauf-Arten</span><h1>Deploy auf GitHub Pages</h1></header>

<div class="jetzt">
  <div class="kopf">Läuft gerade · seit 1:18</div>
  <div class="balken2"><i style="width:100%"></i></div>
  <div class="schritt">Schritt 6 von 6 · Seite gebaut</div>
  <div class="ziel">Ziel: Prüfkette grün, neuer Stand auf GitHub Pages</div>
</div>

<div class="abschnitt">Letzter Lauf</div>
<div class="block"><span class="punkt s"></span> <span class="ergebnis">ok</span>
  <span class="bei">· vor 4 min · 1:35 · test(statusanzeige): Prueflauf holt auch die Pillen</span></div>

<div class="abschnitt">Verlauf</div>
<div class="verlauf">
  ${verlaufZeile('c', 'fix(statusanzeige): beim Ausfall den letzten guten Stand', '1:16', '16:26')}
  ${verlaufZeile('s', 'Deploy auf GitHub Pages', '1:32', '15:44')}
  ${verlaufZeile('s', 'chore(pruefliste): Listen und Pruefstand', '1:19', '13:39')}
  ${verlaufZeile('s', 'Deploy auf GitHub Pages', '1:54', '13:34')}
  ${verlaufZeile('c', 'fix(worker): ?zaehlen=1 liest nur seit dem letzten Datenlauf', '1:32', '12:14')}
  ${verlaufZeile('s', 'fix(bau): tote Crunchyroll-Serie ueber die Serienkennung finden', '3:31', '11:48')}
  ${verlaufZeile('w', 'Bestand — zusammenführen und bauen', '3:53', '11:44')}
  ${verlaufZeile('s', 'Deploy auf GitHub Pages', '1:32', '11:31')}
</div>

<div class="gh">Alle 42 Läufe auf GitHub ›</div>
</body></html>`

mkdirSync('docs', { recursive: true })
const browser = await chromium.launch()
const seite = await browser.newPage({ viewportSize: { width: 420, height: 780 }, deviceScaleFactor: 2 })
for (const [html, ziel] of [[ENTWURF, 'uebersicht'], [DETAIL, 'detail']]) {
  await seite.setContent(html)
  /* Ausschnitt statt `fullPage`: Sonst zieht ein überlaufendes Element das Bild in die Breite. */
  const hoehe = await seite.evaluate(() => document.documentElement.scrollHeight)
  await seite.screenshot({ path: `docs/lauf-status-entwurf-${ziel}.png`, clip: { x: 0, y: 0, width: 420, height: hoehe } })
}
await browser.close()
console.log('Entwurf gerendert: docs/lauf-status-entwurf-uebersicht.png, docs/lauf-status-entwurf-detail.png')
