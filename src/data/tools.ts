import type { IconName } from '../lib/hugeicons'

export type Tool = {
  slug: string
  name: string
  description: string
  icon: IconName
}

export const tools: Tool[] = [
  {
    slug: 'domain-finder',
    name: 'Domain Finder',
    description: 'Check name availability across TLDs.',
    icon: 'earth',
  },
  {
    slug: 'subdomain-finder',
    name: 'Subdomain Finder',
    description: 'Every subdomain of a domain.',
    icon: 'global-search',
  },
  {
    slug: 'dns-checker',
    name: 'DNS Checker',
    description: 'Records across global resolvers.',
    icon: 'server-stack-01',
  },
  {
    slug: 'security-headers',
    name: 'Security Headers',
    description: 'Grade a site on its headers.',
    icon: 'security-check',
  },
  {
    slug: 'ip-tracker',
    name: 'IP Tracker',
    description: 'Locate any IP or hostname.',
    icon: 'location-01',
  },
  {
    slug: 'random',
    name: 'Random Generator',
    description: 'Keys, passwords and passphrases.',
    icon: 'key-01',
  },
  {
    slug: 'headers',
    name: 'Headers & Redirects',
    description: 'Response headers, hop by hop.',
    icon: 'code',
  },
  {
    slug: 'ttfb',
    name: 'Response Time',
    description: 'Time to first byte from the edge.',
    icon: 'dashboard-speed-01',
  },
]

export function getTool(slug: string) {
  return tools.find((tool) => tool.slug === slug)
}

export function requireTool(slug: string): Tool {
  const tool = getTool(slug)
  if (!tool) throw new Error(`Missing tool: ${slug}`)
  return tool
}
