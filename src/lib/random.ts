import { WORDLIST, WORDLIST_BITS } from './wordlist'

export const CHARSETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?/~',
  hex: '0123456789abcdef',
  hexUpper: '0123456789ABCDEF',
  base58: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
  alnum: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
} as const

export const AMBIGUOUS = 'Il1O0oB8S5Z2G6|`\'";:,.'

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

export function randomInt(max: number): number {
  if (max <= 0) throw new Error('max must be positive')
  if (max === 1) return 0

  const range = 2 ** 32
  const limit = range - (range % max)
  const buf = new Uint32Array(1)

  for (;;) {
    crypto.getRandomValues(buf)
    const value = buf[0]!
    if (value < limit) return value % max
  }
}

export function randomString(length: number, alphabet: string): string {
  if (!alphabet.length) throw new Error('alphabet is empty')
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)]
  return out
}

export function toHex(bytes: Uint8Array, upper = false): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return upper ? hex.toUpperCase() : hex
}

export function toBase64(bytes: Uint8Array, urlSafe = false): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const encoded = btoa(binary)
  if (!urlSafe) return encoded
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function uuidV4(): string {
  const bytes = randomBytes(16)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  return formatUuid(bytes)
}

export function uuidV7(): string {
  const bytes = randomBytes(16)
  const now = Date.now()

  bytes[0] = (now / 2 ** 40) & 0xff
  bytes[1] = (now / 2 ** 32) & 0xff
  bytes[2] = (now / 2 ** 24) & 0xff
  bytes[3] = (now / 2 ** 16) & 0xff
  bytes[4] = (now / 2 ** 8) & 0xff
  bytes[5] = now & 0xff

  bytes[6] = (bytes[6]! & 0x0f) | 0x70
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  return formatUuid(bytes)
}

function formatUuid(bytes: Uint8Array): string {
  const hex = toHex(bytes)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const NANOID_ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict'

export function nanoid(size = 21): string {
  return randomString(size, NANOID_ALPHABET)
}

export type PassphraseOptions = {
  words?: number
  separator?: string
  capitalize?: boolean
  appendNumber?: boolean
}

export function passphrase({
  words = 5,
  separator = '-',
  capitalize = false,
  appendNumber = false,
}: PassphraseOptions = {}): string {
  const picked = Array.from({ length: words }, () => {
    const word = WORDLIST[randomInt(WORDLIST.length)]!
    return capitalize ? word[0]!.toUpperCase() + word.slice(1) : word
  })
  if (appendNumber) picked.push(String(randomInt(100)).padStart(2, '0'))
  return picked.join(separator)
}

export function passphraseBits(words: number, appendNumber = false): number {
  return words * WORDLIST_BITS + (appendNumber ? Math.log2(100) : 0)
}

export function buildAlphabet(options: {
  lower?: boolean
  upper?: boolean
  digits?: boolean
  symbols?: boolean
  excludeAmbiguous?: boolean
}): string {
  let alphabet = ''
  if (options.lower) alphabet += CHARSETS.lower
  if (options.upper) alphabet += CHARSETS.upper
  if (options.digits) alphabet += CHARSETS.digits
  if (options.symbols) alphabet += CHARSETS.symbols
  if (options.excludeAmbiguous) {
    alphabet = [...alphabet].filter((c) => !AMBIGUOUS.includes(c)).join('')
  }
  return alphabet
}

export function entropyBits(alphabetSize: number, length: number): number {
  if (alphabetSize <= 1 || length <= 0) return 0
  return Math.log2(alphabetSize) * length
}

export type StrengthLevel = 'weak' | 'fair' | 'strong' | 'insane'

export function strengthOf(bits: number): { level: StrengthLevel; label: string } {
  if (bits < 50) return { level: 'weak', label: 'Weak' }
  if (bits < 75) return { level: 'fair', label: 'Reasonable' }
  if (bits < 120) return { level: 'strong', label: 'Strong' }
  return { level: 'insane', label: 'Overkill' }
}

const TIME_UNITS: Array<[number, string]> = [
  [60, 'seconds'],
  [60, 'minutes'],
  [24, 'hours'],
  [365, 'days'],
  [1000, 'years'],
  [1000, 'millennia'],
]

export function crackTime(bits: number): string {
  const guessesPerSecond = 1e11
  let seconds = 2 ** (bits - 1) / guessesPerSecond

  if (seconds < 1) return 'instantly'

  let unit = 'seconds'
  for (const [factor, nextUnit] of TIME_UNITS) {
    if (seconds < factor) break
    seconds /= factor
    unit = nextUnit
  }

  if (unit === 'millennia' && seconds > 1e6) return 'longer than the universe has existed'
  return `about ${formatCompact(seconds)} ${unit}`
}

function formatCompact(value: number): string {
  if (value >= 1000) return value.toExponential(1).replace('e+', '×10^')
  if (value >= 100) return Math.round(value).toString()
  if (value >= 10) return value.toFixed(0)
  return value.toFixed(1)
}
