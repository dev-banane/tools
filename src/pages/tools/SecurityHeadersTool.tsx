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
import { Icon } from '../../components/Icon'
import type { IconName } from '../../lib/hugeicons'

const tool = requireTool('security-headers')

type Status = 'pass' | 'warn' | 'fail' | 'info'

type Finding = {
  id: string
  header: string
  label: string
  status: Status
  value?: string
  detail: string
  advice?: string
  docs?: string
  suggested?: boolean
}

type MissingHeader = {
  header: string
  label: string
  detail: string
  example: string
  docs: string
  penalty: number
}

type Hop = {
  url: string
  status: number
  statusText: string
  redirectedTo?: string
  timingMs: number
}

type SecurityData = {
  url: string
  finalUrl: string
  status: number
  statusText: string
  https: boolean
  grade: string
  score: number
  findings: Finding[]
  missing: MissingHeader[]
  warnings: Finding[]
  disclosures: Finding[]
  rawHeaders: Array<[string, string]>
  securityHeaderNames: string[]
  hops: Hop[]
  checkedAt: string
}

const STATUS_ICON: Record<Status, IconName> = {
  pass: 'checkmark-circle-02',
  warn: 'alert-02',
  fail: 'cancel-circle',
  info: 'information-circle',
}

export function SecurityHeadersTool() {
  const [url, setUrl] = useState('https://devjakob.com')
  const task = useAsyncTask((target: string) =>
    apiGet<SecurityData>('/api/security', { url: target.trim() }),
  )

  const data = task.data

  const issues: Finding[] = data
    ? [
        ...data.missing.map((item) => ({
          id: `missing-${item.header}`,
          header: item.header,
          label: item.label,
          status: 'fail' as Status,
          value: item.example,
          detail: item.detail,
          docs: item.docs,
          suggested: true,
        })),
        ...data.warnings,
        ...data.disclosures,
      ]
    : []

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
          icon="shield-01"
          submitLabel="Scan"
          loading={task.loading}
          disabled={!url.trim()}
          inputMode="url"
          aria-label="URL to scan"
        />
      }
    >
      {task.error ? <Banner tone="error">{task.error}</Banner> : null}

      {task.loading ? (
        <Panel>
          <SkeletonRows count={6} />
        </Panel>
      ) : null}

      {!task.loading && !data && !task.error ? (
        <Panel>
          <Empty icon="shield-01" title="Nothing scanned yet" />
        </Panel>
      ) : null}

      {!task.loading && data ? (
        <>
          <Hero
            lead={
              <div className="grade" data-grade={data.grade}>
                {data.grade.length > 1 ? (
                  <span>
                    {data.grade[0]}
                    <span className="grade__sup">{data.grade.slice(1)}</span>
                  </span>
                ) : (
                  data.grade
                )}
              </div>
            }
            label={`${data.score}/100`}
            value={
              <ExtLink className="hero__value--url" href={data.finalUrl}>
                {data.finalUrl}
              </ExtLink>
            }
            tags={
              <>
                <span className={`badge badge--${data.https ? 'pass' : 'fail'}`}>
                  {data.https ? 'HTTPS' : 'No HTTPS'}
                </span>
                <span className="badge badge--solid num">
                  {data.status} {data.statusText}
                </span>
                <span className={`badge badge--${issues.length ? 'warn' : 'pass'} num`}>
                  {issues.length} issue{issues.length === 1 ? '' : 's'}
                </span>
                {data.hops.length > 1 ? (
                  <span className="badge badge--solid num">{data.hops.length - 1} redirects</span>
                ) : null}
              </>
            }
          />

          {issues.length ? (
            <Panel title="Issues" subtitle={`${issues.length}`}>
              <FindingList findings={issues} />
            </Panel>
          ) : (
            <Banner tone="success">Every header this scan looks for is set.</Banner>
          )}

          {data.findings.length ? (
            <Panel title="In place" subtitle={`${data.findings.length}`}>
              <FindingList findings={data.findings} />
            </Panel>
          ) : null}

          {data.hops.length > 1 ? (
            <Panel title="Redirect chain">
              <div className="rows">
                {data.hops.map((hop, index) => (
                  <div className="row" key={`${hop.url}-${index}`}>
                    <span className="row__label num">
                      {hop.status} {hop.statusText}
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

          <Panel
            title="Raw headers"
            subtitle={`${data.rawHeaders.length}`}
            actions={
              <CopyButton
                value={data.rawHeaders.map(([key, value]) => `${key}: ${value}`).join('\n')}
                label="Copy all"
              />
            }
          >
            <div>
              {data.rawHeaders.map(([key, value], index) => {
                const href = toExternalHref(value)
                return (
                  <div
                    className="kv"
                    key={`${key}-${index}`}
                    data-flag={
                      data.securityHeaderNames.includes(key.toLowerCase()) ? 'security' : undefined
                    }
                  >
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
        </>
      ) : null}
    </ToolLayout>
  )
}

function FindingList({ findings }: { findings: Finding[] }) {
  return (
    <div className="check-list">
      {findings.map((finding) => (
        <div className="check" key={finding.id}>
          <span className="check__icon" data-status={finding.status}>
            <Icon name={STATUS_ICON[finding.status]} size={16} />
          </span>
          <div className="check__label">
            {finding.label}
            {finding.header !== finding.label ? (
              <code className="badge badge--solid">{finding.header}</code>
            ) : null}
          </div>
          <div className="check__detail">
            {finding.detail}
            {finding.value ? <code className="check__value">{finding.value}</code> : null}
            {finding.advice ? (
              <span className="check__advice">
                <Icon name="arrow-right-01" size={12} />
                {finding.advice}
              </span>
            ) : null}
            {finding.suggested ? (
              <span className="check__row">
                <CopyButton value={finding.value ?? ''} label="Copy header" />
                {finding.docs ? (
                  <a className="link check__docs" href={finding.docs} target="_blank" rel="noopener noreferrer">
                    Docs
                  </a>
                ) : null}
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
