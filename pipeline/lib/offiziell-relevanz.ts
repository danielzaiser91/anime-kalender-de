/**
 * Relevanzfilter für Meldungen offizieller Seiten: Was sagt die Überschrift über Termin, Synchro, Staffel oder Ausstrahlung?
 *
 * Der Filter ist nur eine **Vorauswahl** (Handstichprobe 13.10.2026: 6 von 324 Überschriften relevant, ≈ 2 %; das Stichwortnetz fing 4 von 39 Treffern, also ≈ 10 %).
 * Über die Meldung entscheidet die Freigabe von Hand. Deshalb gilt: lieber ein Treffer zu viel als eine Staffelankündigung verpasst — aber Blu-ray-Aktionen,
 * Radio, Goodies und Wiederholungen im japanischen Fernsehen fallen vorher heraus.
 */
export type Kategorie = 'staffel' | 'film' | 'synchro' | 'termin'

/** Reihenfolge = Rang: Eine Meldung „Staffel 2 bei Netflix“ ist zuerst eine Staffelankündigung. */
export const KATEGORIEN: Kategorie[] = ['staffel', 'film', 'synchro', 'termin']

const ZAHL = '[0-9０-９一二三四五六七八九十]+'

const MUSTER: Record<Kategorie, RegExp> = {
  staffel: new RegExp(`第?\\s*${ZAHL}\\s*期|続編|新シリーズ|制作決定|シーズン\\s*${ZAHL}|season\\s*\\d|\\d(?:st|nd|rd|th)\\s+season|second season|sequel|production confirmed`, 'i'),
  film: /劇場版|劇場公開|映画化|新作映画|公開決定|\b(?:movie|film)\b/i,
  synchro: /吹替|吹き替え|\bdub(?:bed|bing)?\b|synchron|deutsch|german/i,
  termin: /放送決定|放送開始決定|放送・配信|配信決定|配信開始|世界独占|世界同時|全世界|海外|netflix|prime video|crunchyroll|disney\+|worldwide|global|streaming|premiere|release date/i,
}

/** Was diese Überschrift zur Aktion macht, die uns nicht betrifft: Japan-Blu-ray, Radio, Goodies, Events, Rundfunk-Wiederholungen. */
const NEGATIV = new RegExp(
  [
    'ラジオ', 'くじ', 'POP\\s?-?UP', 'ポップアップ', 'グッズ', 'ブロマイド', 'ノンクレジット', '物販', 'ガチャ', 'ステッカー', 'ポスター',
    'blu-?ray', 'ブルーレイ', '\\bBD\\b', 'DVD', '\\bCD\\b', 'サウンドトラック', 'サントラ', '主題歌', 'キャスト', '声優',
    '生配信', '生放送', 'TVer', 'ABEMA', 'YouTube', 'チャンネルNECO', '放送開始記念', 'プレゼント', 'キャンペーン', 'コラボ',
    'ビジュアル', '場面カット', '舞台挨拶', '上映会', '入場者特典', 'ムビチケ', '前売', 'イベント', '展示',
    '\\bPV\\b', '映像', 'オープニング', 'エンディング', 'メイキング', '特報', '予告', 'ティザー', 'trailer',
    'AT-X', 'BS\\d', 'TOKYO\\s?MX', '一挙', 'レンタル', 'U-?NEXT', 'dアニメ', 'バンダイチャンネル', 'ニコニコ', 'ニコ生', 'アニメ放題', 'DMM', 'ひかりTV', 'FOD', 'Lemino',
  ].join('|'),
  'i',
)

/** Das hebt die Ausschlussliste auf: Wer Synchro oder weltweite Plattformstarts meldet, ist für uns auch mit Goodies im Satz relevant. */
const STARK = /吹替|吹き替え|\bdub(?:bed|bing)?\b|世界独占|世界同時|全世界|netflix|prime video|crunchyroll|disney\+|production confirmed/i

/** Die Kategorie einer Überschrift; `undefined`, wenn sie nichts über Termin, Synchro, Staffel oder Ausstrahlung sagt. */
export function kategorie(titel: string): Kategorie | undefined {
  if (NEGATIV.test(titel) && !STARK.test(titel)) return undefined
  return KATEGORIEN.find((k) => MUSTER[k].test(titel))
}
