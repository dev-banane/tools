const CLOUDFLARE_V4 = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
]

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null

  let value = 0
  for (const part of parts) {
    const octet = Number(part)
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null
    value = (value << 8) | octet
  }
  return value >>> 0
}

const CLOUDFLARE_RANGES = CLOUDFLARE_V4.map((cidr) => {
  const [network, bits] = cidr.split('/')
  const base = ipv4ToInt(network!)!
  const mask = bits === '0' ? 0 : (0xffffffff << (32 - Number(bits))) >>> 0
  return { base: (base & mask) >>> 0, mask }
})

export function isCloudflareIp(ip: string): boolean {
  const value = ipv4ToInt(ip)
  if (value == null) return false
  return CLOUDFLARE_RANGES.some((range) => ((value & range.mask) >>> 0) === range.base)
}

const CNAME_PROVIDERS: Array<[string, string]> = [
  ['.cloudfront.net', 'CloudFront'],
  ['.elb.amazonaws.com', 'AWS ELB'],
  ['.s3.amazonaws.com', 'AWS S3'],
  ['.s3-website', 'AWS S3'],
  ['.vercel-dns.com', 'Vercel'],
  ['.vercel.app', 'Vercel'],
  ['.netlify.app', 'Netlify'],
  ['.netlify.com', 'Netlify'],
  ['.github.io', 'GitHub Pages'],
  ['.herokudns.com', 'Heroku'],
  ['.herokuapp.com', 'Heroku'],
  ['.azurewebsites.net', 'Azure'],
  ['.azureedge.net', 'Azure CDN'],
  ['.trafficmanager.net', 'Azure'],
  ['.fastly.net', 'Fastly'],
  ['.fastlylb.net', 'Fastly'],
  ['.pages.dev', 'Cloudflare Pages'],
  ['.workers.dev', 'Cloudflare Workers'],
  ['.cdn.cloudflare.net', 'Cloudflare'],
  ['.ghs.googlehosted.com', 'Google'],
  ['.googleusercontent.com', 'Google'],
  ['.akamaiedge.net', 'Akamai'],
  ['.akamai.net', 'Akamai'],
  ['.edgekey.net', 'Akamai'],
  ['.myshopify.com', 'Shopify'],
  ['.shops.myshopify.com', 'Shopify'],
  ['.wpengine.com', 'WP Engine'],
  ['.wixdns.net', 'Wix'],
  ['.squarespace.com', 'Squarespace'],
  ['.fly.dev', 'Fly.io'],
  ['.render.com', 'Render'],
  ['.railway.app', 'Railway'],
  ['.sendgrid.net', 'SendGrid'],
  ['.zendesk.com', 'Zendesk'],
  ['.hubspot.net', 'HubSpot'],
  ['.statuspage.io', 'Statuspage'],
  ['.readthedocs.io', 'Read the Docs'],
  ['.b-cdn.net', 'BunnyCDN'],
  ['.stackpathdns.com', 'StackPath'],
]

export function providerFromCname(cname: string | null): string | null {
  if (!cname) return null
  const name = cname.toLowerCase().replace(/\.$/, '')
  for (const [suffix, provider] of CNAME_PROVIDERS) {
    if (name.endsWith(suffix) || name.includes(suffix)) return provider
  }
  return null
}
