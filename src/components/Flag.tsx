import { FLAG_CODES } from '../lib/flags'
import { Icon } from './Icon'

type FlagProps = {
  code: string | null | undefined
  name?: string | null
}

export function Flag({ code, name }: FlagProps) {
  const slug = code?.toLowerCase()

  if (!slug || !FLAG_CODES.has(slug)) {
    return (
      <span className="flag flag--none" title={name ?? undefined}>
        <Icon name="earth" size={13} />
      </span>
    )
  }

  return (
    <img
      className="flag"
      src={`/flags/${slug}.svg`}
      alt={name ?? code ?? ''}
      title={name ?? undefined}
      width={16}
      height={12}
      decoding="async"
    />
  )
}
