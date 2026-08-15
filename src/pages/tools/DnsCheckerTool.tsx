import { useEffect, useState } from 'react'
import { requireTool } from '../../data/tools'
import { apiGet } from '../../lib/api'
import { useAsyncTask } from '../../lib/useAsyncTask'
import { ToolLayout } from '../../components/ui/ToolLayout'
import { QueryBar } from '../../components/ui/QueryBar'
import { Segmented } from '../../components/ui/Controls'
import { Dropdown } from '../../components/ui/Dropdown'
import { Hero, Panel, SkeletonRows } from '../../components/ui/Panel'
import { Banner } from '../../components/ui/Banner'
import { CopyButton, KeyRow } from '../../components/ui/Copy'
import { ExtLink, toExternalHref } from '../../components/ui/ExtLink'
import { Icon } from '../../components/Icon'
import { Flag } from '../../components/Flag'

const tool = requireTool('dns-checker')

const TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'SRV', 'CAA', 'PTR'] as const
type DnsType = (typeof TYPES)[number]

const TYPE_OPTIONS = TYPES.map((t) => ({ id: t, label: t }))
const COMMON_TYPES = TYPE_OPTIONS.slice(0, 6)

type ResolverResult = {
  id: string
  name: string
  location: string
  country: string
  countryCode: string | null
  filtering: boolean
  records: string[]
  ttl: number | null
  rcode: string
  ms: number
  error?: string
  match: boolean
}

type DnsData = {
  host: string
  type: DnsType
  consensus: string[]
  agreeing: number
  answered: number
  total: number
  results: ResolverResult[]
  checkedAt: string
}

function formatTtl(seconds: number | null): string {
  if (seconds == null) return '-'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86_400)}d`
}

function stateOf(result: ResolverResult): 'match' | 'mismatch' | 'empty' | 'error' {
  if (result.error) return 'error'
  if (result.records.length === 0) return 'empty'
  return result.match ? 'match' : 'mismatch'
}

const STATE_ICON = {
  match: 'checkmark-circle-02',
  mismatch: 'alert-02',
  empty: 'cancel-circle',
  error: 'cancel-circle',
} as const

export function DnsCheckerTool() {
  const [host, setHost] = useState('devjakob.com')
  const [type, setType] = useState<DnsType>('A')
  const task = useAsyncTask((h: string, t: DnsType) =>
    apiGet<DnsData>('/api/dns', { host: h.trim(), type: t }),
  )
  const { run } = task

  useEffect(() => {
    void run('devjakob.com', 'A')
  }, [run])

  function check(nextType: DnsType = type) {
    if (!host.trim()) return
    void run(host, nextType)
  }

  const data = task.data
  const propagation = data && data.total > 0 ? Math.round((data.agreeing / data.total) * 100) : 0
  const ttl = data?.results.find((result) => result.ttl != null)?.ttl ?? null

  return (
    <ToolLayout
      tool={tool}
      loading={task.loading}
      controls={
        <div className="stack">
          <QueryBar
            value={host}
            onChange={setHost}
            onSubmit={() => check()}
            placeholder="example.com"
            icon="server-stack-01"
            submitLabel="Check"
            loading={task.loading}
            disabled={!host.trim()}
            aria-label="Hostname"
          >
            <Dropdown
              value={type}
              onChange={(next) => {
                setType(next)
                check(next)
              }}
              options={TYPE_OPTIONS}
              label="Record type"
              inline
            />
          </QueryBar>

          <Segmented
            value={type}
            onChange={(next) => {
              setType(next)
              check(next)
            }}
            options={COMMON_TYPES}
            label="Record type"
          />
        </div>
      }
    >
      {task.error ? <Banner tone="error">{task.error}</Banner> : null}

      {task.loading ? (
        <Panel>
          <SkeletonRows count={6} />
        </Panel>
      ) : null}

      {!task.loading && data ? (
        <>
          <Hero
            label={
              <>
                {data.type} · <ExtLink>{data.host}</ExtLink>
              </>
            }
            value={
              data.consensus.length ? (
                <div className="keylist">
                  {data.consensus.map((record) => (
                    <KeyRow key={record} value={record} />
                  ))}
                </div>
              ) : (
                <span className="hero__value--empty">No {data.type} records</span>
              )
            }
            tags={
              <>
                <span
                  className={`badge badge--${
                    propagation === 100 ? 'pass' : propagation >= 70 ? 'warn' : 'fail'
                  }`}
                >
                  {propagation}% agree
                </span>
                <span className="badge badge--solid num">
                  {data.answered}/{data.total} answered
                </span>
                <span className="badge badge--solid num">TTL {formatTtl(ttl)}</span>
              </>
            }
            aside={
              data.consensus.length > 1 ? (
                <CopyButton value={data.consensus.join('\n')} label="Copy all" />
              ) : null
            }
          />

          <Panel title="Resolvers" subtitle={`${data.total}`}>
            <table className="table">
              <thead>
                <tr>
                  <th>Resolver</th>
                  <th>Location</th>
                  <th>Answer</th>
                  <th className="num">TTL</th>
                  <th className="num">Time</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((result) => {
                  const state = stateOf(result)
                  const answer = result.error
                    ? result.error
                    : result.records.length
                      ? result.records.join(', ')
                      : `No ${data.type} record${result.rcode !== 'NOERROR' ? ` · ${result.rcode}` : ''}`

                  return (
                    <tr key={result.id} data-state={state}>
                      <td>
                        <span className="cell">
                          <span className="cell__icon" data-state={state} aria-label={state}>
                            <Icon name={STATE_ICON[state]} size={14} />
                          </span>
                          {result.name}
                          {result.filtering ? <span className="badge">filtering</span> : null}
                        </span>
                      </td>
                      <td className="table__dim">
                        <span className="cell">
                          <Flag code={result.countryCode} name={result.country} />
                          {result.location}
                        </span>
                      </td>
                      <td className="mono truncate" title={answer}>
                        {result.records.length ? (
                          <span className="cell cell--wrap">
                            {result.records.map((record, index) => {
                              const href = toExternalHref(record)
                              return (
                                <span key={`${result.id}-${record}-${index}`}>
                                  {index > 0 ? ', ' : null}
                                  {href ? <ExtLink href={href} value={record}>{record}</ExtLink> : record}
                                </span>
                              )
                            })}
                          </span>
                        ) : (
                          <span className="table__dim">{answer}</span>
                        )}
                      </td>
                      <td className="num table__dim">{formatTtl(result.ttl)}</td>
                      <td className="num table__dim">{result.ms} ms</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Panel>
        </>
      ) : null}
    </ToolLayout>
  )
}
