const SITE_URL = 'https://tools.devjakob.com'

function setMeta(selector: string, attr: string, content: string) {
  document.querySelector(selector)?.setAttribute(attr, content)
}

export function setPageMeta({
  title,
  description,
  path = '/',
}: {
  title: string
  description: string
  path?: string
}) {
  document.title = title
  const url = `${SITE_URL}${path}`

  setMeta('meta[name="description"]', 'content', description)
  setMeta('link[rel="canonical"]', 'href', url)
  setMeta('meta[property="og:title"]', 'content', title)
  setMeta('meta[property="og:description"]', 'content', description)
  setMeta('meta[property="og:url"]', 'content', url)
  setMeta('meta[name="twitter:title"]', 'content', title)
  setMeta('meta[name="twitter:description"]', 'content', description)
}
