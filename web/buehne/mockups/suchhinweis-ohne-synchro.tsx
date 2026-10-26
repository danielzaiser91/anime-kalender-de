import { mockup } from '../register.ts'
import { KopfMitZeile, KopfOhneHinweis, LeerMitZahl, RasterMitHinweis } from './suchhinweis-teile.tsx'

/**
 * Suchbegriffe je Fall (Kennung des Falltitels):
 * Hajime no Ippo: 0 Treffer mit Synchro, 6 ohne, einer davon gleicht dem Begriff (der schwierige Fall);
 * Tokyo Revengers: Treffer mit und ohne Synchro, keiner ohne passt genau; One Piece, Attack on Titan: lange Listen.
 */
mockup({
  name: 'suchhinweis-ohne-synchro',
  titel: 'Suche: Hinweis auf Treffer ohne deutsche Synchro',
  ausschnitt: 'datenbank',
  faelle: ['hajime-no-ippo', 'tokyo-revengers', 'one-piece', 'attack-on-titan'],
  suchbegriffe: { 232: 'Hajime no Ippo: The Fighting!', 15957: 'Tokyo Revengers', 12: 'One Piece', 10659: 'Attack on Titan' },
  varianten: {
    A: {
      ersatz: { DbKopfbereich: KopfMitZeile, DbLeer: LeerMitZahl },
      notiz: 'Textzeile mit Knopf „Anzeigen“ direkt unter der Trefferzahl. Ohne Treffer mit Synchro übernimmt die Leer-Anzeige die Zahl.',
    },
    B: {
      ersatz: { DbKopfbereich: KopfOhneHinweis, DbRaster: RasterMitHinweis, DbLeer: LeerMitZahl },
      notiz: 'Gestrichelte Reihe als letzte Zeile der Trefferliste. Ohne Treffer mit Synchro übernimmt die Leer-Anzeige die Zahl.',
    },
  },
})
