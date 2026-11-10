---
name: link-vorschaubilder
description: "Link-Vorschau beim Teilen (WhatsApp, Discord, Telegram, Slack …): Open Graph, Twitter Cards, og:image 1200×630 im Build, SPAs und Hash-Routing, Caches der Netzwerke."
---

# Link-Vorschaubilder

## Der eine Satz, aus dem alles folgt

**Kein einziger dieser Dienste führt JavaScript aus.** WhatsApp, Discord, Telegram, Slack,
iMessage, Signal, Facebook, LinkedIn, Bluesky — sie holen die HTML-Datei, lesen die
`<meta>`-Angaben im `<head>` und hören dann auf. Was eine App nach dem Start ins DOM schreibt,
sieht keiner von ihnen.

Daraus folgt alles Weitere:

- Eine SPA mit einer einzigen `index.html` hat **eine** Vorschau — für jede Route dieselbe.
- Eine Vorschau je Unterseite braucht **je eine echte Datei unter einem echten Pfad**.
- `document.title` oder eine Meta-Service-API des Frameworks zur Laufzeit ändert **nichts**.

## Fallstrick Nummer eins: Hash-Routing

Alles ab dem `#` wird vom Browser **nie an den Server geschickt**. Bei
`example.com/#/produkt/42` bekommt der Server `example.com/` — und der Crawler ebenso.
Hash-Adressen können prinzipbedingt keine eigene Vorschau tragen.

Lösung: eigene Teilen-Adressen als echte Pfade erzeugen, z. B. `/r/<slug>/index.html`, die
- die passenden Meta-Angaben tragen,
- dieselbe App laden (Kopie der gebauten `index.html`),
- und vor dem Start der App den Hash setzen:

```html
<script>
  // Klassische Inline-Skripte laufen vor dem deferred Modul-Skript der App.
  if (!location.hash) location.hash = "#/produkt/42";
</script>
```

Für Besucher ist der Umweg unsichtbar, für Crawler ist es eine ganz normale Seite.

## Das Muster: Marker in der Quell-HTML, Tausch im Build

In der Quell-`index.html` einen Block zwischen Markern anlegen:

```html
<!-- social:start -->
<title>…</title>
<meta name="description" content="…" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://…/" />
<meta property="og:title" content="…" />
<meta property="og:description" content="…" />
<meta property="og:image" content="https://…/og/default.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="…" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="…" />
<meta name="twitter:description" content="…" />
<meta name="twitter:image" content="https://…/og/default.png" />
<!-- social:end -->
```

Ein Nachbereitungsschritt nach dem Build kopiert die gebaute `index.html` je Unterseite und
tauscht nur diesen Block. Der `<title>` steht bei manchen Frameworks **vor** dem Block — dann
beim Kopieren zusätzlich den alten `<title>` entfernen, sonst stehen zwei drin.

Referenz-Umsetzungen auf diesem Rechner:
- `C:\code\ai\anime-kalender-de\pipeline\build-share-pages.ts` — eine Seite je Datensatz
- `<anderes Projekt>\tools\social-preview.js` — eine einzelne Sonderroute

## Pflichtangaben, die wirklich zählen

| Angabe | Warum |
|---|---|
| `og:image` mit **absoluter** URL | relative Pfade werden von mehreren Diensten ignoriert |
| `og:image:width` / `:height` | ohne sie zeigen manche Clients erst nach dem Laden etwas, oft gar nichts |
| `og:title`, `og:description` | ohne Beschreibung wirkt die Karte leer |
| `twitter:card = summary_large_image` | sonst nur ein winziges Vorschaubild |
| `og:url` | verhindert doppelte Einträge bei geteilten Varianten derselben Seite |

**Format:** 1200×630 Pixel, PNG oder JPEG, unter 5 MB (WhatsApp bricht früher ab, dort lieber
unter 300 KB bleiben). SVG funktioniert **nicht** — kein einziger großer Dienst rendert es.

## Bilder im Build erzeugen

Für datengetriebene Seiten lohnt es, das Bild aus den Daten zu bauen statt es zu malen:
SVG als Vorlage schreiben, mit `sharp` nach PNG rendern, fertige Bilder in den
`public`-Ordner legen.

```ts
await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#0a0e17' } })
  .composite([
    { input: Buffer.from(hintergrundSvg), top: 0, left: 0 },
    { input: coverPng, top: 0, left: 0 },
    { input: Buffer.from(textSvg), top: 0, left: 0 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(datei)
```

**Reihenfolge der Ebenen beachten.** Ein Text-SVG mit deckendem Hintergrund-Rechteck löscht
alles darunter. Hintergrund und Text müssen getrennte Ebenen sein, das Bild dazwischen.

**SVG kann keinen Textumbruch.** Zeilen von Hand brechen. Ohne Schriftmetrik ist
`zeichenbreite ≈ 0,52 × Schriftgröße` eine brauchbare Schätzung für gemischten deutschen Text;
passt der Titel nicht, lieber eine Stufe kleiner werden als abschneiden.

**Emoji vermeiden.** In der SVG-Renderpipeline kommen oft leere Kästchen heraus, weil die
Farb-Emoji-Schrift fehlt.

## Testen — nicht raten

| Dienst | Werkzeug |
|---|---|
| Facebook, Instagram, WhatsApp | <https://developers.facebook.com/tools/debug/> |
| LinkedIn | <https://www.linkedin.com/post-inspector/> |
| Bluesky | <https://bsky-og-card-preview.vercel.app/> |
| Alle auf einmal | <https://www.opengraph.xyz/> |

Ohne solche Werkzeuge: `curl -A "facebookexternalhit/1.1" <url>` holt genau das, was ein Crawler
sieht — die reine HTML-Datei ohne jedes JavaScript.

## Caches

Die Netzwerke merken sich die Vorschau **tage- bis wochenlang**. Ändert sich das Bild, zeigen sie
weiter das alte. Zwei Wege:

1. Beim Facebook-Debugger „Scrape Again" drücken (wirkt auch für WhatsApp).
2. Dateinamen ändern (`og/produkt-42.v2.png`) — wirkt überall und sofort.

**Ein Query-Anhang an der Seitenadresse (`?v=2`) umgeht den Seiten-Cache nicht**, solange
`og:url` auf die kanonische Adresse zeigt — Facebook/WhatsApp führen jede Variante auf sie zurück
und zeigen deren alte Vorschau. Erst live mit `curl -A "facebookexternalhit/1.1"` belegen, dass
der Server Neues liefert; dann bleibt nur „Scrape Again" auf der kanonischen Adresse.

Deshalb: **vor** dem ersten Teilen prüfen, nicht danach.

## Vor dem Abhaken prüfen

- [ ] Bild ist 1200×630 und über eine **absolute** URL erreichbar
- [ ] `og:image:width`/`:height` gesetzt
- [ ] Jede teilbare Unterseite hat eine eigene Datei mit eigenen Angaben
- [ ] Hash-Routen haben eine echte Teilen-Adresse bekommen
- [ ] Kein doppelter `<title>` in den erzeugten Dateien
- [ ] Mit einem Debugger geprüft, nicht nur im Browser angeschaut
- [ ] Im Produkt gibt es einen Teilen-Knopf, der **diese** Adresse kopiert — nicht die aus
      der Browserleiste
