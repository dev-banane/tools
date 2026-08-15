import { Icon } from '../Icon'
import { useToast } from '../../lib/toast'

export function Toaster() {
  const toast = useToast()
  if (!toast) return null

  return (
    <div className="toast" role="status" aria-live="polite" key={toast.id}>
      <Icon name="checkmark-circle-02" size={15} className="toast__icon" />
      {toast.message}
    </div>
  )
}
