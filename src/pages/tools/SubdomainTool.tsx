import { useEffect, useMemo, useState } from 'react'
import { requireTool } from '../../data/tools'
import { apiGet } from '../../lib/api'
import { useAsyncTask } from '../../lib/useAsyncTask'
import { ToolLayout } from '../../components/ui/ToolLayout'
import { QueryBar } from '../../components/ui/QueryBar'
import { Toggle } from '../../components/ui/Controls'
import { Dropdown } from '../../components/ui/Dropdown'
import { Empty, Hero, Panel, SkeletonRows } from '../../components/ui/Panel'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { CopyButton } from '../../components/ui/Copy'
import { ExtLink } from '../../components/ui/ExtLink'
import { Icon } from '../../components/Icon'
import { copyText } from '../../lib/toast'
import { SUBDOMAIN_WORDLIST } from '../../data/subdomainWordlist'

const tool = requireTool('subdomain-finder')

const BATCH_SIZE = 25
const CONCURRENCY = 4
const MAX_RESOLVE = 500

type SourceResult = { id: string; name: string; count: number; error?: string }

type SubdomainData = {
  host: string
  count: number
  subdomains: string[]
  sources: SourceResult[]
  checkedAt: string
}

type ResolvedHost = {
  host: string
  ips: string[]
  cname: string | null
  provider: string | null
  cloudflare: boolean
  status: 'ok' | 'nxdomain' | 'empty' | 'error'
}

type SortKey = 'name' | 'ip' | 'provider'
type ScanMode = 'all' | 'dns'

const SORT_OPTIONS = [
  { id: 'name' as const, label: 'Sort: name' },
  { id: 'ip' as const, label: 'Sort: IP' },
  { id: 'provider' as const, label: 'Sort: provider' },
]

const MODE_OPTIONS = [
  { id: 'all' as const, label: 'DNS + links' },
  { id: 'dns' as const, label: 'DNS only' },
]

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function downloadCsv(host: string, rows: Array<{ name: string; ip: string; provider: string }>) {
  const csv = [
    'subdomain,ip,provider',
    ...rows.map((row) => `${row.name},${row.ip},${row.provider}`),
  ].join('\n')

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${host}-subdomains.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function SubdomainTool() {
  const [host, setHost] = useState('devjakob.com')
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<SortKey>('name')
  const [mode, setMode] = useState<ScanMode>('all')
  const [onlyResolved, setOnlyResolved] = useState(false)

  const task = useAsyncTask((target: string, scanMode: ScanMode) =>
    apiGet<SubdomainData>('/api/subdomains', { host: target.trim(), mode: scanMode }),
  )
  const data = task.data

  const [resolved, setResolved] = useState<Record<string, ResolvedHost>>({})
  const [resolving, setResolving] = useState(false)
  const [bruteFound, setBruteFound] = useState<string[]>([])

  const bruteCandidates = useMemo(() => {
    if (!data) return []
    const known = new Set(data.subdomains)
    return SUBDOMAIN_WORDLIST.map((word) => `${word}.${data.host}`).filter((h) => !known.has(h))
  }, [data])

  useEffect(() => {
    const known = data?.subdomains ?? []
    if (!data || (known.length === 0 && bruteCandidates.length === 0)) {
      setResolved({})
      setBruteFound([])
      setResolving(false)
      return
    }

    let cancelled = false
    setResolved({})
    setBruteFound([])
    setResolving(true)

    const knownBatches = chunk(known.slice(0, MAX_RESOLVE), BATCH_SIZE)
    const bruteBatches = chunk(bruteCandidates, BATCH_SIZE)
    let knownCursor = 0
    let bruteCursor = 0

    let wildcardIps: string | null = null

    async function probeWildcard() {
      const probe = `${Math.random().toString(36).slice(2, 12)}-check.${data!.host}`
      try {
        const result = await apiGet<{ results: ResolvedHost[] }>('/api/resolve', { hosts: probe })
        const row = result.results[0]
        if (row?.status === 'ok') wildcardIps = [...row.ips].sort().join(',')
      } catch {
      }
    }

    async function worker() {
      for (;;) {
        if (cancelled) return
        const isBrute = knownCursor >= knownBatches.length
        const batch = isBrute ? bruteBatches[bruteCursor++] : knownBatches[knownCursor++]
        if (!batch) return
        try {
          const result = await apiGet<{ results: ResolvedHost[] }>('/api/resolve', {
            hosts: batch.join(','),
          })
          if (cancelled) return
          setResolved((prev) => {
            const next = { ...prev }
            for (const row of result.results) next[row.host] = row
            return next
          })
          if (isBrute) {
            const hits = result.results
              .filter((row) => row.status === 'ok' && [...row.ips].sort().join(',') !== wildcardIps)
              .map((row) => row.host)
            if (hits.length) setBruteFound((prev) => [...prev, ...hits])
          }
        } catch {
        }
      }
    }

    void probeWildcard().then(() =>
      Promise.all(Array.from({ length: CONCURRENCY }, worker)),
    ).then(() => {
      if (!cancelled) setResolving(false)
    })

    return () => {
      cancelled = true
    }
  }, [data, bruteCandidates])

  const allNames = useMemo(() => {
    if (!data) return []
    const set = new Set(data.subdomains)
    for (const host of bruteFound) set.add(host)
    return [...set]
  }, [data, bruteFound])

  const rows = useMemo(() => {
    if (!data) return []
    const needle = filter.trim().toLowerCase()

    const mapped = allNames.map((name) => {
      const entry = resolved[name]
      return {
        name,
        ip: entry?.ips[0] ?? '',
        extraIps: Math.max(0, (entry?.ips.length ?? 0) - 1),
        provider: entry?.provider ?? '',
        cname: entry?.cname ?? '',
        cloudflare: entry?.cloudflare ?? false,
        state: entry?.status,
      }
    })

    const filtered = mapped.filter((row) => {
      if (onlyResolved && row.state !== 'ok') return false
      if (!needle) return true
      return (
        row.name.includes(needle) ||
        row.ip.includes(needle) ||
        row.provider.toLowerCase().includes(needle)
      )
    })

    return filtered.sort((a, b) => {
      if (sort === 'ip') return a.ip.localeCompare(b.ip, undefined, { numeric: true })
      if (sort === 'provider') return a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name)
      return a.name.localeCompare(b.name)
    })
  }, [allNames, resolved, filter, sort, onlyResolved])

  const resolvedList = Object.values(resolved)
  const uniqueIps = new Set(resolvedList.flatMap((entry) => entry.ips)).size
  const behindCloudflare = resolvedList.filter((entry) => entry.cloudflare).length
  const resolveTarget = Math.min(data?.subdomains.length ?? 0, MAX_RESOLVE) + bruteCandidates.length
  const progress = resolveTarget ? Math.round((resolvedList.length / resolveTarget) * 100) : 0

  return (
    <ToolLayout
      tool={tool}
      loading={task.loading || resolving}
      controls={
        <QueryBar
          value={host}
          onChange={setHost}
          onSubmit={() => void task.run(host, mode)}
          placeholder="example.com"
          icon="global-search"
          submitLabel="Find"
          loading={task.loading}
          disabled={!host.trim()}
          aria-label="Domain"
        >
          <Dropdown
            value={mode}
            onChange={(next) => {
              setMode(next)
              if (host.trim()) void task.run(host, next)
            }}
            options={MODE_OPTIONS}
            label="Sources"
            inline
          />
        </QueryBar>
      }
    >
      {task.error ? <Banner tone="error">{task.error}</Banner> : null}

      {task.loading ? (
        <Panel>
          <SkeletonRows count={8} />
        </Panel>
      ) : null}

      {!task.loading && !data && !task.error ? (
        <Panel>
          <Empty icon="global-search" title="No domain searched yet" />
        </Panel>
      ) : null}

      {!task.loading && data ? (
        <>
          <Hero
            label={
              <ExtLink href={`https://${data.host}`}>{data.host}</ExtLink>
            }
            value={
              <>
                {allNames.length}
                <span className="hero__unit">
                  subdomain{allNames.length === 1 ? '' : 's'}
                </span>
              </>
            }
            tags={
              <>
                <span className="badge badge--solid num">
                  {resolvedList.filter((entry) => entry.status === 'ok').length} resolving
                </span>
                <span className="badge badge--solid num">{uniqueIps} unique IPs</span>
                <span className="badge badge--solid num">{behindCloudflare} on Cloudflare</span>
                {bruteFound.length > 0 ? (
                  <span className="badge badge--solid num">{bruteFound.length} via brute force</span>
                ) : null}
                {resolving ? (
                  <span className="badge badge--info num">{progress}% scanned</span>
                ) : null}
              </>
            }
          />

          <Panel
            title="Results"
            subtitle={`${rows.length} shown`}
            actions={
              <>
                <CopyButton value={rows.map((row) => row.name).join('\n')} label="Copy" />
                <Button
                  size="sm"
                  variant="quiet"
                  onClick={() =>
                    downloadCsv(
                      data.host,
                      rows.map((row) => ({
                        name: row.name,
                        ip: row.ip,
                        provider: row.provider,
                      })),
                    )
                  }
                >
                  <Icon name="file-export" size={13} />
                  CSV
                </Button>
              </>
            }
          >
            <div className="toolbar">
              <div className="toolbar__search">
                <Icon name="search-01" size={15} />
                <input
                  className="toolbar__input"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter by name, IP or provider"
                  aria-label="Filter results"
                  spellCheck={false}
                />
              </div>
              <Dropdown
                value={sort}
                onChange={setSort}
                options={SORT_OPTIONS}
                label="Sort by"
                auto
              />
              <Toggle label="Resolving only" checked={onlyResolved} onChange={setOnlyResolved} />
            </div>

            {rows.length === 0 ? (
              <Empty
                icon="search-01"
                title={allNames.length === 0 ? 'No subdomains found' : 'Nothing matches'}
              />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Subdomain</th>
                    <th>IP address</th>
                    <th>Provider</th>
                    <th className="table__actions" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.name}>
                      <td className="mono">
                        <ExtLink href={`https://${row.name}`}>{row.name}</ExtLink>
                      </td>
                      <td className="mono num">
                        {row.ip ? (
                          <>
                            {row.ip}
                            {row.extraIps > 0 ? (
                              <span className="table__more">+{row.extraIps}</span>
                            ) : null}
                          </>
                        ) : row.state === undefined ? (
                          <span className="skeleton skeleton--cell" />
                        ) : (
                          <span className="table__dim">
                            {row.state === 'nxdomain' ? 'NXDOMAIN' : 'no A record'}
                          </span>
                        )}
                      </td>
                      <td>
                        {row.provider ? (
                          <span className={`badge${row.cloudflare ? ' badge--info' : ''}`}>
                            {row.cloudflare ? <Icon name="cloud" size={11} /> : null}
                            {row.provider}
                          </span>
                        ) : row.cname ? (
                          <ExtLink className="mono truncate" title={row.cname}>
                            {row.cname}
                          </ExtLink>
                        ) : null}
                      </td>
                      <td className="table__actions">
                        <Button
                          size="sm"
                          variant="bare"
                          iconOnly
                          aria-label={`Copy ${row.name}`}
                          onClick={() => void copyText(row.name)}
                        >
                          <Icon name="copy-01" size={13} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </>
      ) : null}
    </ToolLayout>
  )
}
