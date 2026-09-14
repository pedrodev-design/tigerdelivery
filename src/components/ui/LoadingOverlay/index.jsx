import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons'
import { motion } from 'motion/react'
import styles from './LoadingOverlay.module.css'

export function LoadingOverlay({ label = 'Quase lá', detail = 'Estamos preparando tudo para você.' }) {
  return <motion.div className={styles.overlay} role="status" aria-live="polite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <motion.div className={styles.card} initial={{ opacity: 0, y: 8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .2 }}>
      <span className={styles.icon}><FontAwesomeIcon icon={faCircleNotch} spin aria-hidden="true" /></span>
      <strong>{label}</strong>
      <p>{detail}</p>
    </motion.div>
  </motion.div>
}
