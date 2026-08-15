import { useCallback, useEffect, useMemo, useState } from 'react'
import { requireTool } from '../../data/tools'
import { ToolLayout } from '../../components/ui/ToolLayout'
import { Panel, Split } from '../../components/ui/Panel'
import { Button } from '../../components/ui/Button'
import { CopyButton, KeyRow } from '../../components/ui/Copy'
import { Range, Segmented, Toggle } from '../../components/ui/Controls'
import { Dropdown } from '../../components/ui/Dropdown'
import { Icon } from '../../components/Icon'
import {
  CHARSETS,
  buildAlphabet,
  crackTime,
  entropyBits,
  nanoid,
  passphrase,
  passphraseBits,
  randomBytes,
  randomString,
  strengthOf,
  toBase64,
  toHex,
  uuidV4,
  uuidV7,
} from '../../lib/random'

const tool = requireTool('random')

const PRINTABLE = CHARSETS.alnum + CHARSETS.symbols

type Tier = {
  id: string
  title: string
  count: number
  bits: number
  generate: () => string
}

const TIERS: Tier[] = [
  {
    id: 'memorable',
    title: 'Memorable passwords',
    count: 5,
    bits: passphraseBits(4, true),
    generate: () => passphrase({ words: 4, capitalize: true, appendNumber: true }),
  },
  {
    id: 'strong',
    title: 'Strong passwords',
    count: 5,
    bits: entropyBits(
      buildAlphabet({
        lower: true,
        upper: true,
        digits: true,
        symbols: true,
        excludeAmbiguous: true,
      }).length,
      16,
    ),
    generate: () =>
      randomString(
        16,
        buildAlphabet({
          lower: true,
          upper: true,
          digits: true,
          symbols: true,
          excludeAmbiguous: true,
        }),
      ),
  },
  {
    id: 'fort-knox',
    title: 'Fort Knox passwords',
    count: 5,
    bits: entropyBits(PRINTABLE.length, 32),
    generate: () => randomString(32, PRINTABLE),
  },
  {
    id: 'passphrase',
    title: 'Passphrases',
    count: 5,
    bits: passphraseBits(6),
    generate: () => passphrase({ words: 6 }),
  },
  {
    id: 'encryption-key',
    title: '256-bit encryption keys',
    count: 4,
    bits: 256,
    generate: () => toHex(randomBytes(32)),
  },
  {
    id: 'jwt',
    title: 'JWT / session secrets',
    count: 3,
    bits: 512,
    generate: () => toBase64(randomBytes(64)),
  },
  {
    id: 'api-key',
    title: 'API keys',
    count: 4,
    bits: entropyBits(CHARSETS.base58.length, 32),
    generate: () => `sk_live_${randomString(32, CHARSETS.base58)}`,
  },
  {
    id: 'token',
    title: 'URL-safe tokens',
    count: 4,
    bits: 256,
    generate: () => toBase64(randomBytes(32), true),
  },
  {
    id: 'nanoid',
    title: 'Nano IDs',
    count: 5,
    bits: entropyBits(64, 21),
    generate: () => nanoid(),
  },
  {
    id: 'uuid4',
    title: 'UUID v4',
    count: 5,
    bits: 122,
    generate: uuidV4,
  },
  {
    id: 'uuid7',
    title: 'UUID v7',
    count: 5,
    bits: 74,
    generate: uuidV7,
  },
  {
    id: 'wpa',
    title: '504-bit WPA keys',
    count: 3,
    bits: entropyBits(PRINTABLE.length, 63),
    generate: () => randomString(63, PRINTABLE),
  },
  {
    id: 'wep-256',
    title: '256-bit WEP keys',
    count: 3,
    bits: 256,
    generate: () => toHex(randomBytes(32), true),
  },
  {
    id: 'wep-128',
    title: '128-bit WEP keys',
    count: 3,
    bits: 104,
    generate: () => randomString(26, CHARSETS.hexUpper),
  },
]

function generateTier(tier: Tier): string[] {
  return Array.from({ length: tier.count }, tier.generate)
}

function generateAll(): Record<string, string[]> {
  return Object.fromEntries(TIERS.map((tier) => [tier.id, generateTier(tier)]))
}

function formatBits(bits: number): string {
  return `${Math.round(bits)} bits`
}

type CustomMode = 'password' | 'passphrase' | 'bytes'

const CUSTOM_MODES = [
  { id: 'password' as const, label: 'Password' },
  { id: 'passphrase' as const, label: 'Passphrase' },
  { id: 'bytes' as const, label: 'Random bytes' },
]

const ENCODINGS = [
  { id: 'hex' as const, label: 'Hex' },
  { id: 'base64' as const, label: 'Base64' },
  { id: 'base64url' as const, label: 'Base64url' },
]

const SEPARATORS = [
  { id: '-', label: 'hyphen' },
  { id: '.', label: 'dot' },
  { id: '_', label: 'underscore' },
  { id: ' ', label: 'space' },
  { id: '', label: 'none' },
]

export function RandomTool() {
  const [batches, setBatches] = useState(generateAll)

  const regenerateTier = useCallback((id: string) => {
    const tier = TIERS.find((t) => t.id === id)
    if (!tier) return
    setBatches((prev) => ({ ...prev, [id]: generateTier(tier) }))
  }, [])

  const regenerateAll = useCallback(() => setBatches(generateAll()), [])

  return (
    <ToolLayout
      tool={tool}
      actions={
        <Button variant="primary" onClick={regenerateAll}>
          <Icon name="refresh" size={15} />
          Regenerate all
        </Button>
      }
    >
      <Split>
        {TIERS.map((tier) => {
          const values = batches[tier.id] ?? []
          const strength = strengthOf(tier.bits)

          return (
            <Panel
              key={tier.id}
              title={tier.title}
              actions={
                <>
                  <span className={`badge badge--${strength.level === 'weak' ? 'warn' : 'pass'}`}>
                    {formatBits(tier.bits)}
                  </span>
                  <CopyButton value={values.join('\n')} />
                  <Button
                    size="sm"
                    variant="quiet"
                    iconOnly
                    onClick={() => regenerateTier(tier.id)}
                    aria-label={`Regenerate ${tier.title}`}
                    title="Regenerate"
                  >
                    <Icon name="refresh" size={13} />
                  </Button>
                </>
              }
            >
              <div className="keylist">
                {values.map((value, index) => (
                  <KeyRow key={`${tier.id}-${index}-${value}`} value={value} />
                ))}
              </div>
            </Panel>
          )
        })}
      </Split>

      <CustomGenerator />
    </ToolLayout>
  )
}

function CustomGenerator() {
  const [mode, setMode] = useState<CustomMode>('password')
  const [length, setLength] = useState(24)
  const [lower, setLower] = useState(true)
  const [upper, setUpper] = useState(true)
  const [digits, setDigits] = useState(true)
  const [symbols, setSymbols] = useState(true)
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false)
  const [words, setWords] = useState(6)
  const [separator, setSeparator] = useState('-')
  const [capitalize, setCapitalize] = useState(false)
  const [appendNumber, setAppendNumber] = useState(false)
  const [byteCount, setByteCount] = useState(32)
  const [encoding, setEncoding] = useState<'hex' | 'base64' | 'base64url'>('hex')

  const alphabet = useMemo(
    () => buildAlphabet({ lower, upper, digits, symbols, excludeAmbiguous }),
    [lower, upper, digits, symbols, excludeAmbiguous],
  )

  const bits = useMemo(() => {
    if (mode === 'password') return entropyBits(alphabet.length, length)
    if (mode === 'passphrase') return passphraseBits(words, appendNumber)
    return byteCount * 8
  }, [mode, alphabet.length, length, words, appendNumber, byteCount])

  const generate = useCallback((): string => {
    if (mode === 'password') {
      if (!alphabet.length) return ''
      return randomString(length, alphabet)
    }
    if (mode === 'passphrase') {
      return passphrase({ words, separator, capitalize, appendNumber })
    }
    const bytes = randomBytes(byteCount)
    if (encoding === 'hex') return toHex(bytes)
    return toBase64(bytes, encoding === 'base64url')
  }, [mode, alphabet, length, words, separator, capitalize, appendNumber, byteCount, encoding])

  const [value, setValue] = useState(generate)
  useEffect(() => setValue(generate()), [generate])

  const strength = strengthOf(bits)
  const noCharset = mode === 'password' && alphabet.length === 0

  return (
    <Panel
      title="Build your own"
      actions={
        <Segmented value={mode} onChange={setMode} options={CUSTOM_MODES} label="Generator mode" />
      }
    >
      <div className="panel__body gen">
        <div className="gen-out">
          <span className="gen-out__value">
            {noCharset ? 'Select at least one character set' : value}
          </span>
          <div className="gen-out__actions">
            <CopyButton value={value} label="Copy" variant="social" />
            <Button variant="primary" size="sm" onClick={() => setValue(generate())}>
              <Icon name="refresh" size={13} />
              Generate
            </Button>
          </div>
        </div>

        <div className="gen-meta">
          <div className="meter meter--flex">
            <div
              className="meter__fill"
              data-level={strength.level}
              style={{ width: `${Math.min(100, (bits / 160) * 100)}%` }}
            />
          </div>
          <span className="badge badge--solid">{strength.label}</span>
          <span className="badge badge--solid num">{formatBits(bits)}</span>
          <span className="badge badge--solid" title="At 100 billion guesses per second">
            <Icon name="clock-01" size={11} />
            {crackTime(bits)}
          </span>
        </div>

        {mode === 'password' ? (
          <>
            <Range label="Length" value={length} onChange={setLength} min={6} max={128} />
            <div className="options-row">
              <Toggle label="a–z" checked={lower} onChange={setLower} />
              <Toggle label="A–Z" checked={upper} onChange={setUpper} />
              <Toggle label="0–9" checked={digits} onChange={setDigits} />
              <Toggle label="Symbols" checked={symbols} onChange={setSymbols} />
              <Toggle
                label="Exclude look-alikes"
                checked={excludeAmbiguous}
                onChange={setExcludeAmbiguous}
              />
            </div>
          </>
        ) : null}

        {mode === 'passphrase' ? (
          <>
            <Range label="Words" value={words} onChange={setWords} min={3} max={12} />
            <div className="options-row">
              <Dropdown
                value={separator}
                onChange={setSeparator}
                options={SEPARATORS}
                label="Separator"
                auto
              />
              <Toggle label="Capitalise" checked={capitalize} onChange={setCapitalize} />
              <Toggle label="Append number" checked={appendNumber} onChange={setAppendNumber} />
            </div>
          </>
        ) : null}

        {mode === 'bytes' ? (
          <>
            <Range label="Bytes" value={byteCount} onChange={setByteCount} min={4} max={256} />
            <div className="options-row">
              <Segmented
                value={encoding}
                onChange={setEncoding}
                options={ENCODINGS}
                label="Encoding"
              />
            </div>
          </>
        ) : null}
      </div>
    </Panel>
  )
}
