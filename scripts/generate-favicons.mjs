/** Rasterize public/avatar.jpg into favicon.svg + PNG favicons + manifest icons. Run: npm run favicons */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'public/avatar.jpg'))

async function circleIcon(size) {
  const square = await sharp(source).rotate().resize(size, size, { fit: 'cover' }).toBuffer()
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  )

  return sharp(square)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

const svgIcon = await circleIcon(256)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><image width="256" height="256" href="data:image/png;base64,${svgIcon.toString('base64')}"/></svg>`

const jobs = [
  ['public/favicon.svg', Promise.resolve(Buffer.from(svg))],
  ['public/favicon.png', circleIcon(32)],
  ['public/icon-192.png', circleIcon(192)],
  ['public/icon-512.png', circleIcon(512)],
  ['public/apple-touch-icon.png', circleIcon(180)],
]

for (const [path, job] of jobs) {
  writeFileSync(join(root, path), await job)
  console.log(`Wrote ${path}`)
}
