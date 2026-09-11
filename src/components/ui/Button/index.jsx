import styles from './Button.module.css'

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
        <span className={styles.spinner} aria-label="Carregando..." />
      ) : (
        children
      )}
    </button>
  )
}
