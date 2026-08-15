import { useState } from 'react'
import { requireTool } from '../../data/tools'
import { apiGet } from '../../lib/api'
import { useAsyncTask } from '../../lib/useAsyncTask'
import { ToolLayout } from '../../components/ui/ToolLayout'
import { QueryBar } from '../../components/ui/QueryBar'
import { Empty, Hero, Panel, SkeletonRows } from '../../components/ui/Panel'
import { Banner } from '../../components/ui/Banner'
import { CopyButton } from '../../components/ui/Copy'
import { ExtLink, toExternalHref } from '../../components/ui/ExtLink'

const tool = requireTool('headers')

type Hop = {
  url: string
  status: number
  statusText: string
  headers: Record<string, string>
  setCookies: string[]
  redirectedTo?: string
  timingMs: number
}

type HeadersData = {
  url: string
  hops: Hop[]
}

function statusTone(status: number): string {
  if (status >= 400) return 'fail'
  if (status >= 300) return 'warn'
  if (status >= 200) return 'pass'
  return 'info'
}

export function HeadersTool() {
  const [url, setUrl] = useState('https://devjakob.com')
  const task = useAsyncTask((target: string) =>
    apiGet<HeadersData>('/api/headers', { url: target.trim() }),
  )

  const data = task.data
  const final = data?.hops.at(-1)

  return (
    <ToolLayout
      tool={tool}
      loading={task.loading}
      controls={
        <QueryBar
          value={url}
          onChange={setUrl}
          onSubmit={() => void task.run(url)}
          placeholder="https://example.com"
          icon="link-02"
          submitLabel="Inspect"
          loading={task.loading}
          disabled={!url.trim()}
          inputMode="url"
          aria-label="URL to inspect"
        />
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
          <Empty icon="code" title="Nothing inspected yet" />
        </Panel>
      ) : null}

      {!task.loading && data && final ? (
        <>
          <Hero
            value={
              <>
                <span data-tone={statusTone(final.status)}>{final.status}</span>
                <span className="hero__unit">{final.statusText}</span>
                <ExtLink className="hero__value--url" href={final.url}>
                  {final.url}
                </ExtLink>
              </>
            }
            tags={
              <>
                <span className="badge badge--solid num">
                  {data.hops.length} hop{data.hops.length === 1 ? '' : 's'}
                </span>
                <span className="badge badge--solid num">
                  {data.hops.reduce((total, hop) => total + hop.timingMs, 0)} ms
                </span>
                {final.headers['content-type'] ? (
                  <span className="badge badge--solid">
                    {final.headers['content-type'].split(';')[0]}
                  </span>
                ) : null}
                {final.headers['server'] ? (
                  <span className="badge badge--solid">{final.headers['server']}</span>
                ) : null}
                <span className="badge badge--solid num">
                  {Object.keys(final.headers).length} headers
                </span>
              </>
            }
          />

          {data.hops.length > 1 ? (
            <Panel title="Chain">
              <div className="rows">
                {data.hops.map((hop, index) => (
                  <div className="row" key={`chain-${index}`}>
                    <span className={`badge badge--${statusTone(hop.status)} num`}>
                      {hop.status}
                    </span>
                    <ExtLink className="row__value truncate" href={hop.url} title={hop.url}>
                      {hop.url}
                    </ExtLink>
                    <span className="badge badge--solid num">{hop.timingMs} ms</span>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          {data.hops.map((hop, index) => {
            const entries = Object.entries(hop.headers)
              .filter(([key]) => key.toLowerCase() !== 'set-cookie')
              .concat(hop.setCookies.map((cookie) => ['set-cookie', cookie] as [string, string]))
              .sort(([a], [b]) => a.localeCompare(b))

            return (
              <Panel
                key={`${hop.url}-${index}`}
                title={data.hops.length > 1 ? `Hop ${index + 1}` : 'Headers'}
                subtitle={
                  <ExtLink href={hop.url} title={hop.url}>
                    {hop.url}
                  </ExtLink>
                }
                actions={
                  <>
                    <span className={`badge badge--${statusTone(hop.status)} num`}>
                      {hop.status}
                    </span>
                    <CopyButton
                      value={entries.map(([key, value]) => `${key}: ${value}`).join('\n')}
                      label="Copy"
                    />
                  </>
                }
              >
                <div>
                  {entries.map(([key, value], i) => {
                    const href = toExternalHref(value)
                    return (
                      <div className="kv" key={`${key}-${i}`}>
                        <span className="kv__key">{key}</span>
                        {href ? (
                          <ExtLink className="kv__value" href={href}>
                            {value}
                          </ExtLink>
                        ) : (
                          <span className="kv__value">{value}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Panel>
            )
          })}
        </>
      ) : null}
    </ToolLayout>
  )
}
