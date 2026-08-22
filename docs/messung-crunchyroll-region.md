# Crunchyrolls Content-API aus deutscher Sicht — gemessen, nicht vermutet

**Frage:** Lässt sich Crunchyrolls Content-API **ohne Anmeldung** dazu bringen, den deutschen
Katalog statt des US-Katalogs zu liefern?

**Antwort in einem Satz: Nein.** Die Region hängt an der IP des Abrufs, und sie steckt danach in
zwei signierten Gebilden — im Zugangstoken und in der CloudFront-Signatur des CMS-Buckets —, die
sich von außen weder setzen noch fälschen lassen.

Gemessen am 22.08.2026 (Ortszeit Europe/Berlin) von einem GitHub-Runner in den USA aus, mit
`tools/messung-crunchyroll-region.mjs`. 34 API-Abrufe, 4 Aufwärm-Seitenaufrufe, ein Abruf der
`robots.txt` — zusammen 39 HTTP-Anfragen, 500 Millisekunden Pause dazwischen. Kein Konto, keine
Anmeldedaten.

## Der Prüfstein

„Fairy Tail" (Serie `G6DQDD3WR`). In Deutschland tragen die Folgen 1 bis 277 eine deutsche
Tonspur (Daniel, 22.08.2026); in der US-Antwort steht bei allen drei Blöcken nur `ja-JP, en-US`.
Ein Versuch hat die deutsche Sicht erreicht, wenn in `versions` der ersten beiden Blöcke ein
`de-DE` auftaucht. Alles andere ist weiterhin US.

Der Prüfstein entscheidet, **nicht der HTTP-Status**: Einen Parameter, den sie nicht kennt,
ignoriert die Schnittstelle stillschweigend und antwortet trotzdem mit 200.

Ausgangsstand aus dem Archiv (`data/crunchyroll-raw/G6DQDD3WR.json.gz`, geholt 21.08.2026):
329 Folgen, davon 0 mit `de-DE`, `eligible_region` durchgehend `US`. Der Abruf vom 22.08. hat das
an Block 1 (`GYQ4KKN16`) live bestätigt: 175 Folgen, `eligible_region: US`, 0 mit `de-DE`.

## Die Tabelle

| # | Versuch | Adresse / Parameter / Header | HTTP | Prüfstein |
|---|---|---|---|---|
| 1 | Kontrolle | `/content/v2/cms/series/G6DQDD3WR/seasons?locale=de-DE` | 200 | **nicht gefunden** — `ja-JP,en-US \| ja-JP,en-US \| ja-JP,en-US` |
| 2 | `preferred_audio_language` | `…&preferred_audio_language=de-DE` | 200 | nicht gefunden |
| 3 | `force_locale` | `…&force_locale=true` | 200 | nicht gefunden |
| 4 | `country` | `…&country=DE` | 200 | nicht gefunden |
| 5 | `region` | `…&region=DE` | 200 | nicht gefunden |
| 6 | `geo` | `…&geo=DE` | 200 | nicht gefunden |
| 7 | `eligible_region` | `…&eligible_region=DE` | 200 | nicht gefunden |
| 8 | `audio_locale` | `…&audio_locale=de-DE` | 200 | nicht gefunden |
| 9 | alle Parameter zusammen | `…&preferred_audio_language=de-DE&force_locale=true&country=DE&region=DE&geo=DE` | 200 | nicht gefunden |
| 10 | Header `Accept-Language` | `de-DE,de;q=0.9` | 200 | nicht gefunden |
| 11 | Header `CR-Locale` | `de-DE` | 200 | nicht gefunden |
| 12 | Header `X-Forwarded-For` | `85.214.132.117` (deutsche IP) | 200 | nicht gefunden |
| 13 | Header `CF-IPCountry` | `DE` | 200 | nicht gefunden |
| 14 | Header `X-Cr-Country` | `DE` | 200 | nicht gefunden |
| 15 | CMS v2, eigener Bucket | `/cms/v2/US/M2/-/seasons?series_id=G6DQDD3WR&locale=de-DE&Policy=…&Signature=…&Key-Pair-Id=…` | 200 | nicht gefunden — 6 Staffeln, alle `ja-JP,en-US` |
| 16 | CMS v2, Bucket auf DE gebogen | `/cms/v2/**DE**/M2/-/seasons?…` (Signatur aus 15) | **403** | nicht gefunden |
| 17 | Serienebene | `/content/v2/cms/series/G6DQDD3WR?locale=de-DE` | 200 | `audio_locales: ["ja-JP","en-US"]` |
| 18 | Folgenebene | `/content/v2/cms/seasons/GYQ4KKN16/episodes?locale=de-DE` | 200 | 175 Folgen, `eligible_region: US`, 0 × `de-DE` |
| 19 | Token, nackt | `POST /auth/v1/token`, `grant_type=client_id` | 200 | `"country":"US"` |
| 20 | Token mit deutschen Kopfzeilen | dito + `Accept-Language: de-DE`, `X-Forwarded-For`, `CF-IPCountry: DE` | 200 | `"country":"US"` — unverändert |

**Vierzehn Parameter- und Header-Varianten, kein einziger Treffer.** Die zwölf mit HTTP 200 und
unveränderter Antwort sind der Regelfall aus dem Auftrag: Was die Schnittstelle nicht kennt, wirft
sie weg, ohne sich zu beschweren.

## Die wörtliche Token-Antwort

```
POST https://www.crunchyroll.com/auth/v1/token
authorization: Basic Y3Jfd2ViOg==
content-type: application/x-www-form-urlencoded
grant_type=client_id
```

HTTP 200:

```json
{"access_token":"eyJhbGciOiJSUzI1NiIsImtpZCI6InZ6YlpmV0tUeHp4emJtTDQ1LXJmSEEiLCJ0eXAiOiJKV1QifQ.…","expires_in":3600,"token_type":"Bearer","scope":"account content mp offline_access","country":"US"}
```

Das Feld heißt `country` und steht auf `US`. Es steht nicht nur außen dran: Der Nutzteil des JWT
enthält dasselbe noch einmal, und zwar **innerhalb der Signatur**.

```json
{"anonymous_id":"","client_id":"cr_web","client_tag":"*","country":"US","exp":1787355693,
 "extended_maturity":{"AU":"MA 15+","BR":"16","IN":"U/A 16+","UN":"16"},
 "jti":"750abf7b-5bcd-4c06-a8dd-a660310deb0c","maturity":"M2",
 "oauth_scopes":"account content mp offline_access","profile_type":"aggretsuko",
 "status":"ANONYMOUS","tnt":"cr"}
```

Damit ist die Region kein Wunsch des Aufrufers, sondern eine **Aussage des Servers über den
Aufrufer**. Ein selbst gesetztes `country=DE` müsste diese Signatur brechen.

Dieselbe Anfrage mit `Accept-Language: de-DE`, `X-Forwarded-For: 85.214.132.117` und
`CF-IPCountry: DE` liefert wieder `"country":"US"`. Das ist zu erwarten und wird hier nur
festgehalten, damit es nicht jemand erneut versucht: Cloudflare setzt `CF-IPCountry` selbst und
überschreibt eine mitgeschickte Zeile; `X-Forwarded-For` aus dem Netz wird an der Kante verworfen.

## Der Bucket aus `/index/v2`

```
GET https://www.crunchyroll.com/index/v2
authorization: Bearer <token>
```

HTTP 200. Wörtlich, gekürzt um die Signaturen:

```json
{"cms":     {"bucket":"/US/M2/-","policy":"…","signature":"…","key_pair_id":"APKAJMWSQ5S7ZB3MF5VA","expires":"2026-08-22T22:41:34Z"},
 "cms_beta":{"bucket":"/US/M2/-","policy":"…","signature":"…","key_pair_id":"APKAJMWSQ5S7ZB3MF5VA","expires":"2026-08-22T22:41:34Z"},
 "cms_web": {"bucket":"/US/M2/-","policy":"…","signature":"…","key_pair_id":"APKAJMWSQ5S7ZB3MF5VA","expires":"2026-08-22T22:41:34Z"},
 "service_available":true,"default_marketing_opt_in":true}
```

**Der Bucket lautet `/US/M2/-`** — Land, Altersfreigabe, Kanal. Und die `policy` ist der Grund,
warum sich das `US` nicht durch ein `DE` ersetzen lässt. Base64-entschlüsselt:

```json
{"Statement":[{"Resource":"https://www.crunchyroll.com/cms/v?/US/M2/-/*",
               "Condition":{"DateLessThan":{"AWS:EpochTime":1787438494}}}]}
```

Das ist eine CloudFront-Signatur, und sie gilt **wörtlich für den Pfad mit `US` darin**. Versuch 16
belegt es: derselbe Aufruf mit `/DE/M2/-` und derselben Signatur antwortet mit **403**. Eine
Signatur für `/DE/…` gibt es nur von Crunchyrolls Schlüssel, und den hat Crunchyroll.

## Was der ältere CMS-Pfad zeigt

Versuch 15 ist der interessanteste Fehlschlag. Der ältere Pfad führt **je Tonspur eine eigene
Staffel** — für „Fairy Tail" sechs statt der drei aus `/content/v2`:

| Kennung | `slug_title` | `audio_locale` |
|---|---|---|
| `GR75CDWD8` | fairy-tail-english-dub | en-US |
| `GYQ4KKN16` | fairy-tail | ja-JP |
| `GR9PC2D2V` | fairy-tail-series-2-english-dub | en-US |
| `GR5VKXN8R` | fairy-tail-series-2 | ja-JP |
| `G6X0C4K4V` | fairy-tail-final-season-english-dub | en-US |
| `GY5PJVE7Y` | fairy-tail-final-season | ja-JP |

Gäbe es aus dieser Sicht eine deutsche Fassung, stünde hier ein `fairy-tail-german-dub`. Es steht
keins da — auf beiden Wegen, alt wie neu, ist der Katalog derselbe. Der Unterschied liegt nicht am
Aufruf, sondern an der Region.

## Eine Beobachtung, die kein Beleg ist

Die Serienantwort (Versuch 17) ist auf Deutsch: Beschreibung, Inhaltshinweise („Gewalt", „vulgäre
Sprache"), Staffel-Schlagwörter („Frühling-2014"). Unter `keywords` steht sogar wörtlich
**`"deutsche synchro"`**. Gleichzeitig steht dort `audio_locales: ["ja-JP","en-US"]` und in
`subtitle_locales` sieben Sprachen ohne Deutsch.

`locale=de-DE` regelt also die **Sprache der Texte**, nicht den Katalog — genau wie im Befund vom
21.08.2026 angenommen. Das Schlagwort „deutsche synchro" ist ein Indiz dafür, dass es die deutsche
Fassung gibt, und **kein Beleg dafür, wo sie läuft**: Schlagwörter sind Suchmaschinenfutter, sie
sagen nichts über Verfügbarkeit und nichts über einzelne Folgen. Als `dub: true` taugt das nicht.

## Was andere gefunden haben

- **`crunchy-labs/crunchyroll-rs`** (letzter Stand 15.08.2026) ist die gepflegteste offene
  Nachbildung dieser Schnittstelle. Ihr Baukasten kennt `locale`, `preferred_audio_locale`,
  `platform` und zwei Stabilisierungsschalter — **keinen Länder- oder Regionsparameter**. Zu
  `preferred_audio_locale` steht dort ausdrücklich, es setze die Tonspur der zurückgegebenen
  Staffeln, „this might not always work on all endpoints as Crunchyroll does Crunchyroll things".
  Das `country` aus der Token-Antwort wird gelesen, aber nirgends gesetzt; `eligible_region` ist
  ein reines Lesefeld an der Folge.
- **`crunchy-labs/crunchy-cli`**, dieselbe Werkstatt, nennt in seiner README als einzigen Weg um
  die Sperre herum einen **Proxy**: „The `--proxy` flag … This may be helpful to bypass the
  geo-restrictions Crunchyroll has on certain series." Mit dem Zusatz, dass der Proxy TLS
  weiterreichen können muss, um Cloudflares Bot-Sperre zu überstehen.
- Der Betreuer (bytedream) in
  [crunchy-cli#142](https://github.com/crunchy-labs/crunchy-cli/issues/142), 11.04.2023: Proxys
  funktionierten „in theory", Cloudflare blocke aber alles, dessen TLS-Konfiguration nicht eigens
  darauf eingerichtet sei; einzelne Anbieter gingen. Die Meldung ist drei Jahre alt — als Beleg
  dafür, dass es einen Parameterweg gäbe, taugt sie nicht, und sie behauptet das auch nicht.

Ungeprüft bleibt, ob es irgendwo einen undokumentierten Parameter gibt, den weder diese Messung
noch die genannten Projekte kennen. Nachweisen lässt sich so etwas nicht — widerlegt ist nur, was
geprüft wurde, und das steht in der Tabelle.

## Fazit

**Ohne Konto geht es nicht — aber ein Konto allein reicht vermutlich auch nicht.** Was fehlt, ist
kein Parameter, sondern eine **deutsche IP-Adresse**: Aus ihr leitet Crunchyroll das `country` im
signierten Token und das Land im signierten CMS-Bucket ab, und beides ist danach nicht mehr
verhandelbar.

Was ein angemeldeter Zugang anders machen würde, ist **hier nicht gemessen** — dafür bräuchte es
Daniels Anmeldedaten, und die waren ausdrücklich nicht Teil des Auftrags. Bekannt ist nur die
Form: Dieselbe Token-Antwort trägt bei einer Anmeldung mit Konto zusätzlich `account_id`,
`profile_id` und ein `refresh_token` — und wieder ein `country`. (So steht es in der
`AuthResponse` von `crunchyroll-rs`, jedes dieser drei Felder eigens als „`None`, wenn anonym
erzeugt" vermerkt; das `country` trägt diesen Vermerk **nicht**, es kommt in beiden Fällen.) Ob
dieses `country` dann aus dem
**Konto** (Daniel hat ein deutsches) oder weiterhin aus der **IP** stammt, entscheidet die ganze
Frage, und es ist mit einem einzigen Abruf zu klären:

> Ein `POST /auth/v1/token` mit Daniels Zugangsdaten, abgeschickt vom US-Runner. Kommt
> `"country":"DE"` zurück, entscheidet das Konto — dann genügt ein hinterlegtes Anmeldegeheimnis
> in der Action. Kommt `"country":"US"`, entscheidet allein die IP, und dann hilft nur ein
> deutscher Ausgangspunkt.

Bleibt es bei der IP, sind es drei Wege, in dieser Reihenfolge:

1. **Lauf von Daniels Rechner** — ein selbst gehosteter Runner. Kostet nichts, braucht aber einen
   eingeschalteten PC; der Datenbestand hängt dann wieder an seiner Verfügbarkeit, was `CLAUDE.md`
   gerade abgeschafft hat.
2. **Deutscher Proxy für die API-Abrufe.** Technisch der sauberste Weg, aber er muss Cloudflares
   TLS-Prüfung überstehen (siehe oben) — das schließt die meisten billigen HTTP-Proxys aus.
3. **Weiter mit dem US-Katalog leben.** Das ist der heutige Stand, und er ist nicht wertlos: Ein
   `de-DE` in `versions` bleibt ein Beleg (226 Serien, Kontrollgruppe 24 von 24). Nur das Fehlen
   belegt nichts, und deshalb steigt `beurteile()` bei `deutschImAngebot: false` aus.

**An der Pipeline wurde nichts geändert.** Es gibt keinen Weg zu beschreiben, der funktioniert, und
die vorhandene Vorsichtsregel ist genau die richtige: Sie behandelt den US-Katalog schon heute als
das, was er ist — eine Quelle, die belegen kann, was da ist, und nie, was fehlt.

## Nachtrag vom 22.08.2026: Weg 1 in einer Fassung, die ohne Daniels PC auskommt

Der dritte Weg oben („weiter mit dem US-Katalog leben") ist überholt, und zwar durch eine Lücke in
Versuch 16: Die CloudFront-Signatur enthält **nur eine Zeitbedingung, keine IP-Bindung**. Ein Paket,
das an einer deutschen Leitung entsteht, öffnet den deutschen Katalog deshalb auch von einem
Rechner in den USA — es muss nur einmal am Tag von dort geholt werden
(`tools/cr-zugang-holen.mjs`), nicht jeder Abruf.

Was dieses Dokument misst, bleibt richtig: **Kein Parameter und kein Header** bringt einen
US-Abruf in den deutschen Katalog. Der Schlüssel ist die Unterschrift, nicht die Anfrage.

Der Abruf `data:cr-dub` läuft seit dem 22.08.2026 auf diesem Weg; die Auswirkung steht in
[messung-crunchyroll-de-katalog.md](messung-crunchyroll-de-katalog.md).
