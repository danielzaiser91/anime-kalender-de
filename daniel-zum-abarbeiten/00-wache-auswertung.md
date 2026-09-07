# Auswertung der Wache

Die Wache (`daniel-zum-abarbeiten/00-wache.md`) meldet, wenn der Bestand etwas
verliert. Sie kann nicht wissen, **warum** — hier steht es. Neue Auswertungen
kommen oben dazu, ältere bleiben stehen: An der Reihe zeigt sich, ob eine Lücke
wiederkehrt.

---

## 07.09.2026, 15:31 — fünf gemeldete Verluste, alle erklärt

**Was läuft korrekt.** Die Wache hat genau das getan, wofür es sie gibt: Sie hat
jede Verweis-Entfernung des Tages bemerkt und benannt, mit Anbieter und Zahl.
Der Status blieb dabei richtigerweise auf „unauffällig" — die Schwelle für einen
Alarm war keiner der Fälle.

**Woher die Verluste kommen — alle fünf sind gewollt:**

| Wache-Zeile | Ursache |
|---|---|
| netflix: 1 Beleg weniger | „Date a Live" Staffel 1: Der Prime-Weg trug ein `dub: true` aus dem Beleg zu einer **anderen** Ausgabe; der Beleg zur eigenen Adresse sagt „kein Deutsch" |
| crunchyroll: 1 und 6 Belege weniger | dieselbe Umstellung, plus die 16 YouTube-Verweise ohne belegte Synchro (Daniel: „youtube hat nur untertitel, also weg damit") |
| primevideo: 3 und 1 Belege weniger | die FSK-18-Fassung von Date a Live (S2 und S4) und „7th Time Loop" — beide mit belegtem Nein aus zwei unabhängigen Quellen |

**Wo Verbesserungspotenzial liegt.** Die Wache unterscheidet nicht zwischen
einem Verlust durch einen Fehler und einer Entfernung, die ein Handbeleg
ausgelöst hat. Beides sieht für sie gleich aus. Der Unterschied steht in
`data/verweise-entfernt.json` — dort trägt jeder entfernte Verweis seinen Grund
und seit heute auch ein `entferntAm`. Eine künftige Fassung könnte die
Wache-Zeile damit anreichern: „6 Belege weniger, davon 6 mit belegtem Nein"
liest sich anders als dieselbe Zahl ohne Zusatz.

**Wo echte Risiken sind.** Keines aus diesem Lauf. Der eine Punkt, der bleibt:
Die Wache läuft täglich um 09:20, und ein Arbeitstag wie dieser erzeugt bis zum
Abend Dutzende Änderungen. Sie meldet sie erst am nächsten Morgen gesammelt —
wer die Ursache dann noch kennt, hat Glück. Deshalb diese Datei.

**Was komplett falsch läuft.** Nichts in diesem Lauf.
