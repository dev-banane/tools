export const RECORD_TYPES = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  PTR: 12,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  SRV: 33,
  CAA: 257,
} as const

export type RecordType = keyof typeof RECORD_TYPES

export const RCODE_TEXT: Record<number, string> = {
  0: 'NOERROR',
  1: 'FORMERR',
  2: 'SERVFAIL',
  3: 'NXDOMAIN',
  4: 'NOTIMP',
  5: 'REFUSED',
}

export type WireAnswer = {
  name: string
  type: number
  ttl: number
  data: string
}

export function encodeQuery(name: string, type: RecordType): Uint8Array {
  const labels = name.replace(/\.$/, '').split('.')
  const encoder = new TextEncoder()
  const encoded = labels.map((label) => encoder.encode(label))

  for (const label of encoded) {
    if (label.length === 0 || label.length > 63) throw new Error('Invalid hostname label')
  }

  const qnameLength = encoded.reduce((sum, label) => sum + label.length + 1, 1)
  const buf = new Uint8Array(12 + qnameLength + 4)
  const view = new DataView(buf.buffer)

  // ID stays 0 so identical queries are cacheable by intermediaries.
  view.setUint16(0, 0)
  view.setUint16(2, 0x0100)
  view.setUint16(4, 1)

  let offset = 12
  for (const label of encoded) {
    buf[offset++] = label.length
    buf.set(label, offset)
    offset += label.length
  }
  buf[offset++] = 0

  view.setUint16(offset, RECORD_TYPES[type])
  offset += 2
  view.setUint16(offset, 1)
  return buf
}

function readName(buf: Uint8Array, start: number): [string, number] {
  const parts: string[] = []
  let pos = start
  let after = start
  let jumped = false
  let guard = 0

  while (guard++ < 128) {
    if (pos >= buf.length) break
    const len = buf[pos]!

    if (len === 0) {
      pos += 1
      if (!jumped) after = pos
      break
    }

    if ((len & 0xc0) === 0xc0) {
      const pointer = ((len & 0x3f) << 8) | buf[pos + 1]!
      if (!jumped) after = pos + 2
      jumped = true
      pos = pointer
      continue
    }

    pos += 1
    parts.push(asciiOf(buf.subarray(pos, pos + len)))
    pos += len
    if (!jumped) after = pos
  }

  return [parts.join('.'), after]
}

function asciiOf(bytes: Uint8Array): string {
  let out = ''
  for (const byte of bytes) out += String.fromCharCode(byte)
  return out
}

function formatIpv4(bytes: Uint8Array): string {
  return Array.from(bytes.subarray(0, 4)).join('.')
}

export function formatIpv6(bytes: Uint8Array): string {
  const groups: number[] = []
  for (let i = 0; i < 16; i += 2) groups.push((bytes[i]! << 8) | bytes[i + 1]!)

  let bestStart = -1
  let bestLength = 0
  let runStart = -1
  for (let i = 0; i <= groups.length; i++) {
    if (i < groups.length && groups[i] === 0) {
      if (runStart < 0) runStart = i
    } else if (runStart >= 0) {
      const length = i - runStart
      if (length > bestLength) {
        bestLength = length
        bestStart = runStart
      }
      runStart = -1
    }
  }

  const hex = groups.map((g) => g.toString(16))
  if (bestLength < 2) return hex.join(':')

  const head = hex.slice(0, bestStart).join(':')
  const tail = hex.slice(bestStart + bestLength).join(':')
  return `${head}::${tail}`
}

function formatRdata(
  buf: Uint8Array,
  view: DataView,
  offset: number,
  length: number,
  type: number,
): string {
  switch (type) {
    case RECORD_TYPES.A:
      return formatIpv4(buf.subarray(offset, offset + length))

    case RECORD_TYPES.AAAA:
      return formatIpv6(buf.subarray(offset, offset + length))

    case RECORD_TYPES.NS:
    case RECORD_TYPES.CNAME:
    case RECORD_TYPES.PTR:
      return readName(buf, offset)[0]

    case RECORD_TYPES.MX: {
      const preference = view.getUint16(offset)
      return `${preference} ${readName(buf, offset + 2)[0]}`
    }

    case RECORD_TYPES.TXT: {
      let pos = offset
      const end = offset + length
      let text = ''
      while (pos < end) {
        const chunk = buf[pos]!
        pos += 1
        text += asciiOf(buf.subarray(pos, pos + chunk))
        pos += chunk
      }
      return text
    }

    case RECORD_TYPES.SOA: {
      const [mname, afterM] = readName(buf, offset)
      const [rname, afterR] = readName(buf, afterM)
      const serial = view.getUint32(afterR)
      const refresh = view.getUint32(afterR + 4)
      const retry = view.getUint32(afterR + 8)
      const expire = view.getUint32(afterR + 12)
      const minimum = view.getUint32(afterR + 16)
      return `${mname} ${rname} ${serial} ${refresh} ${retry} ${expire} ${minimum}`
    }

    case RECORD_TYPES.SRV: {
      const priority = view.getUint16(offset)
      const weight = view.getUint16(offset + 2)
      const port = view.getUint16(offset + 4)
      return `${priority} ${weight} ${port} ${readName(buf, offset + 6)[0]}`
    }

    case RECORD_TYPES.CAA: {
      const flags = buf[offset]!
      const tagLength = buf[offset + 1]!
      const tag = asciiOf(buf.subarray(offset + 2, offset + 2 + tagLength))
      const value = asciiOf(buf.subarray(offset + 2 + tagLength, offset + length))
      return `${flags} ${tag} "${value}"`
    }

    default:
      return Array.from(buf.subarray(offset, offset + length), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join('')
  }
}

export function decodeResponse(buf: Uint8Array): { rcode: number; answers: WireAnswer[] } {
  if (buf.length < 12) throw new Error('Truncated DNS response')

  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const rcode = view.getUint16(2) & 0x0f
  const questionCount = view.getUint16(4)
  const answerCount = view.getUint16(6)

  let offset = 12
  for (let i = 0; i < questionCount; i++) {
    offset = readName(buf, offset)[1] + 4
  }

  const answers: WireAnswer[] = []
  for (let i = 0; i < answerCount; i++) {
    if (offset + 10 > buf.length) break
    const [name, afterName] = readName(buf, offset)
    offset = afterName

    const type = view.getUint16(offset)
    const ttl = view.getUint32(offset + 4)
    const rdLength = view.getUint16(offset + 8)
    offset += 10

    if (offset + rdLength > buf.length) break
    answers.push({ name, type, ttl, data: formatRdata(buf, view, offset, rdLength, type) })
    offset += rdLength
  }

  return { rcode, answers }
}
