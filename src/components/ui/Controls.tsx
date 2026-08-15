import type { ReactNode } from 'react'

type Option<T extends string> = { id: T; label: string }

type SegmentedProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: ReadonlyArray<Option<T>>
  label: string
}

export function Segmented<T extends string>({ value, onChange, options, label }: SegmentedProps<T>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className="segmented__btn"
          data-active={value === option.id ? 'true' : undefined}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

type ToggleProps = {
  label: ReactNode
  checked: boolean
  onChange: (value: boolean) => void
}

export function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

type RangeProps = {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
}

export function Range({ label, value, onChange, min, max }: RangeProps) {
  return (
    <label className="field">
      <span className="field__label">
        {label} - {value}
      </span>
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

type ChipProps = {
  children: ReactNode
  onClick: () => void
  title?: string
}

export function Chip({ children, onClick, title }: ChipProps) {
  return (
    <button type="button" className="chip" onClick={onClick} title={title}>
      {children}
    </button>
  )
}
