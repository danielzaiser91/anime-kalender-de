---
name: netzwerkverkehr-statt-scraping
description: "Bevor Abrufcode gegen eine fremde Webseite entsteht: erst API, dann Netzwerkverkehr (XHR/JSON), HTML zuletzt; Token, Bot-Sperre."
---

# Erst den Netzwerkverkehr lesen, dann scrapen

## Die Regel

Bevor ein Scraper entsteht, wird in **dieser** Reihenfolge geprüft:

1. **Gibt es eine dokumentierte API?** Suchbegriff `<domain> api documentation rate limit`.
2. **Woher holt die Seite selbst ihre Daten?** Fast jede moderne Seite ist eine
   JavaScript-Anwendung, die ihren Inhalt über JSON nachlädt. Diese Schnittstelle ist da,
   auch wenn niemand sie dokumentiert hat.
3. **Erst wenn beides nichts ergibt: das gerenderte HTML lesen.**

**Punkt zwei ist der, den man überspringt.** „Es gibt keine öffentliche API" heißt nur, dass
keine dokumentiert ist — nicht, dass keine existiert.

## Der reale Fall, an dem es hängt

Zehn Tage lang hat ein Projekt Crunchyrolls Serienseiten mit Playwright geladen, bis zu
zwanzig Sekunden auf gerenderte Elemente gewartet und Textmuster gelesen („Audio: Deutsch").
Daraus wurden: eine Trefferquote von 12 Prozent bei einer Adressform, 975 falsche Angaben,
mehrere Reparaturläufe, und zuletzt eine Hochrechnung von 216 Minuten für 560 Serien.

Daniel am 21.08.2026: „prüf ob du die infos direkt aus crunchy network traffic lesen kannst,
dann brauch man nicht auf seitenelemente warten."

Die Seite holt ihre Daten über `/content/v2/cms/…` als JSON. Ergebnis desselben Nachmittags:

| | HTML lesen | die Schnittstelle der Seite |
|---|---|---|
| Zeit je Abruf | 5 bis 23 Sekunden | **70 bis 200 Millisekunden** |
| Grundlage | Textmuster im gerenderten HTML | strukturiertes JSON |
| Genauigkeit | Staffelebene, geraten | **je Folge, belegt** |
| Übersetzungsabhängig | ja — die Zeile heißt je Sprache anders | nein |

Sein Urteil danach: „du hättest es direkt am anfang vor dem scraping vor tagen bereits
erkennen müssen."

## Der Handgriff: mitlesen, was die Seite tut

```js
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ locale: 'de-DE' })

page.on('response', async (r) => {
  const typ = r.headers()['content-type'] ?? ''
  if (!typ.includes('json')) return
  console.log(r.status(), r.url().slice(0, 120))
})

await page.goto('https://beispiel.de/die/seite')
await page.waitForTimeout(6000)
await browser.close()
```

Was in der Liste steht, ist die Antwort. Fremde Adressen (Zustimmungsbanner, Analyse,
Werbung) fallen sofort auf; was übrig bleibt, gehört der Seite selbst.

**Danach den Inhalt ansehen**, nicht nur die Adresse: `await r.json()` im selben Handler.
Oft steckt die gesuchte Angabe in einem Feld, das die Anzeige gar nicht darstellt.

## In einer fremden Seite mitlesen: am Ergebnis ansetzen, nie am Aufruf

Gilt, sobald eine **Erweiterung** in einer Seite mitliest, die jemand anderem gehört — also
überall dort, wo `robots.txt` einen Direktabruf verbietet und der Mensch die Seite selbst
öffnet.

Der naheliegende Griff ist der falsche. Am 22.08.2026 haben zwei Anläufe Netflix lahmgelegt,
beide mit Fehlercode NSES-UHX, beide mitten in Daniels Sitzung:

1. **`window.fetch` und `XMLHttpRequest.prototype.open` ersetzen.** Netflix setzt beide danach
   selbst neu — die Hüllen waren weg. Harmlos, aber wirkungslos.
2. **Dieselben Stellen hinter einen Zugriffsschutz legen** (`defineProperty` mit Getter, damit
   sie nicht überschrieben werden können). Netflix liest beim eigenen Wrappen zuerst den
   bestehenden Wert, bekam durch den Getter die Hülle, und beide riefen einander auf.
   *Maximum call stack size exceeded*, die Seite lud nicht mehr.

Der dritte Anlauf trug, und der Unterschied ist die Regel:

> **Umhülle, was die Seite *liest*, nicht was sie *aufruft*.**

- `Response.prototype.json` — jede `fetch`-Antwort läuft hindurch
- `XMLHttpRequest.prototype.responseText` — der Getter, den jede XHR-Auswertung anfasst

Beide sind Eigenschaften, die eine Seite **liest** und nie ersetzt. Die native Funktion liegt in
einer Closure, niemand kann sie verdrängen, und niemand verwendet den eigenen Wert als
„Original" weiter — die Schleife aus Anlauf 2 kann nicht entstehen. Der Rückgabewert ist
unverändert der native, ein `clone()` ist unnötig: gelesen wird das fertige Objekt, nicht der
Datenstrom.

Drei Bedingungen, sonst wird auch dieser Weg gefährlich:

- **Jede eigene Zeile in `try`**, und der Rückgabewert kommt aus dem nativen Aufruf. Geht bei
  uns etwas schief, merkt die Seite nichts.
- **Auf eine Adresse filtern.** Netflix liest `responseText` hunderte Male; nur die eine
  Metadaten-Adresse wird ausgewertet.
- **Nichts verändern.** Wer den Wert anfasst, baut einen Fehler ein, den niemand mehr findet.

**Zwei Wege sind ausgeschlossen und brauchen keinen Versuch:** `PerformanceObserver` mit
`resource`-Einträgen liefert Adresse, Zeit und Größe — nie den Inhalt. `chrome.webRequest` gibt
es in Manifest v3 ohne Body-Zugriff; allein `chrome.debugger` käme dran und hängt ein
Debugger-Banner an den Browser.

**Was es einbringt, rechtfertigt den Aufwand.** Die Seite weiß Dinge, die im sichtbaren Text
nicht stehen: Netflix meldete zu „Sword Art Online" `[{seq:1, folgen:25, erste:1}, {seq:2,
folgen:24, erste:1}]` — und das `erste: 1` widerlegte die Annahme, der Anbieter zähle über die
Staffeln hinweg durch (bei „Jujutsu Kaisen" tut er es, bis 59). Ohne diese Auskunft wäre ein
Befund an die falsche Staffel geschrieben worden, und er hätte ausgesehen wie ein geprüfter.
Aus derselben Antwort folgte, dass Netflix zwei unserer vier Staffeln unter dieser Adresse gar
nicht führt.

**Und der Preis für einen Fehlversuch ist hoch.** Zweimal war die Seite unbenutzbar, während
jemand sie benutzen wollte. Wer hier baut, gibt vorher den Notausschalter mit — in
`chrome://extensions` ausschalten, dann läuft die Seite sofort wieder — und schreibt einen
Test, der **den Absturzfall** nachstellt: die Seite wrappt selbst, danach darf nichts
überlaufen. Ein Test, der nur „wir sehen die Antwort" prüft, hätte beide Anläufe bestanden.

## Braucht die Schnittstelle ein Token?

Meist ja, und meist gibt es die Seite selbst her. Mitlesen, wie sie es holt:

```js
page.on('request', (r) => {
  if (!/token|auth|session/i.test(r.url())) return
  console.log(r.method(), r.url())
  console.log(r.headers()['authorization'], '|', r.postData())
})
```

Bei Crunchyroll war es ein anonymer Zugang ohne Anmeldung:
`POST /auth/v1/token`, `authorization: Basic Y3Jfd2ViOg==` (das ist `cr_web:`),
`grant_type=client_id`. Antwort: ein Bearer-Token für die Content-Aufrufe.

## Die Grenze: Direktabruf scheitert oft, aus dem Browser heraus nicht

Ein `fetch` von außen bekommt bei Cloudflare-geschützten Seiten eine Bot-Sperre
(HTTP 403, `Just a moment…`). Der Weg bleibt dann der Browser — aber nur noch **einmal zum
Aufwärmen**:

```js
// Einmal eine Seite laden, Token mitnehmen …
let token = null
page.on('response', async (r) => {
  if (r.url().includes('/auth/v1/token') && r.status() === 200 && !token) {
    token = (await r.json().catch(() => null))?.access_token
  }
})
await page.goto('https://beispiel.de/irgendeine/seite')

// … danach nur noch JSON, im Browser-Kontext, mit dessen Cookies
const daten = await page.evaluate(
  async ([pfad, tok]) => {
    const r = await fetch(pfad, { headers: { authorization: `Bearer ${tok}` } })
    return r.ok ? await r.json() : { fehler: r.status }
  },
  ['/content/v2/…', token],
)
```

Gemessen: 1.310 ms Aufwärmen, danach 70 bis 208 ms je Abruf.

## Vier Fallen, alle real

**Ein Feldname ist keine Bedeutung.** Crunchyrolls `is_dubbed` steht auf `true`, sobald es
**irgendeine** Synchronfassung gibt — auch bei einer Folge, die nur englisch, italienisch und
spanisch vorliegt. Wer das Feld für „deutsch synchronisiert" hält, hält jede Folge dafür.
Maßgeblich war ein Eintrag `de-DE` in einer Liste `versions`. **Prüf jedes Feld an einem Fall,
dessen Antwort du unabhängig kennst.**

**Die Kennung im Pfad ist nicht immer die, die zählt.** Derselbe Endpunkt lieferte für die
Kennung der deutschen Fassung trotzdem die Daten der Originalfassung. Die deutsche war ein
eigenes Objekt unter eigener Kennung. Ein Datumsfeld sah dadurch plausibel aus und war um
sechs Wochen falsch — aufgefallen nur, weil Daniel den richtigen Termin kannte.

**Platzhalter sehen aus wie Daten.** `availability_starts: 9998-11-30` ist kein Datum,
sondern ein „nie". Ein Vergleich `datum > heute` hält das für einen künftigen Termin.

**Sammelabrufe sind oft möglich und werden übersehen.** `objects/<id1>,<id2>,<id3>` lieferte
alle drei auf einmal. Ohne diesen Griff wären aus 959 Serien über zehntausend Einzelaufrufe
geworden.

## Von wo abgerufen wird, ist Teil der Frage

Eine Schnittstelle antwortet nicht der Welt, sondern **dem Anrufer** — und der steht irgendwo.
Bei Streamingdiensten, Shops, Preisseiten und allem mit Lizenzen ist die Region kein Detail,
sondern die halbe Antwort.

**Cloud-Läufe stehen fast immer in den USA.** GitHub-Runner, die meisten CI-Dienste, viele
Funktionslaufzeiten. Wer von dort abruft und die Antwort für die eigene Region hält, misst das
falsche Land — und merkt es nicht, weil die Daten vollständig und plausibel aussehen.

Real am 21./22.08.2026: Ein Lauf las 693 Crunchyroll-Serien über die Content-API und schrieb
die Rohantworten mit. Jede einzelne trug `eligible_region: "US"` — 1.655 geprüfte Folgen, keine
Ausnahme. Aufgefallen ist es erst, als ein Mensch zwei Befunde von Hand nachprüfte: eine Serie,
die laut Antwort keine deutsche Tonspur hat, hatte in Deutschland 277 deutsche Folgen; eine
andere lieferte vollständige Daten, während die deutsche Seite „nicht mehr verfügbar" zeigte.

**Die beiden Richtungen sind unterschiedlich verlässlich**, und das ist die brauchbare
Faustregel:

| | aus fremder Region |
|---|---|
| „Es gibt X" | oft trotzdem gültig — Objektlisten sind meist global |
| „Es gibt X nicht" | **wertlos** — es kann am Katalog der Region liegen |

**Prüfgriff, bevor die erste Zeile ausgewertet wird:** In der Rohantwort nach `region`,
`eligible_region`, `country`, `locale`, `market`, `geo` suchen. Steht dort etwas anderes als
erwartet, ist die Messung eine andere als die geplante. Und `locale=de-DE` in der Adresse regelt
in aller Regel nur die **Sprache der Texte**, nicht den Katalog — der hängt an der IP.

**Wege zur richtigen Region**, in der Reihenfolge, in der man sie prüfen sollte: ein
Regionsparameter der Schnittstelle selbst; ein angemeldeter Zugang, dessen Konto die Region
trägt; ein Lauf vom eigenen Rechner; zuletzt ein Proxy. Geht keiner davon, wird die Auswertung
auf die belastbare Richtung beschränkt — und das gehört dokumentiert, nicht stillschweigend
angenommen.

## Ergebnisse in die Zwischenablage: nicht aus einem Promise heraus

`copy(...)` in den DevTools und `navigator.clipboard.writeText(...)` verlangen einen
**Benutzerkontext**. Steht der Aufruf am Ende einer Promise-Kette, ist dieser Kontext verbraucht:
Die Konsole zeigt `Promise {<pending>}`, das Ergebnis erscheint später — und die Zwischenablage
bleibt leer. Real am 22.08.2026, zweimal hintereinander; Daniel musste beide Ausgaben von Hand
herauskopieren.

**Der Weg, der trägt** (Daniels Vorschlag, 22.08.2026): ein Eingabefeld auf der Seite, das der
Skriptlauf füllt. Auf dessen `input`-Ereignis hört ein Handler, der **synchron** kopiert — dort
gilt der Benutzerkontext wieder.

```js
const feld = Object.assign(document.createElement('textarea'), {
  style: 'position:fixed;left:-9999px',
})
feld.addEventListener('input', () => {
  feld.select()
  document.execCommand('copy')   // synchron, deshalb erlaubt
  feld.remove()
})
document.body.appendChild(feld)

holeDaten().then((ergebnis) => {
  feld.value = JSON.stringify(ergebnis, null, 1)
  feld.dispatchEvent(new Event('input'))
  console.log(feld.value)        // zusätzlich, falls doch etwas klemmt
})
```

**Immer zusätzlich `console.log`.** Was in der Zwischenablage landet, sieht niemand; was in der
Konsole steht, lässt sich notfalls markieren.

## Was trotzdem gilt

- **`robots.txt` gilt auch für die Schnittstelle.** Sie ist Teil derselben Seite. Prüfen, ob
  der Pfad gesperrt ist — bei Crunchyroll waren `/content/` und `/auth/` frei, Suche, Konto
  und Bezahlseiten nicht.
- **Die Taktung bleibt rücksichtsvoll.** Dass ein Abruf jetzt 200 Millisekunden dauert, ist
  kein Grund, mit voller Geschwindigkeit über tausend Adressen zu fahren.
- **Rohantworten archivieren.** Bei JSON gilt das doppelt: Es sind alle Felder da, auch die
  heute ungenutzten. Ein später gebrauchtes Feld ist dann eine Änderung am Parser statt eines
  zweiten Laufs.
- **Der alte Weg bleibt als Rückfallebene** hinter einem Schalter. Eine undokumentierte
  Schnittstelle kann sich ohne Ankündigung ändern.

## Gilt robots.txt auch ohne Rendering?

**Ja.** Die Frage kam am 21.08.2026 auf, als der Umstieg vom HTML-Lesen auf die
JSON-Schnittstelle anstand — sie ist berechtigt und die Antwort eindeutig.

`robots.txt` regelt nicht, **wie** abgerufen wird, sondern **wer** abruft. Der Standard
(RFC 9309) spricht von „automatic clients". Ob dahinter ein Headless-Browser mit Rendering
steht, einer ohne, oder ein nacktes `fetch`, kommt darin nicht vor.

Die Trennlinie verläuft woanders: **Sieht ein Mensch eine einzelne Seite an, oder geht ein
Programm systematisch tausend Adressen durch?** Das Zweite ist Crawling, egal mit welcher
Technik.

Praktische Folge — am selben Tag entschieden:

| Ziel | robots.txt | erlaubt? |
|---|---|---|
| Crunchyroll `/content/`, `/auth/` | nicht gesperrt | ja, mit und ohne Rendering |
| Netflix `Disallow: /` | alles gesperrt außer benannten Suchmaschinen | nein — auch ein JSON-Abruf wäre ein Verstoß |

Der Umstieg auf die Schnittstelle ändert an der Rechtslage also **nichts**. Er macht denselben
erlaubten Zugriff nur schneller. Wäre `/content/` gesperrt gewesen, wäre der ganze Weg trotz
hundertfacher Geschwindigkeit zu.

**Und `robots.txt` ist nicht das Ende der Prüfung.** Sie ist der ausgesprochene Wille des
Betreibers; rechtlich bindend sind die Nutzungsbedingungen. Beide werden gelesen, nicht nur
die erste. Die Deutsche Synchronkartei etwa hat keine sperrende `robots.txt`, verbietet
automatisiertes Auslesen aber ausdrücklich in ihren Bedingungen — und ist deshalb aus.

**Feed- und JSON-Pfade nicht raten (12.10.2026):** Erst die Skriptdatei der Seite lesen (ein `fetch(`/`.json`-Aufruf darin nennt die Datenquelle), dann gezielt abrufen — geratene Pfade wie `/feed/`, `/rss.xml` kosten Abrufe am Limit (snowballearth.net: Liste stand in `/en/news/newslist.json`, ein Abruf über dem Limit).

## Prüffrage vor jedem Scraper

**„Woher hat die Seite selbst diese Angabe?"**

Wer sie nicht beantworten kann, hat den Netzwerkverkehr nicht angesehen — und baut
wahrscheinlich gerade etwas Langsameres und Ungenaueres nach, als schon da ist.

## Ein vorhandener Weg wird genauso geprüft wie ein neuer

Diese Regel greift beim **Neubauen** — und genau deshalb hat sie beim
**Weiterbauen** nicht getragen.

Daniel am 25.08.2026, nachdem er die JSON-Antwort selbst im Netzwerk-Tab
gefunden hatte: „warum hast du nicht selbst sowas vorgeschlagen direkt am
anfang, das hätte uns viel arbeit erspart."

Der Ablauf davor: Eine Chrome-Erweiterung las Prime-Video-Seiten über Muster
auf 2,2 Millionen Zeichen Quelltext. Zwei Tage lang wurden daran Fehler
behoben — Abstände zwischen Feldern, Kennungslängen, veraltete Quelltexte,
Wettläufe zwischen Antworten. **Jeder einzelne dieser Fehler existierte nur,
weil überhaupt geparst wurde.** Die Seite selbst holt dieselben Daten als
gültiges JSON, mit allem, was gebraucht wurde: Tonspuren je Folge,
Folgennummer, Zugang, Kennung, Laufzeit, Beschreibung, Altersfreigabe.

**Der Grund, warum die Regel nicht griff, ist banal:** Der Parser war schon da.
Es stand keine Entscheidung „wie holen wir die Daten" an, sondern „warum stimmt
diese Zahl nicht". Und eine Frage nach dem Fehler stellt die Frage nach dem Weg
nicht mehr.

**Die Prüffrage gehört deshalb an den Fehler, nicht an den Anfang:**

> Beim **zweiten** Fehler in derselben Auswertung: *Woher hat die Seite selbst
> diese Angabe — und warum lese ich sie nicht von dort?*

Zwei Fehler in derselben Auswertung sind das Signal. Der erste ist ein Fehler,
der zweite ist ein Hinweis auf den Weg.

Dazu ein Handgriff, der drei Minuten kostet: **die Bitte an den Menschen, den
Netzwerk-Tab zu öffnen und zu sagen, welche Abrufe beim Seitenaufruf laufen.**
Wo eine Messung nur in einer angemeldeten Sitzung möglich ist, wird sie erbeten,
nicht ersetzt — das steht in `pruefen-und-belegen` und gilt hier genauso.
