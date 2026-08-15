import { useEffect } from 'react'
import { tools } from '../data/tools'
import { ToolCard } from '../components/ToolCard'
import { setPageMeta } from '../lib/seo'

export function Home() {
  useEffect(() => {
    setPageMeta({
      title: 'Tools by Jakob Pütz',
      description:
        'Personal developer tools by Jakob Pütz - DNS, IP, security checks, generators, and more.',
      path: '/',
    })
  }, [])

  return (
    <main className="page page--hub">
      <div className="page__inner">
        <header className="hub-head">
          <h1 className="hub-title" data-enter style={{ ['--d' as string]: 0 }}>
            Tools
          </h1>
          <p className="hub-lede" data-enter style={{ ['--d' as string]: 1 }}>
            The tabs I kept reopening, rebuilt without the ads and sign-up walls.
          </p>
        </header>

        <ul className="tool-grid">
          {tools.map((tool, index) => (
            <ToolCard key={tool.slug} tool={tool} delay={2 + index} />
          ))}
        </ul>
      </div>
    </main>
  )
}
