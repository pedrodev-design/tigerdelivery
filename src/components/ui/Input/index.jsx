import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons'
import styles from './Input.module.css'

/**
 * Campo de input reutilizável com suporte a ícone, erro e toggle de senha
 *
 * @param {string}  label       - Rótulo do campo
 * @param {string}  error       - Mensagem de erro
 * @param {React.ReactNode} icon - Ícone à esquerda
 * @param {'text'|'email'|'password'} type
 */
export function Input({
  label,
  hideLabel = false,
  error,
  hint,
  valid = false,
  icon,
  type = 'text',
  id,
  className = '',
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

  return (
    <div className={`${styles.wrapper} ${className}`}>
      {label && (
        <label htmlFor={id} className={hideLabel ? styles.hiddenLabel : styles.label}>
          {label}
        </label>
      )}

      <div className={`${styles.inputWrapper} ${error ? styles.hasError : ''} ${valid ? styles.isValid : ''}`}>
        {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}

        <input
          id={id}
          type={inputType}
          className={styles.input}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...props}
        />

        {valid && <span className={styles.validIcon} aria-label="Campo preenchido corretamente"><FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" /></span>}

        {isPassword && (
          <button
            type="button"
            className={styles.eyeBtn}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={showPassword}
          >
            <FontAwesomeIcon icon={showPassword ? faEye : faEyeSlash} aria-hidden="true" />
          </button>
        )}
      </div>

      {error && (
        <span id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </span>
      )}
      {!error && hint && <span id={`${id}-hint`} className={styles.hint}>{hint}</span>}
    </div>
  )
}
