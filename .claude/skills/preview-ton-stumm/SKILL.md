---
name: preview-ton-stumm
description: "Wenn der Agent im Browser-Pane oder Preview Audio/Video ansteuert oder Klang prüft: stumm, kein Autoplay, Messung ohne hörbaren Ton."
---

# Kein Ton aus dem Claude-Preview

## Die Regel

Wenn der Agent selbst im **Browser-Pane / Preview-Server des Claude-Windows-Clients**
(`preview_*`-Werkzeuge, `mcp__Claude_Browser__*`) etwas ansteuert, darf dabei nichts aus
Daniels Lautsprechern kommen:

- jedes `<video>`/`<audio>`-Element — erst recht mit `autoplay` — bekommt `muted`
- kein `loop` mit Ton
- keine selbsttätige `Audio()`- oder `AudioContext`-Wiedergabe

Entstummen bleibt ausschließlich eine bewusste Aktion von Daniel.

## Geltungsbereich — bewusst eng (Klarstellung 31.07.2026)

**Gilt:** ausschließlich der intern im Claude-Windows-Client laufende Preview-Server bzw. das
Browser-Pane. Grund: dessen Lautstärke lässt sich nicht direkt regeln, und der
Windows-Sound-Mixer ist dafür unzuverlässig — ein dort gesetzter Mute ist beim nächsten
Claude-Start wieder weg. Daniel kann sich also nicht selbst schützen.

**Gilt NICHT:** lokal gehostete Server, die Daniel selbst im eigenen Browser öffnet; fertige
Programme, Spiele und Webseiten, die gebaut werden; Build-Artefakte, Deployments, ausgelieferte
Produkte. Dort ist Ton normal und darf standardmäßig an sein — die Autoplay-Richtlinien des
Browsers und guter Ton-Geschmack sind die einzigen Grenzen.

Diese Regel ist **kein** Design-Argument für „stumm by default" in einem Produkt.

**Faustregel:** Die Regel schützt Daniel vor **dem Agenten**, nicht den Spieler vor **dem
Spiel**.

## Klang trotzdem verifizieren

Klarstellung 27.07.2026: „nur preview sounds/musik nach außen müssen aus sein, du selbst darfst
sie hören". Ton wird also **gemessen statt übersprungen**:

- Audio in einen `OfflineAudioContext` rendern und den Puffer auswerten (Peak, RMS, Notenraster,
  Dauer) — das geht nie an ein Ausgabegerät.
- Oder die Ausgabe hart auf null legen, **bevor** etwas startet: `AudioNode.prototype.connect`
  so umbiegen, dass jede Verbindung zur `AudioDestinationNode` über eine Verstärkung mit
  `gain = 0` läuft.

„Nicht geprüft, weil Ton verboten sei" ist damit keine gültige Begründung.

## Anlass

Daniel wurde durch eine unerwartet abgespielte Tonspur im Preview erschreckt. Die Regel hat
einen konkreten Ursprung und keinen theoretischen — deshalb ist sie in
`~/.claude/rules/30-system-und-sicherheit.md` mit einem Auslöser verankert und nicht nur hier.
