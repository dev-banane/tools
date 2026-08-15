import type { ReactNode } from 'react'
import { Icon } from '../Icon'
import type { IconName } from '../../lib/hugeicons'

type PanelProps = {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
}

export function Panel({ title, subtitle, actions, children }: PanelProps) {
  return (
    <section className="panel">
      {title || actions ? (
        <header className="panel__head">
          <div className="panel__titles">
            {title ? <h2 className="panel__title">{title}</h2> : null}
            {subtitle ? <span className="panel__subtitle">{subtitle}</span> : null}
          </div>
          {actions ? <div className="panel__actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}

type HeroProps = {
  lead?: ReactNode
  label?: ReactNode
  value: ReactNode
  tags?: ReactNode
  aside?: ReactNode
}

export function Hero({ lead, label, value, tags, aside }: HeroProps) {
  return (
    <section className="hero">
      {lead}
      <div className="hero__main">
        {label ? <p className="hero__label">{label}</p> : null}
        <div className="hero__value">{value}</div>
      </div>
      {tags || aside ? (
        <div className="hero__side">
          {tags ? <div className="hero__tags">{tags}</div> : null}
          {aside ? <div className="hero__aside">{aside}</div> : null}
        </div>
      ) : null}
    </section>
  )
}

export function Split({ children }: { children: ReactNode }) {
  return <div className="split">{children}</div>
}

type RowsProps = {
  rows: Array<{ label: string; value: ReactNode; key?: string }>
}

export function Rows({ rows }: RowsProps) {
  return (
    <div className="rows">
      {rows.map((row) => (
        <div className="row" key={row.key ?? row.label}>
          <span className="row__label">{row.label}</span>
          <span className="row__value">{row.value}</span>
        </div>
      ))}
    </div>
  )
}

type EmptyProps = {
  icon?: IconName
  title: string
}

export function Empty({ icon = 'search-01', title }: EmptyProps) {
  return (
    <div className="empty">
      <span className="empty__icon" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <p className="empty__title">{title}</p>
    </div>
  )
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="skeleton-rows" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div
          className="skeleton"
          key={i}
          style={{ height: '1.1rem', width: `${92 - (i % 4) * 14}%` }}
        />
      ))}
    </div>
  )
}
