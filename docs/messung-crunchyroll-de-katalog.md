# Der deutsche Katalog gegen den alten Bestand — Stichprobe von 60 Serien

Gemessen am 2026-08-22 mit `npx tsx pipeline/messung-cr-katalog.ts`,
Bucket `/DE/M2/-`, 400 ms Pause zwischen den Abrufen. Der alte Stand stammt aus
`data/crunchyroll-dub.json` (Lauf vom 2026-08-21, US-Katalog).

Die Stichprobe ist **geschichtet und systematisch** gezogen: 693 Serien des Bestands nach
bisherigem Befund gruppiert, je Gruppe anteilig jede k-te Kennung. Keine Zufallszahl, keine
Handauswahl — der Lauf ist wiederholbar, und niemand kann sich die Fälle aussuchen.

## Was sich verschiebt

| bisher \ jetzt | kein Deutsch | Deutsch | nicht verfügbar | nicht im Katalog | keine Auskunft | Summe |
|---|---|---|---|---|---|---|
| **kein Deutsch** | 10 | 3 | 0 | 19 | 0 | 32 |
| **Deutsch** | 0 | 20 | 0 | 0 | 0 | 20 |
| **nicht verfügbar** | 1 | 1 | 0 | 6 | 0 | 8 |

**3 von 32** Serien, die bisher als „kein Deutsch" galten, führen im
deutschen Katalog eine deutsche Fassung — 9 Prozent.

**25 von 60** Serien führt der deutsche Katalog überhaupt nicht (HTTP 200,
`total: 0`), während der US-Katalog volle Folgenlisten liefert. Das ist eine Auskunft und keine
Störung — zu `nichtVerfuegbar` wird daraus trotzdem nichts, weil der zweite Beleg (Crunchyrolls
eigene Fehlerseite) im Cloud-Lauf weiterhin aus US-Sicht gelesen wird.

## Belegte Verweise

| | vorher | nachher |
|---|---|---|
| Verweise mit belegtem Urteil | 20 | 38 |

## Widerspruch zwischen Staffelname und `versions`

Kein Fall in dieser Stichprobe.

## Jede Serie einzeln

| Serie | bisher (US) | jetzt (DE) | deutsche Folgen | belegte Verweise |
|---|---|---|---|---|
| clevatess | Deutsch | Deutsch | 19 → 19 | 2✓/0✕ → 2✓/0✕ |
| gabriel-dropout | Deutsch | Deutsch | 12 → 12 | 1✓/0✕ → 1✓/0✕ |
| gachiakuta | Deutsch | Deutsch | 24 → 24 | 1✓/0✕ → 1✓/0✕ |
| in-the-land-of-leadale | Deutsch | Deutsch | 12 → 12 | 1✓/0✕ → 1✓/0✕ |
| kaguya-sama-love-is-war | Deutsch | Deutsch | 29 → 29 | 0✓/0✕ → 0✓/0✕ |
| keijo | Deutsch | Deutsch | 12 → 12 | 1✓/0✕ → 1✓/0✕ |
| konosuba-gods-blessing-on-this-wonderful-world | Deutsch | Deutsch | 21 → 23 | 0✓/0✕ → 0✓/0✕ |
| mistress-kanan-is-devilishly-easy | Deutsch | Deutsch | 12 → 12 | 1✓/0✕ → 1✓/0✕ |
| mobile-suit-gundam-cucuruz-doans-island | Deutsch | Deutsch | 1 → 1 | 1✓/0✕ → 1✓/0✕ |
| more-than-a-married-couple-but-not-lovers | Deutsch | Deutsch | 12 → 12 | 1✓/0✕ → 1✓/0✕ |
| sentenced-to-be-a-hero | Deutsch | Deutsch | 12 → 12 | 1✓/0✕ → 1✓/0✕ |
| The Maid I Hired Recently Is Mysterious | Deutsch | Deutsch | 11 → 11 | 1✓/0✕ → 1✓/0✕ |
| the-dawn-of-the-witch | Deutsch | Deutsch | 12 → 12 | 1✓/0✕ → 1✓/0✕ |
| the-detective-is-already-dead | Deutsch | Deutsch | 12 → 12 | 1✓/0✕ → 1✓/0✕ |
| the-hidden-dungeon-only-i-can-enter | Deutsch | Deutsch | 12 → 12 | 1✓/0✕ → 1✓/0✕ |
| tower-of-god | Deutsch | Deutsch | 39 → 39 | 2✓/0✕ → 2✓/0✕ |
| trapped-in-a-dating-sim-the-world-of-otome-games-is-tough-for-mobs | Deutsch | Deutsch | 16 → 16 | 0✓/0✕ → 0✓/0✕ |
| uzaki-chan-wants-to-hang-out | Deutsch | Deutsch | 25 → 25 | 2✓/0✕ → 2✓/0✕ |
| wandering-witch-the-journey-of-elaina | Deutsch | Deutsch | 12 → 12 | 1✓/0✕ → 1✓/0✕ |
| why-raeliana-ended-up-at-the-dukes-mansion | Deutsch | Deutsch | 12 → 12 | 1✓/0✕ → 1✓/0✕ |
| a-certain-scientific-railgun | kein Deutsch | kein Deutsch | 0 → 0 | 0✓/0✕ → 0✓/2✕ |
| blackfox | kein Deutsch | Deutsch **↺** | 0 → 1 | 0✓/0✕ → 1✓/0✕ |
| dears | kein Deutsch | kein Deutsch | 0 → 0 | 0✓/0✕ → 0✓/2✕ |
| demon-king-daimao | kein Deutsch | kein Deutsch | 0 → 0 | 0✓/0✕ → 0✓/1✕ |
| dragon-ball-z-super-android-13 | kein Deutsch | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| fantastic-adventures-of-unico | kein Deutsch | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| fatestay-night-heavens-feel | kein Deutsch | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| G4PH0WXD1 | kein Deutsch | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| garo-vanishing-line- | kein Deutsch | kein Deutsch | 0 → 0 | 0✓/0✕ → 0✓/1✕ |
| is-this-a-zombie | kein Deutsch | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| koro-sensei-quest | kein Deutsch | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| kuma-kuma-kuma-bear | kein Deutsch | kein Deutsch | 0 → 0 | 0✓/0✕ → 0✓/1✕ |
| last-exile | kein Deutsch | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| michiko-hatchin | kein Deutsch | Deutsch **↺** | 0 → 22 | 0✓/0✕ → 1✓/0✕ |
| midnight-occult-civil-servants | kein Deutsch | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| my-deer-friend-nokotan | kein Deutsch | kein Deutsch | 0 → 0 | 0✓/0✕ → 0✓/1✕ |
| netsuzou-trap-ntr- | kein Deutsch | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| ninja-scroll-the-series | kein Deutsch | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| otherside-picnic | kein Deutsch | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| puella-magi-madoka-magica | kein Deutsch | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| sing-a-bit-of-harmony | kein Deutsch | Deutsch **↺** | 0 → 2 | 0✓/0✕ → 1✓/0✕ |
| soul-eater | kein Deutsch | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| spice-and-wolf | kein Deutsch | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| sword-of-the-stranger | kein Deutsch | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| the-asterisk-war | kein Deutsch | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| the-future-diary | kein Deutsch | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| the-irregular-at-magic-high-school  | kein Deutsch | kein Deutsch | 0 → 0 | 0✓/0✕ → 0✓/2✕ |
| trigun | kein Deutsch | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| tsugumomo | kein Deutsch | kein Deutsch | 0 → 0 | 0✓/0✕ → 0✓/2✕ |
| we-never-learn-bokuben | kein Deutsch | kein Deutsch | 0 → 0 | 0✓/0✕ → 0✓/2✕ |
| wise-mans-grandchild | kein Deutsch | kein Deutsch | 0 → 0 | 0✓/0✕ → 0✓/1✕ |
| yes-no-or-maybe | kein Deutsch | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| cardcaptor-sakura-the-movie-2-the-sealed-card | nicht verfügbar | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| chaos-dragon | nicht verfügbar | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| digimon-savers | nicht verfügbar | kein Deutsch **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| flowers-of-evil | nicht verfügbar | Deutsch **↺** | 0 → 13 | 0✓/0✕ → 0✓/0✕ |
| k-missing-kings | nicht verfügbar | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| liz-and-the-blue-bird | nicht verfügbar | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| millennium-actress | nicht verfügbar | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
| peter-grill-and-the-philosophers-time | nicht verfügbar | nicht im Katalog **↺** | 0 → 0 | 0✓/0✕ → 0✓/0✕ |
