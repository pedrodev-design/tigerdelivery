import styles from './Logo.module.css'

export function Logo({ size = 'md' }) {
  return (
    <div className={`${styles.logo} ${styles[size]}`} aria-label="TigreFood">
      <img className={styles.icon} src="/tiger.svg" alt="" width="84" height="84" />
      <span className={styles.text}><span>Tigre</span><span className={styles.suffix}>Food</span></span>
    </div>
  )
}

