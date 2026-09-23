import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog } from 'radix-ui'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCommentDots } from '@fortawesome/free-regular-svg-icons'
import { ChatPanel } from './ChatPanel'
import { supabase } from '../../lib/supabase'
import { playNotificationSound } from '../../services/notifications'
import styles from './OrderChat.module.css'

const Icon = ({ icon }) => <FontAwesomeIcon icon={icon} fixedWidth aria-hidden="true" />

function mergeMessage(current, incoming) {
  if (current.some(message => message.id === incoming.id)) return current
  return [...current, incoming].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
}

export function OrderChat({ orderId, currentUserId, otherLabel = 'equipe do pedido', buttonLabel, orderLabel, context }) {
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
    return () => {
      window.clearInterval(pollMessages)
    }
  }, [loadMessages, open])

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

  return <Dialog.Root open={open} onOpenChange={nextOpen => nextOpen ? openChat() : closeChat()}>
    <Dialog.Trigger asChild>
      <button type="button" className={styles.trigger}>
        <Icon icon={faCommentDots} /><span>{buttonLabel || 'Conversar sobre o pedido'}</span>{unread > 0 && <b>{unread > 9 ? '9+' : unread}</b>}
      </button>
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className={styles.backdrop} />
      <Dialog.Content id={dialogId} className={styles.panel}>
        <ChatPanel orderId={orderId} currentUserId={currentUserId} otherLabel={otherLabel} orderLabel={orderLabel} context={context} messages={messages} loading={loading} sending={sending} error={error} draft={draft} onDraftChange={setDraft} onSend={sendMessage} listRef={listRef} composerRef={composerRef} />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
