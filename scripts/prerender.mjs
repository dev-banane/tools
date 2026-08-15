// Cloudflare Workers Assets serves the built SPA as-is: every route gets the
// same dist/client/index.html with generic meta tags, because there is no
// server render. Crawlers that don't execute JS (GPTBot, ClaudeBot,
// PerplexityBot, and most AEO/GEO answer engines) never see the per-tool
// title, description, canonical URL or JSON-LD that setPageMeta() only
// applies client-side after mount.

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(root, '..', 'dist', 'client')
const indexPath = path.join(distDir, 'index.html')

const SITE_URL = 'https://tools.devjakob.com'

const tools = [
  { slug: 'subdomain-finder', name: 'Subdomain Finder', description: 'Every subdomain of a domain.' },
  { slug: 'dns-checker', name: 'DNS Checker', description: 'Records across global resolvers.' },
  { slug: 'security-headers', name: 'Security Headers', description: 'Grade a site on its headers.' },
  { slug: 'ip-tracker', name: 'IP Tracker', description: 'Locate any IP or hostname.' },
  { slug: 'random', name: 'Random Generator', description: 'Keys, passwords and passphrases.' },
  { slug: 'headers', name: 'Headers & Redirects', description: 'Response headers, hop by hop.' },
  { slug: 'ttfb', name: 'Response Time', description: 'Time to first byte from the edge.' },
]

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function main() {
  const template = await readFile(indexPath, 'utf8')

  for (const tool of tools) {
    const title = escapeHtml(`${tool.name} - Tools`)
    const description = escapeHtml(`${tool.description} Free, no sign-up, by Jakob Pütz.`)
    const url = `${SITE_URL}/${tool.slug}`

    let html = template
      .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
      .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${description}$2`)
      .replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/, `$1${url}$2`)
      .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${title}$2`)
      .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${description}$2`)
      .replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/, `$1${url}$2`)
      .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/, `$1${title}$2`)
      .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, `$1${description}$2`)
      .replace(
        /"name":\s*"Tools by Jakob Pütz",(\s*)"url":\s*"[^"]*",(\s*)"applicationCategory":\s*"[^"]*",(\s*)"operatingSystem":\s*"[^"]*",(\s*)"description":\s*"[^"]*",/,
        `"name": ${JSON.stringify(title.replace(/&amp;/g, '&').replace(/&quot;/g, '"'))},$1"url": "${url}",$2"applicationCategory": "DeveloperApplication",$3"operatingSystem": "Any",$4"description": ${JSON.stringify(description.replace(/&amp;/g, '&').replace(/&quot;/g, '"'))},`,
      )

    await writeFile(path.join(distDir, `${tool.slug}.html`), html)
  }

  console.log(`Prerendered ${tools.length} tool routes.`)
}

main()
