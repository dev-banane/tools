export function PageProgress({ active }: { active: boolean }) {
  if (!active) return null

  return (
    <div className="page-progress" role="progressbar" aria-valuetext="Loading" aria-busy="true">
      <div className="page-progress__bar" />
    </div>
  )
}
