import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from '../Icon'

type Option<T extends string> = { id: T; label: string }

type DropdownProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: ReadonlyArray<Option<T>>
  label: string
  inline?: boolean
  auto?: boolean
}

export function Dropdown<T extends string>({
  value,
  onChange,
  options,
  label,
  inline = false,
  auto = false,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.id === value)))
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((option) => option.id === value) ?? options[0]

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const index = Math.max(0, options.findIndex((option) => option.id === value))
    setActive(index)
    queueMicrotask(() => {
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[index]?.focus()
    })
  }, [open, options, value])

  function choose(next: T) {
    onChange(next)
    setOpen(false)
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => Math.min(options.length - 1, index + 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => Math.max(0, index - 1))
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setActive(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      setActive(options.length - 1)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const option = options[active]
      if (option) choose(option.id)
      return
    }
    if (event.key === 'Tab') setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[active]?.focus()
  }, [active, open])

  const rootClass = [
    'dropdown',
    inline ? 'dropdown--inline' : '',
    auto && !inline ? 'dropdown--auto' : '',
    open ? 'dropdown--open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClass} ref={rootRef}>
      <button
        type="button"
        className="dropdown__trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="dropdown__value">{selected?.label}</span>
        <Icon name="arrow-down-01" size={14} className="dropdown__chevron" />
      </button>

      {open ? (
        <div
          className="dropdown__menu"
          role="listbox"
          id={listId}
          aria-label={label}
          tabIndex={-1}
          ref={listRef}
          onKeyDown={onListKeyDown}
        >
          {options.map((option, index) => {
            const isSelected = option.id === value
            return (
              <button
                key={option.id || `empty-${index}`}
                type="button"
                role="option"
                className="dropdown__option"
                aria-selected={isSelected}
                data-active={index === active ? 'true' : undefined}
                tabIndex={index === active ? 0 : -1}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option.id)}
              >
                <span className="dropdown__option-label">{option.label}</span>
                {isSelected ? <Icon name="tick-02" size={13} className="dropdown__check" /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
