# Anbieterketten: crunchyroll.com, Prime-Video-Kanal, Apple TV

Stand: 13.09.2026. Anlass: „Okko und ihre Geisterfreunde – Der Film" steht auf crunchyroll.com (DE)
als „Leider sind die Videos dieser Serie nicht mehr verfügbar", läuft laut Daniel aber im
Prime-Video-Kanal „Crunchyroll" (Kanal-Abo `crunchyrollde`, Prime-Seite
`amzn1.dv.gti.3cb88c42-8aba-78c5-3026-ee065e93e11e`). Apple TV zeigt dafür ein Prime-Video-Symbol,
maxdome bietet Kauf und Leihe.

Grenzen dieser Recherche: Reddit ist für das Recherche-Werkzeug gesperrt (Fehlermeldung beim
Suchen). Nicht lesbar waren außerdem die Crunchyroll-Seite des Films (HTTP 403), der
Crunchyroll-Hilfeartikel zum Amazon-Kanal (nur Seitengerüst, Inhalt wird per JavaScript geladen),
ein Thread im deutschen Amazon-Forum (Seite lädt nicht) und eine gutefrage.net-Frage (HTTP 403).
Die Anbieterangaben auf der Apple-TV-Seite des Films stehen nicht im ausgelieferten HTML; das
Prime-Symbol ist also Daniels Beobachtung, hier nicht nachgeprüft.

---

## 1. Hat der Prime-Kanal einen eigenen Katalog?

**Kurz:** Ja. Welche Titel im Kanal laufen, legt der Kanalbetreiber fest, und die Rechte dafür
werden bei Amazon getrennt vom Prime-Inklusivangebot und mit eigenen Lizenzfenstern eingeliefert.
Dass der Kanal weniger enthält als der eigene Dienst, ist für Crunchyroll und ADN mehrfach
beschrieben. Den umgekehrten Fall (im Kanal noch da, auf crunchyroll.com schon weg) belegt keine
gefundene Quelle – außer Okko selbst und einem kurzen zeitlichen Nachlauf bei *86*.

Belege:

- Amazons Hilfe zu den Zusatzkanälen: Der jeweilige Buchungsanbieter bestimmt, welche Titel in
  seinem Kanal zu sehen sind.
  https://www.primevideo.com/-/de/help/ref=atv_hp_nd_nav?nodeId=GGQ38JL9EK3QN6KN
- Amazon Video Central (Doku für Content-Partner), Seite „Content rights": Rechte werden als
  EMA-Avails geliefert; das Feld `GroupIdentity` unterscheidet Prime Video selbst (first-party
  SVOD) von Prime Video Channels (third-party SVOD). Jede Lizenz hat Start, Ende und Territorium.
  Beendet wird eine Lizenz über einen „Full Extract" mit Enddatum; ein „Full Delete" nimmt bereits
  veröffentlichte Angebote **nicht** automatisch vom Markt.
  https://videocentral.amazon.com/support/delivery-experience/licensing-rights-and-avails/content-rights
- Anime2You zum Start des Crunchyroll-Kanals in Deutschland (04.04.2024): Der Kanal bietet eine
  große Auswahl aus dem Crunchyroll-Katalog plus Simulcasts, nicht den ganzen Katalog. In den
  Kommentaren meldet ein Leser, dass *Tensura* nicht vollständig vorhanden sei.
  https://www.anime2you.de/news/781358/crunchyroll-prime-video-channel/
- GIGA (24.07.2024): Einzelne Serien, Folgen oder **Tonspuren** können bei Crunchyroll selbst
  verfügbar sein, im Amazon-Kanal aber (noch) nicht.
  https://www.giga.de/tipp/crunchyroll-mit-amazon-prime-nutzen-accounts-fuer-alle-vorteile-verknuepfen/
- Anime2You zum ADN-Kanal (21.06.2024): „ein Großteil" des ADN-Katalogs sei im Kanal. Leser
  nennen in den Kommentaren fehlende Titel, u. a. *Dark Gathering*, *I Parry Everything*,
  *Love Flops*, *Too Cute Crisis*, *Beck*.
  https://www.anime2you.de/news/802168/adn-prime-video-channel/
- Amazons Pressetext zum US-Start (2023) spricht dagegen von 24.000 Stunden Crunchyroll „direkt
  auf Prime Video" – Werbeaussage für die USA, kein Katalogvergleich für Deutschland.
  https://www.aboutamazon.com/news/entertainment/crunchyroll-anime-subscription-amazon-prime-video
- TECHBOOK (03.04.2026) zu Zusatzkanälen allgemein: Einige Dienste haben direkt günstigere Tarife
  bzw. vollständigere Angebote als über Amazon (genannt: HBO Max, RTL+, DAZN, Wow). Keine
  Anime-Beispiele.
  https://www.techbook.de/streaming/anbieter/zusatzkanaele-amazon-prime-check

## 2. Was bedeutet das Prime-Video-Symbol bei Apple TV?

**Kurz:** Apple ist dort nur Verweis, nicht Anbieter. Die Apple-TV-App kennt zwei Arten: eigene
„Apple TV Channels", die in der App selbst abspielen, und angebundene Fremd-Apps, bei denen Apple
per Deep Link in die App des Anbieters springt. Ein Prime-Video-Symbol gehört zur zweiten Art. Was
dort als verfügbar erscheint, stammt aus dem Verfügbarkeits-Feed, den der Partner (hier Amazon) an
Apple liefert.

Belege:

- Apple TV for Partners, „Catalog and availability feeds overview": Der Availability-Feed enthält
  Angebote (Offers) mit Zeitfenstern und „Locators", also Links zum Öffnen und Abspielen in der App
  des Partners. Nur bei Apples eigenem Abo-Video läuft die Wiedergabe in der Apple-TV-App.
  https://tvpartners.apple.com/support/3678-catalog-and-availability-feeds-overview
- Apple-Styleguide zur Integration: Die App hostet Fremdinhalte nicht, sondern führt über Universal
  Links bzw. Deep Links in die App des Anbieters.
  https://help.apple.com/itc/tvpumcstyleguide/en.lproj/static.html
- Apple-Support: Abos von Drittanbietern gehören nicht zum Apple-TV-Abo; bei Problemen mit anderen
  Apps verweist Apple an deren Entwickler.
  https://support.apple.com/en-us/118405
- Apple Community (09.06.2022, Neuseeland): Prime Video lässt sich laut Antwort für Amazon Originals
  und Prime-inklusive Titel anbinden, nicht für Kauf- und Leihtitel. Ob Kanal-Titel übergeben
  werden, sagt der Thread nicht ausdrücklich.
  https://discussions.apple.com/thread/253959833

## 3. Was passiert vorne in der Kette, wenn hinten ein Titel wegfällt?

**Kurz:** Jedes Glied hat seinen eigenen Rechte- bzw. Feed-Eintrag, und keins wird automatisch vom
anderen abgeräumt. Crunchyroll muss Amazon ein Enddatum für den Kanal liefern, Amazon muss es an
Apple weitergeben. Der einzige gefundene Einzelfall (*86*) zeigt einen Nachlauf von unter einer
Stunde. Nutzerberichte „wird angezeigt, spielt aber nicht" für Crunchyroll-Kanal oder Apple TV
fanden sich nicht in lesbarer Form (Reddit und das Amazon-Forum waren nicht erreichbar).

Belege:

- *86 EIGHTY-SIX*, Anime2You (11.05.2026): Crunchyroll nahm die Serie heraus; Nachtrag um 19:25 Uhr
  desselben Tages: inzwischen auch bei Prime Video alle Folgen entfernt. Der Kanal lief also kurz
  nach, folgte aber am selben Abend.
  https://www.anime2you.de/news/1009335/86-eighty-six-nicht-mehr-auf-crunchyroll/
- GamePro zum selben Fall: Laut Nachtrag vom 15.08.2026 ist *86* wieder bei Crunchyroll. Ob auch
  wieder im Prime-Kanal, steht dort nicht.
  https://www.gamepro.de/artikel/crunchyroll-entfernt-beliebten-anime,3452985.html
- Apple TV for Partners, „How to remove content": Ablaufen muss ein Titel über ein Enddatum im Feed,
  mindestens 48 Stunden vorher; ihn nur aus dem Feed zu streichen, beendet das Angebot nicht
  zuverlässig. Ein Verweis bei Apple kann also stehen bleiben, wenn der Partner kein Enddatum
  meldet.
  https://tvpartners.apple.com/support/3680-remove-content-from-apple-tv-app
- Amazon Video Central (siehe Frage 1): Auch bei Amazon räumt das bloße Löschen von Rechtedaten ein
  veröffentlichtes Angebot nicht ab; nötig ist ein Enddatum.
- Aggregatoren hängen ebenfalls nach: JustWatch **Deutschland** listet für Okko am 13.09.2026
  (Angebote zuletzt aktualisiert 08:35 Uhr) sowohl „Crunchyroll" als auch „Crunchyroll Amazon
  Channel" als Flatrate, dazu maxdome und freenet meinVOD zum Leihen, maxdome zum Kaufen – obwohl
  crunchyroll.com den Film laut Daniel nicht mehr abspielt.
  https://www.justwatch.com/de/Film/Okkos-Inn
- JustWatch **Österreich** (Stand 12.09.2026) listet für Okko als Flatrate nur noch den
  „Crunchyroll Amazon Channel", nicht Crunchyroll direkt; dazu maxdome. Anderes Land, aber dasselbe
  Muster wie Daniels Beobachtung.
  https://www.justwatch.com/at/Film/Okko-und-ihre-Geisterfreunde
- Geprüft und nicht passend: Der Apple-Community-Thread „This content is no longer available"
  (2021) betrifft *CODA* auf Apple TV+, also kein Fremdangebot.
  https://discussions.apple.com/thread/253051005

## 4. Weitere Beispiele

**Kurz:** Kein belegtes weiteres Beispiel für „auf crunchyroll.com (DE) weg, im Prime-Kanal noch da".
Belegt ist nur die Gegenrichtung (im Kanal fehlt, was der eigene Dienst hat) und der kurze Nachlauf
bei *86*.

- Richtung „Kanal hat weniger": *Tensura* im Crunchyroll-Kanal (Leserkommentar, 2024, Quelle bei
  Frage 1); allgemein Serien, Folgen und Tonspuren (GIGA, 2024); beim ADN-Kanal *Dark Gathering*,
  *I Parry Everything*, *Love Flops*, *Too Cute Crisis*, *Beck* (Leserkommentare, 2024).
- Richtung „Kanal hat mehr": nur *Okko und ihre Geisterfreunde – Der Film* (Daniel, 13.09.2026;
  gestützt von JustWatch AT, siehe Frage 3) und *86* für knapp eine Stunde am 11.05.2026.
- Nicht verwechseln: Prime Video führt eine Rubrik mit Titeln, die in den nächsten 30 Tagen
  auslaufen (Anime2You, 15.07.2026, u. a. die *Rebuild of Evangelion*-Filme). Aus dem Artikel geht
  nicht hervor, ob das Prime-Inklusivangebot oder ein Kanal betroffen ist.
  https://www.anime2you.de/news/1031817/prime-video-entfernt-evangelion-und-mehr/

---

## Was daraus für den Kalender folgt

1. **Der Prime-Kanal ist ein eigener Bezugsweg**, getrennt von crunchyroll.com (analog ADN-Kanal
   vs. ADN direkt). Rechte, Lizenzfenster und sogar Tonspuren werden getrennt geliefert und können
   abweichen. Ein Titel darf also als „Crunchyroll über Prime Video" geführt werden, auch wenn
   crunchyroll.com ihn nicht mehr hat.
2. **Belegt wird der Kanal am Kanal selbst**, nicht per Ableitung: nicht aus dem
   crunchyroll.com-Katalog, nicht aus Apple TV und nicht aus JustWatch (beide hängen nachweislich
   nach). Auch die deutsche Tonspur wird im Kanal eigens belegt, weil sie dort fehlen kann (GIGA).
3. **Apple TV ist kein Bezugsweg**, nur ein Verweis auf die Prime-App. Taugt höchstens als Hinweis,
   wo nachzusehen ist.
4. **„Nicht mehr verfügbar" auf crunchyroll.com gilt nur für crunchyroll.com.** Es beendet diesen
   einen Bezugsweg, nicht die ganze Kette. Es ist aber ein Warnsignal für den Kanal: Bei *86* folgte
   Prime am selben Abend. Deshalb den Kanal-Eintrag nach so einer Meldung zeitnah neu prüfen und mit
   Prüfdatum anzeigen; bleibt er abspielbar, bleibt er geführt.
5. **maxdome** (Kauf/Leihe) ist wieder ein eigener Bezugsweg mit eigener Bezugsart und hängt nicht
   an Crunchyroll.
