import { useEffect } from 'react'
import { tools } from '../data/tools'
import { ToolCard } from '../components/ToolCard'
import { Icon } from '../components/Icon'
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
          <div className="hub-head__row" data-enter style={{ ['--d' as string]: 0 }}>
            <h1 className="hub-title">Tools</h1>
            <a
              href="https://github.com/dev-banane/tools"
              target="_blank"
              rel="noopener noreferrer"
              className="hub-github"
              aria-label="View source on GitHub"
            >
              <Icon name="github" size={20} />
            </a>
          </div>
          <p className="hub-lede" data-enter style={{ ['--d' as string]: 1 }}>
            The tabs I kept reopening, rebuilt without the ads and sign-up walls.
          </p>
        </header>

        <ul className="tool-grid">
          {tools.map((tool, index) => (
            <ToolCard key={tool.slug} tool={tool} delay={2 + Math.min(index, 6)} />
          ))}
        </ul>
      </div>
    </main>
  )
}
