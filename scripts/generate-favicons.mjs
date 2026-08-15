/** Rasterize public/avatar.jpg into favicon.svg + PNG favicons + manifest icons. Run: npm run favicons */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'public/avatar.jpg'))

const BRAND_BG = '#0f0f0f'

async function squareCrop(size) {
  return sharp(source).rotate().resize(size, size, { fit: 'cover' }).png().toBuffer()
}

async function square(size, { padded = false } = {}) {
  if (!padded) return squareCrop(size)

  const inner = Math.round(size * 0.86)
  const icon = await squareCrop(inner)

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_BG,
    },
  })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toBuffer()
}

const svgIcon = await squareCrop(256)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><image width="256" height="256" href="data:image/png;base64,${svgIcon.toString('base64')}"/></svg>`

const jobs = [
  ['public/favicon.svg', Promise.resolve(Buffer.from(svg))],
  ['public/favicon.png', square(32)],
  ['public/icon-192.png', square(192)],
  ['public/icon-512.png', square(512)],
  ['public/apple-touch-icon.png', square(180, { padded: true })],
]

for (const [path, job] of jobs) {
  writeFileSync(join(root, path), await job)
  console.log(`Wrote ${path}`)
}
