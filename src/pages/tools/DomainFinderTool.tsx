import { useMemo, useState } from 'react'
import { requireTool } from '../../data/tools'
import { apiGet } from '../../lib/api'
import { useAsyncTask } from '../../lib/useAsyncTask'
import { ToolLayout } from '../../components/ui/ToolLayout'
import { QueryBar } from '../../components/ui/QueryBar'
import { Toggle } from '../../components/ui/Controls'
import { Empty, Hero, Panel, SkeletonRows } from '../../components/ui/Panel'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { CopyButton } from '../../components/ui/Copy'
import { Icon } from '../../components/Icon'
import { copyText } from '../../lib/toast'

const tool = requireTool('domain-finder')

type DomainStatus = 'available' | 'taken' | 'unknown'

type DomainResult = {
  tld: string
  domain: string
  status: DomainStatus
  registrar: string | null
  createdAt: string | null
  expiresAt: string | null
}

type DomainData = {
  name: string
  results: DomainResult[]
  checkedAt: string
}

const STATUS_LABEL: Record<DomainStatus, string> = {
  available: 'Available',
  taken: 'Taken',
  unknown: 'Unknown',
}

const STATUS_BADGE: Record<DomainStatus, string> = {
  available: 'badge--pass',
  taken: 'badge--fail',
  unknown: 'badge--solid',
}

function formatDate(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export function DomainFinderTool() {
  const [name, setName] = useState('devjakob')
  const [extraTlds, setExtraTlds] = useState('')
  const [onlyAvailable, setOnlyAvailable] = useState(false)

  const task = useAsyncTask((target: string, tlds: string) =>
    apiGet<DomainData>('/api/domain', { name: target.trim(), tlds: tlds.trim() }),
  )
  const data = task.data

  const rows = useMemo(() => {
    if (!data) return []
    if (!onlyAvailable) return data.results
    return data.results.filter((row) => row.status === 'available')
  }, [data, onlyAvailable])

  const availableCount = data?.results.filter((r) => r.status === 'available').length ?? 0
  const takenCount = data?.results.filter((r) => r.status === 'taken').length ?? 0

  return (
    <ToolLayout
      tool={tool}
      loading={task.loading}
      controls={
        <QueryBar
          value={name}
          onChange={setName}
          onSubmit={() => void task.run(name, extraTlds)}
          placeholder="mybrand"
          icon="earth"
          submitLabel="Search"
          loading={task.loading}
          disabled={!name.trim()}
          aria-label="Domain name"
        >
          <input
            className="query__input"
            style={{ maxWidth: '11rem' }}
            value={extraTlds}
            onChange={(e) => setExtraTlds(e.target.value)}
            placeholder="extra tlds, comma sep."
            aria-label="Extra TLDs"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </QueryBar>
      }
    >
      {task.error ? <Banner tone="error">{task.error}</Banner> : null}

      {task.loading ? (
        <Panel>
          <SkeletonRows count={10} />
        </Panel>
      ) : null}

      {!task.loading && !data && !task.error ? (
        <Panel>
          <Empty icon="earth" title="No name searched yet" />
        </Panel>
      ) : null}

      {!task.loading && data ? (
        <>
          <Hero
            label="Checked across"
            value={
              <>
                {data.results.length}
                <span className="hero__unit">
                  TLD{data.results.length === 1 ? '' : 's'}
                </span>
              </>
            }
            tags={
              <>
                <span className="badge badge--pass num">{availableCount} available</span>
                <span className="badge badge--fail num">{takenCount} taken</span>
              </>
            }
          />

          <Panel
            title="Results"
            subtitle={`${rows.length} shown`}
            actions={
              <>
                <Toggle label="Available only" checked={onlyAvailable} onChange={setOnlyAvailable} />
                <CopyButton
                  value={rows
                    .filter((r) => r.status === 'available')
                    .map((r) => r.domain)
                    .join('\n')}
                  label="Copy available"
                />
              </>
            }
          >
            {rows.length === 0 ? (
              <Empty icon="search-01" title="Nothing matches" />
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Status</th>
                    <th>Registrar</th>
                    <th>Created</th>
                    <th>Expires</th>
                    <th className="table__actions" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.tld}>
                      <td className="mono">{row.domain}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[row.status]}`}>
                          {STATUS_LABEL[row.status]}
                        </span>
                      </td>
                      <td className="table__dim">{row.registrar ?? ''}</td>
                      <td className="mono num">{formatDate(row.createdAt)}</td>
                      <td className="mono num">{formatDate(row.expiresAt)}</td>
                      <td className="table__actions">
                        <Button
                          size="sm"
                          variant="bare"
                          iconOnly
                          aria-label={`Copy ${row.domain}`}
                          onClick={() => void copyText(row.domain)}
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
