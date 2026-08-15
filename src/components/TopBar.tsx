import { Link } from 'react-router'
import { Icon } from './Icon'
import { ThemeToggle } from './ThemeToggle'

type TopBarProps = {
  href?: string
  label?: string
  width?: string
  external?: boolean
}

export function TopBar({
  href = '/',
  label = 'Back',
  width = '40rem',
  external = false,
}: TopBarProps) {
  const backClass = 'back'
  const content = (
    <>
      <Icon name="arrow-left-01" className="back__icon" size={16} />
      {label}
    </>
  )

  return (
    <header className="top">
      <div className="top__inner" style={{ ['--top-width' as string]: width }}>
        {external ? (
          <a href={href} className={backClass}>
            {content}
          </a>
        ) : (
          <Link to={href} className={backClass}>
            {content}
          </Link>
        )}
        <ThemeToggle />
      </div>
    </header>
  )
}
