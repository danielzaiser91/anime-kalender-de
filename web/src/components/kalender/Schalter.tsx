export function Schalter({
  an,
  setzen,
  label,
  hinweis,
  ariaLabel,
}: {
  an: boolean
  setzen: (an: boolean) => void
  label: string
  hinweis?: string
  ariaLabel?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      aria-label={ariaLabel}
      onClick={() => setzen(!an)}
      className="flex min-h-11 cursor-pointer items-center gap-3 text-left text-sm text-ak-text"
    >
      <span className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition ${an ? 'bg-ak-akzent' : 'bg-ak-rand'}`}>
        <span className={`absolute top-[3px] size-4 rounded-full transition-all ${an ? 'left-[19px] bg-[#0d0f14]' : 'left-[3px] bg-white shadow'}`} />
      </span>
      {label && (
        <span className="flex flex-col">
          <span className="font-bold">{label}</span>
          {hinweis && <span className="text-xs text-ak-leise">{hinweis}</span>}
        </span>
      )}
    </button>
  )
}
