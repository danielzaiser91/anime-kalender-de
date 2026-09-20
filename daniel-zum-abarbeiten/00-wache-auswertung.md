# Auswertung der Wache

Die Wache (`daniel-zum-abarbeiten/00-wache.md`) meldet, wenn der Bestand etwas
verliert. Sie kann nicht wissen, **warum** — hier steht es. Neue Auswertungen
kommen oben dazu, ältere bleiben stehen: An der Reihe zeigt sich, ob eine Lücke
wiederkehrt.

## 20.09.2026, 21:25 — durchgesehen, nichts offen

**Was läuft korrekt.** Wachlauf vom 20.09.2026, 14:23, „unauffällig": 2.775 Titel, 2.090 Urteile, **4 offen**; über 24 Stunden +3 Titel und +25 Urteile. Briefkasten leer, Statusanzeige ohne roten Lauf, die Liste der ungeklärten Meldungen steht bei zwei Adressen.

**Die vier Auffälligkeiten sind meine eigenen Korrekturen.** Alle vier melden „primevideo: Synchro-Belege weniger" und stammen aus dem Durchgang vom 19./20.09.: zurückgenommene Belege ohne Urteil (JoJo-Sammelseiten, Fushigi Yuugi, Edens Zero Staffel 2) und drei Belege, die das Messskript `prime-geteilte-adressen.mjs` als „belegt gar nichts" ausgewiesen hat. Kein Verlust, sondern gelöschte Behauptungen.

**Wo echte Risiken waren.** Einer, und die Wache konnte ihn nicht sehen, weil nichts verloren ging: Rund 300 von 643 Prime-Verweisen standen unter `amazon.de/dp/<ASIN>` und antworteten dort mit 404, während unser Linkbefund „lebt" lautete — die Prüfung weicht bei einem 404 still auf die Video-Adresse aus und bucht den Erfolg unter der alten Adresse. Gemessen an fünfzehn Verweisen: sieben tot unter `/dp/`, fünfzehn von fünfzehn lebendig unter `/gp/video/detail/`. Behoben, der Bau richtet die Adressen jetzt zum Schluss.

**Wo Verbesserungspotenzial ist.** Die Zeile „Von den Ableitungen verworfen" steht seit ihrer Einführung unverändert bei 210 und 54 — sie meldet also zuverlässig, sagt aber noch nichts darüber, ob die 264 Serien zu Recht durchfallen. Eine Stichprobe darüber steht aus.

---

## 19.09.2026, 23:55 — durchgesehen, nichts offen

**Was läuft korrekt.** Letzter Wachlauf 19.09.2026, 13:55, „unauffällig": 2.772 Titel, 2.065 Urteile, 4 offen; über 24 Stunden +1 Urteil, −38 offen. Am Abend kamen im Durchgang rund 40 Belege dazu (JustWatch-Kandidaten, JoJo, Grisaia); die nächste Wache zeigt sie.

**Die Verlustzeile ist gewollt.** „19.09., 01:20 verweise −37, ohneUrteil −37": die 37 toten aniSearch-Adressen der Prime-Prüfliste, im nächtlichen Durchgang als „weg“ gemeldet; für 14 davon kamen JustWatch-Kandidaten, die heute Abend gemeldet und gebucht wurden (`docs/prime-kandidaten-justwatch.md`).

**Wo es heute hakte.** Drei Bauläufe wurden rot, alle an `check:handbelege`, alle aus demselben Grund: Die Prüfung verglich bei mehreren Belegen je Titel und Anbieter den falschen Weg. Behoben (137b10e4, 8c657081), Statusanzeige geräumt.

---

## 17.09.2026, 13:50 — durchgesehen, zwei Fehler behoben

**Was läuft korrekt.** Letzter Wachlauf 16.09.2026, 14:36, „unauffällig": 2.771 Titel, 2.011 Urteile, 15 offen. Der heutige Lauf fehlt nicht, er kommt nur spät: GitHub startet den 07:20-UTC-Termin seit Tagen gegen 12:40 UTC. Statusanzeige ohne rote Läufe.

**Was komplett falsch lief.** Die Deltazeilen vom 16.09. wechselten im Minutentakt zwischen „verweise −2" und „+2". In `data/bestand-historie.jsonl` sprang `entferntProtokolliert` bei jedem Bau zwischen 836 und 769: 78 Crunchyroll-Adressen wurden aus aniSearch ergänzt, als belegtes Nein entfernt, im nächsten Lauf vom Gedächtnis gesperrt und deshalb nicht mehr notiert, im übernächsten wieder ergänzt. Behoben in `build.ts` (das Gedächtnis übernimmt gesperrte Einträge); zwei Bauläufe danach stehen beide auf 847.

**Wo echte Lücken waren.** Sechs Joyn-Adressen führte `data/link-check.json` seit dem 20.08. als 404, im Datensatz standen sie trotzdem, ohne Sprachurteil (9 der 13 offenen Verweise). Die späten Ergänzungsrunden legen solche Adressen jetzt nicht mehr an. Übrig bleiben vier Prime-Verweise, die nur über die Erweiterung zu klären sind.

**Wo Verbesserungspotenzial ist.** Die Amazon-Linkprüfung liefert aus der Cloud kaum Befunde (Recherche 17.09. in `status.md`); ihr Abbruch hielt bis heute auch die übrigen Anbieter auf.

---

## 15.09.2026, 08:35 — durchgesehen, nichts offen

**Was läuft korrekt.** Letzter Lauf 14.09.2026, 16:04, „unauffällig": 2.771 Titel, 1.980 Urteile, 7 offen; über 24 Stunden +8 Urteile, −12 offen. Alle Läufe der Nacht grün, Statusanzeige ohne roten Lauf, Briefkasten leer.

**Die eine Verlustzeile ist gewollt.** „14.09., 12:01 verweise −5, mitUrteil −2" kommt aus der Ausgaben-Umstellung: belegte Neins für die Crunchyroll-Kanal-Ausgaben von Digimon und Bungo Stray Dogs sowie für Trinity Seven auf Prime, dazu doppelte `/dp/`- und `/gp/video/detail/`-Verweise (Date a Live V), die zusammengelegt wurden. Digimon hat dafür einen Verweis mit Deutsch gewonnen.

**Wo Verbesserungspotenzial ist.** Die Kanal-Gegenprobe läuft nur montags im Tiefendurchlauf. Eine neue Kanal-Meldung wartet damit bis zu einer Woche auf ihre zweite Quelle. Das bleibt so, solange nicht mehrere Meldungen pro Woche anfallen.

---

## 13.09.2026, 20:47 — durchgesehen, nichts offen

**Was läuft korrekt.** Letzter Lauf 13.09.2026, 14:43, „unauffällig“: 2.771 Titel, 1.972 Urteile, 19 offen; über 24 Stunden +3 Urteile, −1 offen. Keine Verluste.

**Briefkasten.** 32 Meldungen (Prime 26, Netflix 6), alle in 11-meldungen-ohne-zuordnung.md gelistet. Die 6 Netflix-Meldungen (Haikyu) sind am Abend von Hand verbucht und abgehakt; die 26 Prime-Meldungen gehören zu einem Kanal-Titel (Haikyuu!!, ADN-Kanal) und tragen kein Urteil.

**Wo echte Risiken sind.** Keines im Bestand. Der Durchgang am Abend hat Zuordnungsfehler gezeigt, die für die Wache unsichtbar sind, weil sie nie als Verlust auftreten: ein Prime-Beleg am falschen Titel (Plus-Sized Elf unter Trinity Seven), ein falsches Nein des Crunchyroll-Laufs (Chunibyo-OVA). Beide berichtigt, die Ursachen stehen als Aufgaben in status.md.

---

## 09.09.2026, 19:10 — durchgesehen, nichts offen

**Was läuft korrekt.** Sieben Läufe in 24 Stunden, keiner mit Veränderung, der
Briefkasten leer — der Stand ist seit dem 08.09. unbewegt (2.768 Titel, 1.913
Urteile, 74 offen). Die Zahlen der Wache decken sich mit dem, was am Abend von
Hand gemessen wurde.

**Der Verbesserungsvorschlag vom 07.09. ist erledigt** — und zwar am selben Tag:
`bestand-historie.ts` rechnet je Anbieter die **begründeten** Entfernungen aus
`data/verweise-entfernt.json` gegen den Verlust und meldet nur den Rest
(„… Synchro-Belege weniger (N weitere sind begründet entfernt)"). Der Vorschlag
bleibt hier stehen, damit niemand ihn ein zweites Mal aufschreibt.

**Wo echte Risiken sind.** Keines aus diesen Läufen. Der bekannte Punkt bleibt:
Die Wache läuft um 09:20, ein Arbeitstag erzeugt bis zum Abend Dutzende
Änderungen, und sie meldet sie erst am nächsten Morgen. Genau dafür gibt es
diese Datei.

**Was komplett falsch läuft.** Nichts. Die drei Fehler dieses Abends
(Melde-Kasten, Auftrag über zwei Ausgaben, Staffelwarnung) liegen alle in der
Erweiterung und berühren den Bestand nicht — der eine, der ihn berührte (ein
verlorener Beleg zu „Death Note: Relight"), war für die Wache unsichtbar: Er
entstand aus zwei Meldungen, die zu **einem** Beleg wurden. Ein Verlust, den es
nie in den Bestand geschafft hat, taucht in keiner Delta-Zeile auf.

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
