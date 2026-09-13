import styles from './Button.module.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faCircleNotch } from '@fortawesome/free-solid-svg-icons'

/**
 * Botão reutilizável com suporte a variantes e estado de carregamento
 *
 * @param {'primary' | 'secondary' | 'ghost'} variant
 * @param {boolean} loading
 * @param {boolean} fullWidth
 */
export function Button({
  children,
  variant = 'primary',
  loading = false,
  loadingLabel = 'Carregando',
  success = false,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}) {
  const classes = [
    styles.button,
    styles[variant],
    fullWidth ? styles.fullWidth : '',
    loading ? styles.loading : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className={styles.loadingContent} role="status" aria-live="polite">
          <FontAwesomeIcon className={success ? styles.successIcon : styles.spinner} icon={success ? faCircleCheck : faCircleNotch} aria-hidden="true" />
          <span>{loadingLabel}</span>
        </span>
      ) : (
        children
      )}
    </button>
  )
}
