/**
 * Titel mit Cover, deren Link-Vorschau das Standardbild ist und die keinen Termin tragen (Stand 13.11.2026, Datenstand der Probe:
 * `standardTrotzCoverTitel` auf `public/data` im Worktree, 16 Kennungen). `check-cover-vorschau-bestand.ts` meldet Abweichungen namentlich
 * als Warnung; die Liste darf nur schrumpfen, ein neuer Fall bekommt Maße oder ein Bild statt eines Eintrags hier.
 */
export const BEKANNT_STANDARD_TROTZ_COVER: readonly number[] = [
  10016008, 10017352, 10019036, 10019221, 10019260, 10019323, 10019909, 10020173, 10020216, 10020251, 10020252, 10020253, 10020916, 10021059, 10021154, 10021510,
]
