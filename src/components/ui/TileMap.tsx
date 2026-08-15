import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { Button } from './Button'
import { Icon } from '../Icon'

const TILE = 256
const MIN_ZOOM = 2
const MAX_ZOOM = 18

type TileMapProps = {
  lat: number
  lon: number
  zoom?: number
  label?: string
}

function project(lat: number, lon: number, zoom: number) {
  const tiles = 2 ** zoom
  const latRad = (lat * Math.PI) / 180
  return {
    x: ((lon + 180) / 360) * tiles * TILE,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * tiles * TILE,
    tiles,
    world: tiles * TILE,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function TileMap({ lat, lon, zoom: initialZoom = 5, label }: TileMapProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(() => clamp(initialZoom, MIN_ZOOM, MAX_ZOOM))
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ id: number; sx: number; sy: number; px: number; py: number } | null>(null)
  const view = useRef({ zoom, pan, lat, lon, w: 0, h: 0 })
  view.current = { zoom, pan, lat, lon, w: size.w, h: size.h }

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return

    const measure = () => setSize({ w: node.clientWidth, h: node.clientHeight })
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = node.getBoundingClientRect()
      const anchorX = event.clientX - rect.left - rect.width / 2
      const anchorY = event.clientY - rect.top - rect.height / 2
      zoomAt(view.current.zoom + (event.deltaY < 0 ? 1 : -1), anchorX, anchorY)
    }

    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    setPan({ x: 0, y: 0 })
  }, [lat, lon])

  const { x: pinX, y: pinY, tiles, world } = project(lat, lon, zoom)
  const { w, h } = size

  const viewX = pinX - pan.x
  const viewY = clamp(pinY - pan.y, h / 2, Math.max(h / 2, world - h / 2))

  const left = viewX - w / 2
  const top = viewY - h / 2

  const cells = []
  if (w > 0 && h > 0) {
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + h) / TILE); ty++) {
      if (ty < 0 || ty >= tiles) continue
      for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + w) / TILE); tx++) {
        const wrapped = ((tx % tiles) + tiles) % tiles
        cells.push(
          <img
            className="map__tile"
            key={`${tx}-${ty}`}
            src={`/api/tile?z=${zoom}&x=${wrapped}&y=${ty}`}
            alt=""
            width={TILE}
            height={TILE}
            draggable={false}
            decoding="async"
            style={{ left: tx * TILE - left, top: ty * TILE - top }}
          />,
        )
      }
    }
  }

  function zoomAt(nextZoom: number, anchorX: number, anchorY: number) {
    const prev = view.current
    const z = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
    if (z === prev.zoom) return

    const scale = 2 ** (z - prev.zoom)
    const oldPin = project(prev.lat, prev.lon, prev.zoom)
    const newPin = project(prev.lat, prev.lon, z)
    const oldViewX = oldPin.x - prev.pan.x
    const oldViewY = clamp(
      oldPin.y - prev.pan.y,
      prev.h / 2,
      Math.max(prev.h / 2, oldPin.world - prev.h / 2),
    )
    const worldX = (oldViewX + anchorX) * scale
    const worldY = (oldViewY + anchorY) * scale

    setZoom(z)
    setPan({
      x: newPin.x - (worldX - anchorX),
      y: newPin.y - (worldY - anchorY),
    })
  }

  function zoomBy(delta: number) {
    zoomAt(view.current.zoom + delta, 0, 0)
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      id: event.pointerId,
      sx: event.clientX,
      sy: event.clientY,
      px: pan.x,
      py: pan.y,
    }
    setDragging(true)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current
    if (!start || start.id !== event.pointerId) return
    setPan({
      x: start.px + (event.clientX - start.sx),
      y: start.py + (event.clientY - start.sy),
    })
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    drag.current = null
    setDragging(false)
  }

  return (
    <div
      className="map"
      ref={ref}
      role="img"
      aria-label={label ?? `Map centred on ${lat}, ${lon}`}
      data-dragging={dragging ? 'true' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="map__canvas">{cells}</div>
      <span className="map__pin" style={{ left: pinX - left, top: pinY - top }} />
      <div className="map__fade" aria-hidden="true" />
      <div className="map__zoom">
        <Button
          variant="social"
          size="sm"
          iconOnly
          aria-label="Zoom in"
          disabled={zoom >= MAX_ZOOM}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => zoomBy(1)}
        >
          <Icon name="plus-sign" size={14} />
        </Button>
        <Button
          variant="social"
          size="sm"
          iconOnly
          aria-label="Zoom out"
          disabled={zoom <= MIN_ZOOM}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => zoomBy(-1)}
        >
          <Icon name="minus-sign" size={14} />
        </Button>
      </div>
      <span className="map__attribution">© OpenStreetMap contributors</span>
    </div>
  )
}
