<!doctype html><meta charset="utf-8"><title>Dialog-Vorschau</title>
<style>/* Der Knopf sitzt unten rechts, außerhalb von Netflix' eigenen Bedienelementen.
   Absichtlich nicht in der Steuerleiste: Die baut Netflix bei jedem
   Zustandswechsel neu auf, und ein Knopf darin verschwindet ständig. */
.ak-melder {
  position: fixed;
  right: 20px;
  bottom: 96px;
  z-index: 2147483000;
  padding: 10px 16px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  background: #161b22;
  color: #e6edf3;
  font: 600 13px/1.2 "Segoe UI", system-ui, sans-serif;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  transition: background .15s ease, border-color .15s ease;
}
.ak-melder:hover { border-color: #58a6ff; }

/* Die Farbe sagt, was der Klick melden würde — noch bevor er passiert. */
.ak-melder.ak-ja   { border-left: 3px solid #3fb950; }
.ak-melder.ak-nein { border-left: 3px solid #d29922; }
.ak-melder.ak-leer { border-left: 3px solid #8b949e; opacity: .7; }

.ak-melder.ak-erfolg { background: #1a3a24; border-color: #3fb950; }
.ak-melder.ak-fehler { background: #3a1a1a; border-color: #f85149; }

/* Ein Knopf, der gerade nichts zu melden hat, bleibt sichtbar — aber
   erkennbar untätig. */
.ak-melder:disabled { opacity: .55; cursor: default; }

/* --- Die Übersicht außerhalb des Players ---------------------------------- */

/* Sitzt tiefer als der Melde-Knopf, damit sich beide nie überdecken: Auf einer
   Titelseite kann Netflix zwischen Übersicht und Player wechseln, ohne dass die
   Seite neu lädt. */
.ak-uebersicht {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 2147483000;
  padding: 8px 14px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  background: rgba(22, 27, 34, 0.92);
  color: #e6edf3;
  font: 600 12px/1.2 "Segoe UI", system-ui, sans-serif;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
  transition: border-color .15s ease, background .15s ease;
}
.ak-uebersicht:hover {
  border-color: #58a6ff;
  background: #1c2430;
}

.ak-dialog {
  position: fixed;
  inset: 0;
  z-index: 2147483001;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.65);
}

.ak-kasten {
  display: flex;
  flex-direction: column;
  width: min(760px, 92vw);
  max-height: 80vh;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  background: #10141a;
  color: #e6edf3;
  font: 400 13px/1.45 "Segoe UI", system-ui, sans-serif;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
}

.ak-kopf {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.ak-kopf strong { font-size: 14px; }

.ak-suche {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 6px;
  background: #0b0e13;
  color: inherit;
  font: inherit;
}
.ak-suche:focus { outline: none; border-color: #58a6ff; }

.ak-zu {
  border: 0;
  background: none;
  color: #8b949e;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}
.ak-zu:hover { color: #e6edf3; }

.ak-liste { overflow-y: auto; padding: 6px 0; }

.ak-zeile {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 7px 16px;
}
.ak-zeile:hover { background: rgba(255, 255, 255, 0.04); }

.ak-titel {
  flex: 1;
  color: #79c0ff;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ak-titel:hover { text-decoration: underline; }

.ak-folgen { display: flex; flex-wrap: wrap; gap: 4px; }

/* Die Kürzel sind kein Schmuck: Sie sagen, welche Folge zu öffnen ist. Erledigte
   bleiben stehen statt zu verschwinden — sonst wüsste beim nächsten Mal niemand
   mehr, was schon durch ist. */
.ak-folge {
  padding: 1px 7px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 4px;
  color: #c9d1d9;
  font: 600 11px/1.5 ui-monospace, "Cascadia Mono", Consolas, monospace;
}
.ak-folge.ak-fertig {
  border-color: rgba(63, 185, 80, 0.5);
  background: rgba(63, 185, 80, 0.14);
  color: #7ee787;
}
.ak-hinweis { color: #8b949e; font-size: 11px; }

body{margin:0;background:#141414;height:100vh}</style>
<body>
<button class="ak-uebersicht">Anime-Kalender 256</button>
<div class="ak-dialog"><div class="ak-kasten">
<div class="ak-kopf"><strong>256 Titel zu prüfen</strong>
<input class="ak-suche" type="search" placeholder="Suchen"><button class="ak-zu">×</button></div>
<div class="ak-liste">
<div class="ak-zeile"><a class="ak-titel" href="#">7SEEDS</a><div class="ak-folgen"><span class="ak-folge" title="noch offen">2e01</span><span class="ak-folge" title="noch offen">2e12</span></div></div>
<div class="ak-zeile"><a class="ak-titel" href="#">7th Time Loop: The Villainess Enjoys a Carefree Life Married to Her Worst Enemy!</a><div class="ak-folgen"><span class="ak-folge" title="noch offen">1e01</span><span class="ak-folge" title="noch offen">1e12</span></div></div>
<div class="ak-zeile"><a class="ak-titel" href="#">86 EIGHTY-SIX</a><div class="ak-folgen"><span class="ak-folge" title="noch offen">1e01</span><span class="ak-folge" title="noch offen">1e11</span><span class="ak-folge" title="noch offen">2e01</span><span class="ak-folge" title="noch offen">2e12</span></div></div>
<div class="ak-zeile"><a class="ak-titel" href="#">A Whisker Away</a><div class="ak-folgen"><span class="ak-folge" title="noch offen">1e01</span></div></div>
<div class="ak-zeile"><a class="ak-titel" href="#">Aggretsuko</a><div class="ak-folgen"><span class="ak-folge" title="noch offen">1e01</span><span class="ak-folge" title="noch offen">1e10</span><span class="ak-folge" title="noch offen">2e01</span><span class="ak-folge" title="noch offen">2e10</span><span class="ak-folge" title="noch offen">3e01</span><span class="ak-folge" title="noch offen">3e10</span><span class="ak-folge" title="noch offen">4e01</span><span class="ak-folge" title="noch offen">4e10</span><span class="ak-folge" title="noch offen">5e01</span><span class="ak-folge" title="noch offen">5e10</span></div></div>
<div class="ak-zeile"><a class="ak-titel" href="#">Aggretsuko: We Wish You A Metal Christmas</a><div class="ak-folgen"><span class="ak-folge" title="noch offen">1e01</span></div></div>
<div class="ak-zeile"><a class="ak-titel" href="#">AJIN: Demi-Human</a><div class="ak-folgen"><span class="ak-folge" title="noch offen">1e01</span><span class="ak-folge" title="noch offen">1e13</span><span class="ak-folge" title="noch offen">2e01</span><span class="ak-folge" title="noch offen">2e13</span></div></div>
<div class="ak-zeile"><a class="ak-titel" href="#">Akira</a><div class="ak-folgen"><span class="ak-folge" title="noch offen">1e01</span></div></div>
<div class="ak-zeile"><a class="ak-titel" href="#">Altered Carbon: Resleeved</a><div class="ak-folgen"><span class="ak-folge" title="noch offen">1e01</span></div></div>
<div class="ak-zeile"><a class="ak-titel" href="#">Angel Beats!</a><div class="ak-folgen"><span class="ak-folge" title="noch offen">1e01</span><span class="ak-folge" title="noch offen">1e13</span></div></div>
<div class="ak-zeile"><a class="ak-titel" href="#">Angels of Death</a><div class="ak-folgen"><span class="ak-folge" title="noch offen">1e01</span><span class="ak-folge" title="noch offen">1e12</span></div></div>
<div class="ak-zeile"><a class="ak-titel" href="#">Appleseed Alpha</a><div class="ak-folgen"><span class="ak-folge" title="noch offen">1e01</span></div></div>
<div class="ak-zeile"><a class="ak-titel" href="#">Baki Hanma</a><div class="ak-folgen"><span class="ak-folge" title="noch offen">1e01</span><span class="ak-folge" title="noch offen">1e12</span></div></div>
<div class="ak-zeile"><a class="ak-titel" href="#">Baki Hanma VS Kengan Ashura</a><div class="ak-folgen"><span class="ak-folge" title="noch offen">1e01</span></div></div>
</div></div></div>