# Reihen-Box als Cover-Karussell — Entwurf (Fable, 20.10.2026)

Auftrag Daniel (20.10.2026): „reihen box design ändern. 1 zeile je type (zB hauptserie) mit covern und swiping links rechts mobile, und arrow links rechts desktop. arrow klicks sollen mehrere springen (soviele in view passen), nicht einzeln. Sinn: Größere Cover anzeigen, sodass man visuell inspiriert wird.“
Mockup: `mockups/reihen-karussell.html` (hell/dunkel × 375/512 px; Fälle Edgerunners, Attack on Titan, Gantz). Das Mockup ist die Vorlage, der Bühnen-Vergleich (unten) der spätere Test.

## Komponenten (Neues = eigene Datei, nichts in `reihen-liste.tsx` anbauen)

- **Neu `reihen-spur.tsx`** — eine Gruppenzeile: Kopf (Überschrift `text-t5 uppercase`, Linie, Pfeilpaar) + Scroller `role="tablist"`. Hält `ref` auf die Spur, Pfeilzustand als State, `useLayoutEffect` für die Startposition.
- **Neu `reihen-cover.tsx`** — eine Karte (`button role="tab"`): Cover-Hülle 2:3 mit Stern/Marke, Name (`ZeilenName`, 2 Zeilen), Angaben (`format · jahr · n Fg.` wie heute, `reihen-liste.tsx` Z. 269–326 → in eine reine Funktion `angabenZeile(m, offen, t)` in `reihen-regeln.ts` ziehen).
- **Neu `reihen-spur-regeln.ts`** — reine Funktionen ohne DOM, mit Test: `sprungWeite(clientWidth, kartenBreite, luecke)` = `floor(clientWidth / (kartenBreite + luecke)) · (kartenBreite + luecke)`, mindestens eine Karte; `pfeilZustand(scrollLeft, clientWidth, scrollWidth)` → `{ versteckt, zurueckAus, weiterAus }` (Toleranz 1 px); `startPosition(offsetLeft, sprungWeite)` = `floor(offsetLeft / sprungWeite) · sprungWeite`.
- **Ändert `reihen-liste.tsx`**: `zeile()` (Z. 155–336) und die Gruppenschleife (Z. 402–424) werden `gefiltert.map(g => <ReihenSpur …/>)`; Reiter-Logik (`reiterZeile`, `mitReitern`, `aktiverReiter`, `angezeigt`) entfällt, `gefiltert` wird direkt gezeigt; `max-h-[22rem] overflow-y-auto` am `[data-reihe-liste]` entfällt (kein Innen-Scroll mehr, siehe unten); `ref={zeileInListeSichtbar}` entfällt. Datei muss dabei deutlich schrumpfen (`check:umfang`).
- **Ändert `reihen-kopf.tsx`**: Props `reiterZeile`, `reiter`, `aktiv`, `onReiter` und der Reiter-Block entfallen; `sticky` entfällt (nichts scrollt mehr innen); Höhe bleibt eine 44-px-Zeile (Suche + Schalter). **Ändert `reihen-regeln.ts`**: `zeileInListeSichtbar` löschen. **Ändert `DetailPanel.tsx`**: State `reiheReiter` (Z. 219, 549, 552) und Prop entfallen.
- Unverändert: `reihen-karte.tsx` (Kopf + `reihenZeile`), `reihen-gruppen.ts`, `reihen-daten.ts`, `reihen-namen.ts`, `reihen-marke.tsx`, `zeilen-name.tsx`. Neue i18n-Schlüssel: `detail.reiheZurueck` („Vorherige Teile“), `detail.reiheWeiter` („Weitere Teile“).

## Mechanik

- Spur: `position: relative; display: flex; gap: 8px; overflow-x: auto; scroll-snap-type: x mandatory; overscroll-behavior-x: contain; scrollbar-width: none; padding: 4px; margin: -4px; scroll-padding-inline: 4px`; `scroll-behavior: smooth` nur unter `@media (prefers-reduced-motion: no-preference)`. Karte: `flex: 0 0 120px; scroll-snap-align: start`.
- Pfeile: `scrollBy({ left: ±sprungWeite })` — die Snap-Punkte fangen den Rest ab, es landet immer eine Kartenkante vorn. Zustand nach `scroll` (ein `requestAnimationFrame`, `passive`) und über `ResizeObserver` auf der Spur; `hidden`, wenn `scrollWidth ≤ clientWidth + 1`; `disabled` am Anfang/Ende.
- Start: `spur.scrollLeft = startPosition(gewaehlt.offsetLeft, sprungWeite)` im `useLayoutEffect` — **nie `scrollIntoView`**, das scrollte das Panel vor (`panel-bild.mjs`, 09.10.2026). Beim Wechsel der Staffel (`wechsleZu`) denselben Effekt mit `title.id` als Abhängigkeit.
- Pfeiltasten links/rechts im `tablist` bewegen den Fokus zur Nachbarkarte (`keydown` auf der Spur, `preventDefault`); der Browser zieht die Spur zum Fokus nach. Tab erreicht jede Karte wie heute.

## Maße und Breakpoints

- Cover **120 × 180 CSS-px** auf allen Breiten (Panel ist `max-w-lg` = 512 px, innen ≈ 456 px; Handy 375 px innen ≈ 319 px). Ergibt Handy 2 ganze + ½ Cover, Panel 3 ganze + ⅗ Cover — der angeschnittene Rand ist die Wisch-Aufforderung; Sprung = 2 bzw. 3 Cover. Gegenentwurf 96 × 144 (3 bzw. 4 je Seite) steht als offene Frage im Bericht; Empfehlung 120 (Daniels Zweck: „visuell inspiriert“).
- Zeilenhöhe fest: Cover 180 + Name 2 × 18 + Angaben 16 + Kopf 32 + Lücken ≈ 258 px; Name bekommt `min-height: 36px`, damit einzeilige Namen nichts verschieben.
- Pfeile nur mit Maus: `@media (hover: none) { .pfeile { display: none } }`; Tippziel 44 × 44 px (`min-h-11 min-w-11`), Zeichen `‹ ›`, Hover `bg-ak-flaeche-2`, `disabled:opacity-30`.

## Mobile Performance (Leitziel)

- Bild: `coverBild(m.cover, 120, '120px', KACHEL_DICHTE)` → AniList `medium` (230 w), bei `navigator.connection?.saveData` Dichte 1 (`small`). `<img width="120" height="180" loading="lazy" decoding="async" alt="">` in einer Hülle mit `aspect-ratio: 2/3; background: var(--ak-flaeche-2)` — Höhe steht vor dem Bild, kein Layout-Shift; `onError` lässt die graue Fläche stehen.
- `loading="lazy"` allein reicht nicht: Chrome lädt bis 1250 px (langsam 2500 px) voraus, bei 128 px je Karte also fast jede Zeile ganz. Deshalb rendert `ReihenSpur` das `<img>` erst, wenn die Karte im Scroller sichtbar war (`IntersectionObserver` mit `root: spur`, `rootMargin: '0px 100% 0px 0px'`, einmalig, Set sichtbarer IDs im State). Beim Öffnen laden so je Zeile 3–4 Cover.
- Messen vor Freigabe (Bilanz, nicht Bestätigung): Attack on Titan öffnen, Handy 390 px, 4G langsam, CPU 4× (`web-best-practice`, Messrezept) — Bytes der Cover vorher/nachher, CLS ≤ 0,1, kein Long Task > 50 ms beim Wischen. Riegel: höchstens 12 Cover-Anfragen beim Öffnen, Mehrvolumen gegenüber heute ≤ 400 KB; darüber ist der Entwurf nicht fertig (dann 96 px oder Dichte 1).

## Barrierefreiheit und Zustände

- Spur `role="tablist" aria-labelledby=<id der Gruppenüberschrift>`; Karte `role="tab" aria-selected`, `disabled` während `wechselt` wie heute; Pfeile `type="button" aria-label=t('detail.reiheZurueck'|'detail.reiheWeiter') aria-controls=<id der Spur>`; Fokus `focus-visible:outline-2 outline-ak-fokus outline-offset-2`.
- Gewählt: Cover `outline 2px var(--ak-akzent)` + Name `text-ak-akzent-text font-semibold`. Gemerkt: `★` links oben auf dunkler Pille (`text-ak-favorit`, `aria-label=t('card.unfavourite')`). Ohne Synchro / Geplant: `SynchroMarke` rechts oben auf dem Cover, Cover `opacity-55`. Künftig: Cover `outline 1px dashed var(--ak-leise)`, `opacity-70`. Nur `ak-*`-Tokens, keine `slate-`/`sky-` (`design-klassen.mjs` muss sinken).
- Nichts doppelt auf dem Bildschirm: keine Zahl im Gruppenkopf (steht in `reihenZeile` „5 Filme · 15 Specials“), kein Reihenname auf den Karten (steht im Panelkopf), Marke nur einmal je Karte (`SynchroMarke` entscheidet).

## Was entfällt, was bleibt, was geprüft wird

- Entfällt: Reiter (jede Gruppe ist eine Zeile), Innen-Scroll der Liste mit 22 rem (drei verschachtelte Scrollbereiche auf dem Handy wären zu viel; das Panel scrollt), `zeileInListeSichtbar`, `reiheReiter`. Bleibt: Suche ab 15 Teilen (filtert alle Zeilen), Schalter „n ohne Synchro“ (eingeklappte Teile bleiben eingeklappt), Gruppenreihenfolge und Sortierung aus `reihen-gruppen.ts`.
- `panel-vergleich.mjs` ist hier **kein** Beweis (die Darstellung ändert sich absichtlich); er taugt nur für den vorbereitenden Umbau-Commit (`angabenZeile` herausziehen, Reiter-State entfernen), der vor dem Verhaltens-Commit liegt (Regel „Umbau und Verhaltensänderung nie im selben Commit“).
- Prüfbild: `web/buehne/mockups/reihen-box.tsx` bekommt Variante B mit `ersatz: { ReihenListe: ReihenListeKarussell }` (Weiche anlegen, falls fehlt); `npm run buehne:bilder -- --mockup reihen-box` hell/dunkel × Handy/Desktop muss dem Mockup gleichen, `npm run buehne:messen` grün (Tippziele ≥ 44 px, Kontrast AA auch für den Stern auf der Pille).
- `check:panel`: `panel-bild.mjs` (Panel öffnet nicht vorgescrollt — bleibt wahr, weil nur `scrollLeft` der Spur gesetzt wird), `panel-messen.mjs` (Tippziele). `tools/design-info.test.mjs` Z. 62/67 bleiben gültig (`reihen-karte`, `reihen-marke` unverändert). Neuer Test `reihen-spur-regeln.test.ts` für die drei Funktionen.

## Entscheidung und Umsetzung (Daniel, 20.10.2026, F54)

- Cover 120 × 180, Wischen mit Einrasten, alle Gruppen offen untereinander, Pfeile rechts im Gruppenkopf (44 px), ein Klick springt so viele Cover weiter, wie sichtbar sind.
- Dazu: Zu lange Namen (ab 29 Zeichen, `brauchtTooltip`) bekommen einen Tooltip mit dem vollen Namen; der Text bleibt vollständig im DOM, der Screenreader liest ihn. Ein Klick auf ein Cover öffnet den Teil und setzt den Panel-Container (`data-panel="titel"`, `fixed inset-y-0 overflow-y-auto`) auf Anfang — am Handy und am Desktop derselbe Container.
- Umgesetzt als `reihen-spur.tsx`, `reihen-cover.tsx`, `reihen-spur-regeln.ts`; der Umbau (`reihen-teil.ts`: Namen, Angaben, Künftig-Regel) steht in einem eigenen Commit davor. Test: `pipeline/check-reihen-spur.ts` (in `check:logic`).
- Abweichung vom Entwurf: Das Bild lädt, sobald die Karte eine Spurbreite vor dem sichtbaren Bereich steht (`IntersectionObserver` je Karte, Wurzel = Spur), statt über ein Set sichtbarer IDs in der Spur.
- Die Mockup-Weiche in `web/buehne/mockups/reihen-box.tsx` (Variante B) entfällt: Die echte Liste ist jetzt das Karussell.
- Messung der Cover-Anfragen (Riegel 12 Anfragen, +400 KB beim Öffnen) steht noch aus; sie braucht einen Browserlauf.
