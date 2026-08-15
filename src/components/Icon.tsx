import { HUGEICONS, type IconName } from '../lib/hugeicons'

type IconProps = {
  name: IconName
  size?: number
  className?: string
  title?: string
}

export function Icon({ name, size = 24, className, title }: IconProps) {
  const icon = HUGEICONS[name]

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={`0 0 ${icon.width} ${icon.height}`}
      className={className}
      data-icon={name}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  )
}
