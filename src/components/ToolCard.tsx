import { Link } from 'react-router'
import type { Tool } from '../data/tools'
import { Icon } from './Icon'

type ToolCardProps = {
  tool: Tool
  delay?: number
}

export function ToolCard({ tool, delay = 0 }: ToolCardProps) {
  return (
    <li data-enter style={{ ['--d' as string]: delay }}>
      <Link to={`/${tool.slug}`} className="tool-card">
        <span className="tool-card__icon" aria-hidden="true">
          <Icon name={tool.icon} size={18} />
        </span>
        <span className="tool-card__body">
          <span className="tool-card__title">{tool.name}</span>
          <span className="tool-card__desc">{tool.description}</span>
        </span>
        <span className="tool-card__go" aria-hidden="true">
          <Icon name="arrow-right-01" size={15} />
        </span>
      </Link>
    </li>
  )
}
