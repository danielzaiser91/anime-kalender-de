import { SectionTitle, Chip } from '../ui.tsx'
import { KEYWORD_PREVIEW } from './hilfen.tsx'
import { type Title } from '@shared/types.ts'
import type { Translate } from '../../lib/i18n.tsx'
import type { Dispatch, SetStateAction } from 'react'

export function SchlagworteAbschnitt({ title, t, keywords, onFilterBy, tKeyword, setAllKeywords, allKeywords }: {
  title: Title
  t: Translate
  keywords: string[]
  onFilterBy: (kind: 'genre' | 'keyword', value: string) => void
  tKeyword: (name: string) => string
  setAllKeywords: Dispatch<SetStateAction<boolean>>
  allKeywords: boolean
}) {
  return (
    <>
      {title.keywords.length > 0 && (
        <div>
          <SectionTitle>{t('detail.keywords')}</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((k) => (
              <Chip key={k} onClick={() => onFilterBy('keyword', k)}>
                {tKeyword(k)}
              </Chip>
            ))}
            {title.keywords.length > KEYWORD_PREVIEW && (
              <Chip onClick={() => setAllKeywords((v) => !v)}>
                {allKeywords
                  ? t('filter.showLess')
                  : `(…) ${t('filter.showMore', { count: title.keywords.length })}`}
              </Chip>
            )}
          </div>
        </div>
      )}
    </>
  )
}
