import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUp, faComments, faXmark } from '@fortawesome/free-solid-svg-icons'
import { AnimatePresence, motion } from 'motion/react'
import { supabase } from '../../lib/supabase'
import { playNotificationSound } from '../../services/notifications'
import styles from './OrderChat.module.css'

const Icon = ({ icon }) => <FontAwesomeIcon icon={icon} fixedWidth aria-hidden="true" />

function mergeMessage(current, incoming) {
  if (current.some(message => message.id === incoming.id)) return current
  return [...current, incoming].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
}

export function OrderChat({ orderId, currentUserId, otherLabel, buttonLabel }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [unread, setUnread] = useState(0)
  const openRef = useRef(false)
  const listRef = useRef(null)
  const composerRef = useRef(null)
  const dialogId = `order-chat-${orderId}`

  useEffect(() => { openRef.current = open }, [open])

  const loadMessages = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    const { data, error: queryError } = await supabase
      .from('order_messages')
      .select('id, order_id, sender_id, body, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
      .limit(150)
    if (showLoading) setLoading(false)
    if (queryError) {
      setError('Não foi possível abrir a conversa agora.')
      return
    }
    setMessages(data || [])
    setError('')
  }, [orderId])

  function openChat() {
    openRef.current = true
    setUnread(0)
    void loadMessages()
    setOpen(true)
  }

  function closeChat() {
    openRef.current = false
    setOpen(false)
  }

  useEffect(() => {
    if (!orderId || !currentUserId) return undefined
    const channel = supabase
      .channel(`order-chat-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_messages', filter: `order_id=eq.${orderId}` },
        payload => {
          setMessages(current => mergeMessage(current, payload.new))
          if (payload.new.sender_id !== currentUserId && !openRef.current) {
            setUnread(count => count + 1)
            playNotificationSound()
          }
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [currentUserId, orderId])

  useEffect(() => {
    if (!open) return undefined
    const pollMessages = window.setInterval(() => { void loadMessages(false) }, 7000)
    const focusComposer = window.setTimeout(() => composerRef.current?.focus(), 260)
    return () => {
      window.clearInterval(pollMessages)
      window.clearTimeout(focusComposer)
    }
  }, [loadMessages, open])

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }))
  }, [messages, open])

  useEffect(() => {
    if (!open) return undefined
    const close = event => { if (event.key === 'Escape') closeChat() }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', close)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', close)
    }
  }, [open])

  async function sendMessage(event) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setError('')
    const { data, error: insertError } = await supabase
      .from('order_messages')
      .insert({ order_id: orderId, sender_id: currentUserId, body })
      .select('id, order_id, sender_id, body, created_at')
      .single()
    setSending(false)
    if (insertError) {
      setError('A mensagem não foi enviada. Tente novamente.')
      return
    }
    setDraft('')
    setMessages(current => mergeMessage(current, data))
  }

  const dialog = createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="order-chat-dialog" className={styles.backdrop} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={event => { if (event.target === event.currentTarget) closeChat() }}>
          <motion.section id={dialogId} className={styles.panel} role="dialog" aria-modal="true" aria-label={`Conversa com ${otherLabel}`} initial={{ opacity: 0, y: 22, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: .98 }} transition={{ duration: .22, ease: [0.22, 1, 0.36, 1] }}>
            <header className={styles.header}>
              <span className={styles.avatar}><Icon icon={faComments} /></span>
              <div><small>Pedido #{orderId.slice(0, 6).toUpperCase()}</small><strong>{otherLabel}</strong><p>Conversa protegida pelo TigreDelivery</p></div>
              <button type="button" onClick={closeChat} aria-label="Fechar conversa"><Icon icon={faXmark} /></button>
            </header>
            <div className={styles.messages} ref={listRef} aria-live="polite">
              {loading && <div className={styles.loading}><i /><i /><i /></div>}
              {!loading && !messages.length && !error && <div className={styles.empty}><Icon icon={faComments} /><strong>Conversem por aqui</strong><p>Use o chat para combinar detalhes da retirada ou da entrega.</p></div>}
              {messages.map(message => {
                const mine = message.sender_id === currentUserId
                return <div className={`${styles.message} ${mine ? styles.mine : ''}`} key={message.id}><span>{message.body}</span><small>{new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small></div>
              })}
            </div>
            {error && <p className={styles.error} role="status">{error}</p>}
            <form className={styles.composer} onSubmit={sendMessage}>
              <textarea ref={composerRef} value={draft} onChange={event => setDraft(event.target.value.slice(0, 1000))} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} placeholder="Digite uma mensagem" rows={1} aria-label="Mensagem" />
              <button type="submit" disabled={!draft.trim() || sending} aria-label="Enviar mensagem"><Icon icon={faArrowUp} /></button>
            </form>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )

  return <>
    <button type="button" className={styles.trigger} onClick={openChat} aria-haspopup="dialog" aria-expanded={open} aria-controls={dialogId}>
      <Icon icon={faComments} /><span>{buttonLabel || `Falar com ${otherLabel.toLowerCase()}`}</span>{unread > 0 && <b>{Math.min(unread, 9)}</b>}
    </button>
    {dialog}
  </>
}
