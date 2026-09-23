import styles from './OrderIdentity.module.css'

export function OrderIdentity({ name, photo, label, compact = false }) {
  const displayName = name || label
  return <span className={`${styles.identity} ${compact ? styles.compact : ''}`}>
    <span className={styles.avatar}>{photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : <span aria-hidden="true">{displayName?.charAt(0)?.toLocaleUpperCase('pt-BR') || '?'}</span>}</span>
    <span className={styles.copy}><small>{label}</small><strong>{displayName}</strong></span>
  </span>
}
