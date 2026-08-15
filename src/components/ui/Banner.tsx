import type { ReactNode } from 'react'
import { Icon } from '../Icon'
import type { IconName } from '../../lib/hugeicons'

type Tone = 'muted' | 'error' | 'warn' | 'success'

const TONE_ICON: Record<Tone, IconName> = {
  muted: 'information-circle',
  error: 'cancel-circle',
  warn: 'alert-02',
  success: 'checkmark-circle-02',
}

type BannerProps = {
  tone?: Tone
  children: ReactNode
  actions?: ReactNode
}

export function Banner({ tone = 'muted', children, actions }: BannerProps) {
  return (
    <div className={`banner${tone === 'muted' ? '' : ` banner--${tone}`}`} role={tone === 'error' ? 'alert' : undefined}>
      <Icon name={TONE_ICON[tone]} size={16} className="banner__icon" />
      <span className="banner__text">{children}</span>
      {actions}
    </div>
  )
}
