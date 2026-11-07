/**
 * Die Delta-Wache rechnet den Titel-Abzug „ohne Synchro-Beleg“ mit gewollt entfernten Belegen (Kitarou 130622, Prime-Beleg
 * `130622|primevideo|amazon:b0fx4q35v2`, Zeile vom 05.11.2026): Urteil −1 war erklärt, der Titel −1 färbte die Wache trotzdem rot.
 * Gerechnet wird je Anbieter und höchstens so viel, wie der Beleg-Eintrag neu entzieht; Kanal-Titel und Beleg zählen getrennt.
 */
import assert from 'node:assert/strict'
import { findeAuffaelliges } from '../pipeline/lib/bestand-delta.ts'

const KITAROU = '130622|primevideo|amazon:b0fx4q35v2'
const GRUENDE = { [KITAROU]: 'Kitarou Tanjou (130622): Seite gehört zur Shinsei-ban 2024' }

function kz(ueber = {}) {
  return {
    titel: 50,
    titelMitVerweis: 50,
    verweise: 100,
    mitUrteil: 90,
    ohneUrteil: 10,
    titelMitSynchro: 40,
    entferntProtokolliert: 0,
    entferntJeAnbieter: {},
    releases: 10,
    termine: 100,
    jeAnbieter: { primevideo: 5, netflix: 3 },
    kanalOhneUrteil: {},
    kanalTitelOhneSynchro: 0,
    entfernteBelege: [],
    ...ueber,
  }
}
const vor = kz()
const nachKitarou = (ueber = {}) => kz({ mitUrteil: 89, titelMitSynchro: 39, jeAnbieter: { primevideo: 4, netflix: 3 }, entfernteBelege: [KITAROU], ...ueber })

// Anlass: ohne Eintrag rot (Kontrolle: die Kulisse ist mit und ohne Regel verschieden), mit Eintrag erklärt.
const ohne = findeAuffaelliges(nachKitarou({ entfernteBelege: [] }), vor, [], GRUENDE)
assert.deepEqual(ohne.auffaellig, ['1 Urteile verloren', '1 Titel ohne Synchro-Beleg', 'primevideo: 1 Synchro-Belege weniger'])
const mit = findeAuffaelliges(nachKitarou(), vor, [], GRUENDE)
assert.deepEqual(mit.auffaellig, [], 'Kitarou: Beleg gewollt entfernt, Urteil und Titel erklärt')
assert.deepEqual(mit.erklaert, [
  '1 Titel ohne Synchro-Beleg, weil ihr Beleg gewollt entfernt wurde',
  'primevideo: Beleg gewollt entfernt – Kitarou Tanjou (130622): Seite gehört zur Shinsei-ban 2024',
])

// Zwei Titel verlieren ihr Ja, nur ein Beleg ist entzogen: einer bleibt rot.
const zwei = findeAuffaelliges(nachKitarou({ titelMitSynchro: 38 }), vor, [], GRUENDE)
assert.deepEqual(zwei.auffaellig, ['1 Titel ohne Synchro-Beleg (1 weitere durch gewollt entfernten Beleg)'])

// Kanal-Titel und Beleg erklären je einen Titel, ohne einander zu verbrauchen.
const beide = findeAuffaelliges(nachKitarou({ titelMitSynchro: 38, kanalTitelOhneSynchro: 1 }), kz({ kanalTitelOhneSynchro: 0 }), [], GRUENDE)
assert.deepEqual(beide.auffaellig, [], 'ein Titel durch Kanal-Titel, einer durch Beleg')
assert.equal(beide.erklaert.filter((z) => z.includes('Titel ohne Synchro-Beleg')).length, 2)

// Ein Beleg-Eintrag erklärt keinen Titelverlust ohne Beleg-Rückgang (Titel −1, aber Anbieterzahlen und Urteile gleich).
const fremd = findeAuffaelliges(kz({ titelMitSynchro: 39, entfernteBelege: [KITAROU] }), vor, [], GRUENDE)
assert.deepEqual(fremd.auffaellig, ['1 Titel ohne Synchro-Beleg'], 'Eintrag ohne Rückgang erklärt nichts')

// Zweiter Lauf: der Eintrag stand schon in der vorigen Zeile, ein weiterer Verlust bleibt rot.
const zweiter = findeAuffaelliges(
  kz({ mitUrteil: 88, titelMitSynchro: 38, jeAnbieter: { primevideo: 3, netflix: 3 }, entfernteBelege: [KITAROU] }),
  nachKitarou(),
  [],
  GRUENDE,
)
assert.deepEqual(zweiter.auffaellig, ['1 Urteile verloren', '1 Titel ohne Synchro-Beleg', 'primevideo: 1 Synchro-Belege weniger'])

// Titelzuwachs oder gleicher Stand: nichts zu erklären.
assert.deepEqual(findeAuffaelliges(kz({ titelMitSynchro: 41, entfernteBelege: [KITAROU] }), vor, [], GRUENDE), { auffaellig: [], erklaert: [] })

console.log('delta-wache-titel-beleg: 7 Fälle ok (Kitarou 130622 erklärt, Kontrolle ohne Eintrag rot)')
