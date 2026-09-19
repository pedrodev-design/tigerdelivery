import { motion } from 'motion/react'
import styles from './LoadingOverlay.module.css'

export function LoadingOverlay({ label = 'Quase lá', detail = 'Estamos preparando tudo para você.' }) {
  return <motion.div className={styles.overlay} role="status" aria-live="polite" aria-label={`${label}. ${detail}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <motion.span className={styles.loader} initial={{ opacity: 0, scale: .82 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .28, ease: [0.22, 1, 0.36, 1] }}>
      <img src="/tiger.svg" alt="" />
    </motion.span>
  </motion.div>
}
