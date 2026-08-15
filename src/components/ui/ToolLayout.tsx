import { useEffect, type ReactNode } from 'react'
import type { Tool } from '../../data/tools'
import { setPageMeta } from '../../lib/seo'
import { PageProgress } from './PageProgress'

type ToolLayoutProps = {
  tool: Tool
  controls?: ReactNode
  actions?: ReactNode
  loading?: boolean
  children?: ReactNode
}

export function ToolLayout({
  tool,
  controls,
  actions,
  loading = false,
  children,
}: ToolLayoutProps) {
  useEffect(() => {
    setPageMeta({
      title: `${tool.name} - Tools`,
      description: tool.description,
      path: `/${tool.slug}`,
    })
  }, [tool])

  return (
    <main className="page">
      <PageProgress active={loading} />
      <div className="page__inner">
        <header className="tool-head" data-enter style={{ ['--d' as string]: 0 }}>
          <h1 className="tool-title">{tool.name}</h1>
          {actions ? <div className="tool-head__actions">{actions}</div> : null}
        </header>

        <div className="tool-panel">
          {controls ? (
            <div data-enter style={{ ['--d' as string]: 1 }}>
              {controls}
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </main>
  )
}
