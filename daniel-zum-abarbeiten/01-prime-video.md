# 1 — Prime Video durchgehen

**385 Adressen.** Je Titel etwa 15 Sekunden. Das ist die Aufgabe mit der größten Wirkung, und
sie löst nebenbei eine zweite.

## Was zu tun ist

1. Irgendeine Amazon-Titelseite öffnen, zum Beispiel
   [Digimon Tamers](https://www.amazon.de/dp/B0CQ4VL364)
2. Unten rechts steht **„385 Prime-Titel offen"** → anklicken
3. Aus der Liste einen Titel wählen — die Seite lädt
4. Warten, bis der grüne Knopf eine Zahl zeigt
5. Klicken. Zurück zur Liste, nächster Titel.

**Immer aus der Liste heraus arbeiten**, nicht über Amazons eigene Navigation. Die Liste führt
staffelgenaue Kennungen; Amazons Menüs landen auf Sammelseiten, die sich nicht zuordnen lassen.

## Was der Knopf sagt

| Was dort steht | Was zu tun ist |
|---|---|
| `🇩🇪 Deutsch · 51 Folgen · melden` | klicken — vollständig geprüft |
| `🇩🇪 Deutsch · Film · 💰 Kauf/Leihe · melden` | klicken — ein Film, kostenpflichtig |
| `🇩🇪 Deutsch · 24 von 51 — lädt nach` | kurz warten, die Zahl steigt noch |
| `✕ kein Deutsch · 24 von 51 — Abschnitte selbst öffnen` | **nicht melden** — siehe unten |
| `✓ gemeldet — noch 4 Staffeln` | die nächste Staffel im Auswahlfeld wählen |
| `Tonspuren noch nicht geladen` | Seite neu laden |

**Aus einem Ausschnitt wird nie ein Nein.** „Deutsch gefunden" bleibt wahr, auch wenn erst 24
von 51 Folgen geladen sind — eine deutsche Tonspur ist eine deutsche Tonspur. „Kein Deutsch"
wäre dagegen eine Aussage über die ganze Staffel, gestützt auf die Hälfte. Deshalb sperrt der
Knopf diesen Fall selbst.

## Mehrere Staffeln

Jede Staffel wird **einzeln** gemeldet — sie können verschiedene Tonspuren haben, und bei
Kauftiteln kostet jede einzeln. Der Knopf sagt nach dem Melden, wie viele noch offen sind; in
der Liste steht dann `1/5`. Die Zeile verschwindet erst, wenn alle durch sind.

## Was diese Arbeit nebenbei löst

Der Kalender bezieht Tonspuren auch von der Streaming Availability API. Deren Prime-Daten
liegen ungenutzt im Repo — **123 Serien mit deutscher Tonspur** —, weil niemand geprüft hat, ob
sie stimmen. Prüfen heißt: gegen Angaben halten, die ein Mensch gesehen hat.

Für Netflix gibt es 1.790 solcher Angaben, für Prime Video **dreizehn**. Mit jeder Meldung wächst
die Kontrollgruppe; ab etwa fünfzig lässt sich sagen, ob die Quelle taugt. Dann fallen 123
Serien auf einen Schlag.
