import { useEffect, useState } from 'react'
import { requireTool } from '../../data/tools'
import { apiGet } from '../../lib/api'
import { useAsyncTask } from '../../lib/useAsyncTask'
import { ToolLayout } from '../../components/ui/ToolLayout'
import { QueryBar } from '../../components/ui/QueryBar'
import { Chip } from '../../components/ui/Controls'
import { Hero, Panel, Rows, SkeletonRows } from '../../components/ui/Panel'
import { Banner } from '../../components/ui/Banner'
import { Button } from '../../components/ui/Button'
import { CopyButton } from '../../components/ui/Copy'
import { ExtLink } from '../../components/ui/ExtLink'
import { TileMap } from '../../components/ui/TileMap'
import { Icon } from '../../components/Icon'
import { Flag } from '../../components/Flag'

const tool = requireTool('ip-tracker')
const RECENT_KEY = 'tools:ip:recent'
const RECENT_LIMIT = 6

type GeoData = {
  ip: string
  version: 'IPv4' | 'IPv6'
  hostname: string | null
  city: string | null
  region: string | null
  postal: string | null
  country: string | null
  countryCode: string | null
  continent: string | null
  isEu: boolean | null
  capital: string | null
  callingCode: string | null
  lat: number | null
  lon: number | null
  timezone: string | null
  utcOffset: number | null
  isp: string | null
  org: string | null
  asn: string | null
  asnName: string | null
  domain: string | null
  isVisitor: boolean
  colo: string | null
  sources: string[]
}

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? (JSON.parse(raw) as string[]).slice(0, RECENT_LIMIT) : []
  } catch {
    return []
  }
}

function formatOffset(seconds: number): string {
  const sign = seconds < 0 ? '-' : '+'
  const total = Math.abs(seconds) / 60
  const hours = Math.floor(total / 60)
  const minutes = Math.round(total % 60)
  return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`
}

function useLocalTime(timezone: string | null) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  if (!timezone) return null
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
    }).format(now)
  } catch {
    return null
  }
}

export function IpTrackerTool() {
  const [query, setQuery] = useState('')
  const [recent, setRecent] = useState<string[]>(readRecent)

  const task = useAsyncTask((value: string) =>
    apiGet<GeoData>('/api/ip', value.trim() ? { q: value.trim() } : undefined),
  )
  const { run } = task

  useEffect(() => {
    void run('')
  }, [run])

  function lookup(value: string) {
    setQuery(value)
    void run(value).then((result) => {
      if (!result || !value.trim()) return
      setRecent((prev) => {
        const next = [value.trim(), ...prev.filter((item) => item !== value.trim())].slice(
          0,
          RECENT_LIMIT,
        )
        try {
          localStorage.setItem(RECENT_KEY, JSON.stringify(next))
        } catch {
        }
        return next
      })
    })
  }

  const data = task.data
  const localTime = useLocalTime(data?.timezone ?? null)

  const location = data
    ? [data.city, data.region, data.country].filter(Boolean).join(', ') || 'Unknown'
    : ''

  return (
    <ToolLayout
      tool={tool}
      loading={task.loading}
      controls={
        <div className="stack">
          <QueryBar
            value={query}
            onChange={setQuery}
            onSubmit={() => lookup(query)}
            placeholder="1.1.1.1, 2606:4700::1111 or example.com"
            icon="location-01"
            submitLabel="Look up"
            loading={task.loading}
            aria-label="IP address or hostname"
          >
            <Button
              variant="quiet"
              onClick={() => {
                setQuery('')
                void run('')
              }}
            >
              <Icon name="wifi-01" size={15} />
              My IP
            </Button>
          </QueryBar>

          {recent.length ? (
            <div className="options-row">
              {recent.map((item) => (
                <Chip key={item} onClick={() => lookup(item)}>
                  {item}
                </Chip>
              ))}
            </div>
          ) : null}
        </div>
      }
    >
      {task.error ? <Banner tone="error">{task.error}</Banner> : null}

      {task.loading ? (
        <Panel>
          <SkeletonRows count={7} />
        </Panel>
      ) : null}

      {!task.loading && data ? (
        <>
          <Hero
            label={data.isVisitor ? 'Your IP address' : (data.hostname ?? 'IP address')}
            value={data.ip}
            tags={
              <>
                <span className="badge badge--solid">{data.version}</span>
                {data.country ? (
                  <span className="badge badge--solid">
                    <Flag code={data.countryCode} name={data.country} />
                    {data.country}
                  </span>
                ) : null}
                {data.asn ? <span className="badge badge--solid">{data.asn}</span> : null}
                {data.isEu ? <span className="badge badge--solid">EU</span> : null}
                {data.colo ? <span className="badge badge--solid">via {data.colo}</span> : null}
              </>
            }
            aside={<CopyButton value={data.ip} label="Copy" variant="social" />}
          />

          {data.lat != null && data.lon != null ? (
            <Panel
              title={location}
              actions={<CopyButton value={`${data.lat}, ${data.lon}`} label="Coordinates" />}
            >
              <TileMap lat={data.lat} lon={data.lon} label={`Map of ${location}`} />
            </Panel>
          ) : null}

          <Panel title="Network">
            <Rows
              rows={[
                { label: 'Location', value: location },
                data.postal ? { label: 'Postal code', value: data.postal } : null,
                data.lat != null && data.lon != null
                  ? { label: 'Coordinates', value: `${data.lat}, ${data.lon}` }
                  : null,
                data.isp ? { label: 'ISP', value: data.isp } : null,
                data.org && data.org !== data.isp
                  ? { label: 'Organisation', value: data.org }
                  : null,
                data.asnName ? { label: 'AS name', value: data.asnName } : null,
                data.domain ? {
                  label: 'Network domain',
                  value: <ExtLink>{data.domain}</ExtLink>,
                } : null,
                data.hostname ? {
                  label: 'Resolved from',
                  value: <ExtLink>{data.hostname}</ExtLink>,
                } : null,
              ].filter((row) => row !== null)}
            />
          </Panel>

          {data.country ? (
            <Panel
              title={
                <span className="cell">
                  <Flag code={data.countryCode} name={data.country} />
                  {data.country}
                </span>
              }
            >
              <Rows
                rows={[
                  data.capital ? { label: 'Capital', value: data.capital } : null,
                  data.continent
                    ? {
                        label: 'Continent',
                        value: data.isEu ? (
                          <>
                            {data.continent}
                            <span className="badge badge--solid">EU</span>
                          </>
                        ) : (
                          data.continent
                        ),
                      }
                    : null,
                  data.callingCode ? { label: 'Dial code', value: `+${data.callingCode}` } : null,
                  data.timezone
                    ? {
                        label: 'Timezone',
                        value: (
                          <>
                            {data.timezone}
                            {data.utcOffset != null ? (
                              <span className="badge badge--solid num">
                                {formatOffset(data.utcOffset)}
                              </span>
                            ) : null}
                            {localTime ? (
                              <span className="badge badge--solid num">{localTime}</span>
                            ) : null}
                          </>
                        ),
                      }
                    : null,
                ].filter((row) => row !== null)}
              />
            </Panel>
          ) : null}
        </>
      ) : null}
    </ToolLayout>
  )
}
