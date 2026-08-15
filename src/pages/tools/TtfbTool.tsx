import { useState } from 'react'
import { requireTool } from '../../data/tools'
import { apiGet } from '../../lib/api'
import { useAsyncTask } from '../../lib/useAsyncTask'
import { ToolLayout } from '../../components/ui/ToolLayout'
import { QueryBar } from '../../components/ui/QueryBar'
import { Dropdown } from '../../components/ui/Dropdown'
import { Empty, Hero, Panel, Rows, SkeletonRows } from '../../components/ui/Panel'
import { Banner } from '../../components/ui/Banner'
import { ExtLink } from '../../components/ui/ExtLink'

const tool = requireTool('ttfb')

type TtfbData = {
  url: string
  finalUrl: string
  status: number
  statusText: string
  samples: number[]
  min: number
  max: number
  avg: number
  colo: string | null
}

const SAMPLE_OPTIONS = [
  { id: '3', label: '3 runs' },
  { id: '5', label: '5 runs' },
]

export function TtfbTool() {
  const [url, setUrl] = useState('https://devjakob.com')
  const [samples, setSamples] = useState('3')

  const task = useAsyncTask((target: string, count: string) =>
    apiGet<TtfbData>('/api/ttfb', { url: target.trim(), samples: count }),
  )

  const data = task.data
  const scale = data ? Math.max(...data.samples, 1) : 1

  return (
    <ToolLayout
      tool={tool}
      loading={task.loading}
      controls={
        <QueryBar
          value={url}
          onChange={setUrl}
          onSubmit={() => void task.run(url, samples)}
          placeholder="https://example.com"
          icon="dashboard-speed-01"
          submitLabel="Measure"
          loading={task.loading}
          disabled={!url.trim()}
          inputMode="url"
          aria-label="URL to measure"
        >
          <Dropdown
            value={samples}
            onChange={setSamples}
            options={SAMPLE_OPTIONS}
            label="Sample count"
            inline
          />
        </QueryBar>
      }
    >
      {task.error ? <Banner tone="error">{task.error}</Banner> : null}

      {task.loading ? (
        <Panel>
          <SkeletonRows count={4} />
        </Panel>
      ) : null}

      {!task.loading && !data && !task.error ? (
        <Panel>
          <Empty icon="dashboard-speed-01" title="No measurement yet" />
        </Panel>
      ) : null}

      {!task.loading && data ? (
        <>
          <Hero
            label="Average time to first byte"
            value={
              <>
                {data.avg}
                <span className="hero__unit">ms</span>
              </>
            }
            tags={
              <>
                <span className="badge badge--solid num">{data.min} ms fastest</span>
                <span className="badge badge--solid num">{data.max} ms slowest</span>
                <span className="badge badge--solid num">±{data.max - data.min} ms</span>
                {data.colo ? <span className="badge badge--solid">via {data.colo}</span> : null}
              </>
            }
          />

          <Panel title="Runs">
            <div className="samples">
              {data.samples.map((ms, index) => (
                <div className="sample" key={`${index}-${ms}`}>
                  <span className="sample__label">Run {index + 1}</span>
                  <div className="meter meter--flex">
                    <div
                      className="meter__fill"
                      style={{ width: `${Math.max(4, (ms / scale) * 100)}%` }}
                    />
                  </div>
                  <span className="sample__value num">{ms} ms</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Response">
            <Rows
              rows={[
                { label: 'Status', value: `${data.status} ${data.statusText}` },
                {
                  label: 'Final URL',
                  value: (
                    <ExtLink className="truncate" href={data.finalUrl} title={data.finalUrl}>
                      {data.finalUrl}
                    </ExtLink>
                  ),
                },
                { label: 'Edge colo', value: data.colo ?? '-' },
              ]}
            />
          </Panel>
        </>
      ) : null}
    </ToolLayout>
  )
}
