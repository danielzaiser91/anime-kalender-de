# Synchro melden — Browser-Erweiterung

Blendet beim Abspielen einen Knopf ein, der die vorhandenen Tonspuren an den Anime-Kalender
meldet. Gedacht für die Prüfliste `data/dub-pruefliste.md`: Zeile anklicken, Folge öffnen,
Knopf drücken, weiter zur nächsten.

## Warum es das braucht

Netflix untersagt in seiner `robots.txt` jeden automatisierten Abruf, und 532 Verweise standen
deshalb dauerhaft auf „🇩🇪 ?". Von Hand nachzusehen dauert je Zeile eine halbe Minute: Folge
öffnen, Sprachmenü aufklappen, Liste lesen, Ergebnis notieren.

Diese Erweiterung ist **kein Scraper**. Sie ruft nichts ab — die Seite öffnet Daniel selbst,
und sie liest nur, was der Player ohnehin geladen hat. `robots.txt` richtet sich an
automatische Clients; ein Mensch mit einer Erweiterung ist keiner. Ein Programm, das dieselben
Adressen von sich aus abklappert, wäre einer, und genau das bleibt für uns gesperrt.

## Einrichten

1. In Chrome `chrome://extensions` öffnen, **Entwicklermodus** einschalten
2. **Entpackte Erweiterung laden** → diesen Ordner wählen
3. Bei der Erweiterung auf **Details → Erweiterungsoptionen**, dort das Token eintragen
   (dasselbe wie das Repo-Secret `LAUF_TOKEN`, steht in `my_secrets.md`)

## Benutzen

Folge starten. Unten rechts erscheint der Knopf und sagt schon vor dem Klick, was er melden
würde:

| Farbe | Bedeutung |
|---|---|
| grün | Deutsche Tonspur gefunden |
| gelb | Keine deutsche Tonspur |
| grau | Noch keine Spuren gelesen — läuft eine Folge? |

Ein Klick schickt Anbieter, Adresse, die gelesenen Sprachen und den Befund an den Worker. Von
dort holt ein Pipeline-Schritt die Einträge und trägt sie in `data/dub-confirmed.yaml` ein.

## Was sie aussortiert

**Audiodeskription ist keine Synchronfassung.** Netflix führt sie in derselben Liste
(„Japanisch – Audiodeskription"); das ist eine gesprochene Bildbeschreibung für Blinde, keine
Übersetzung. Sie wird herausgefiltert und nur in der Notiz mitgezählt.

## Stand

- **Netflix** — liest über die Player-Schnittstelle (`getAudioTrackList`), ohne dass das
  Sprachmenü aufgeklappt werden muss. Auf der Titelseite stehen die Sprachen nicht; sie
  erscheinen erst, wenn eine Folge läuft (geprüft am 21.08.2026).
- **Crunchyroll, Prime Video** — der Rahmen steht, die Leseroutine fehlt. Crunchyroll braucht
  sie ohnehin nicht: Dort liefert die eigene Content-API die Auskunft je Folge.
