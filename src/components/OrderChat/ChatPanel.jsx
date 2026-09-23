import { Fragment, useEffect, useRef } from 'react'
import { Dialog } from 'radix-ui'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUp, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons'
import styles from './OrderChat.module.css'

const time = date => new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()

function dayLabel(date) {
  const today = new Date()
  if (sameDay(date, today)) return 'Hoje'
  today.setDate(today.getDate() - 1)
  if (sameDay(date, today)) return 'Ontem'
  return new Date(date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
}

export function ChatPanel({ orderId, currentUserId, otherLabel, orderLabel, messages, loading, sending, error, draft, onDraftChange, onSend, listRef, composerRef }) {
  const nearBottom = useRef(true)
  const lastMessage = messages.at(-1)
  useEffect(() => {
    if (!nearBottom.current && lastMessage?.sender_id !== currentUserId) return undefined
    const frame = requestAnimationFrame(() => {
      const list = listRef.current
      if (list) list.scrollTop = list.scrollHeight
    })
    return () => cancelAnimationFrame(frame)
  }, [currentUserId, lastMessage?.id, lastMessage?.sender_id, listRef])

  const suggestions = otherLabel === 'Motorista'
    ? ['Olá! Tudo certo?', 'Vou esperar na portaria.']
    : ['Olá! Estou a caminho.', 'Cheguei ao endereço.']

  function chooseReply(text) {
    onDraftChange(text)
    composerRef.current?.focus()
  }

  return <>
    <header className={styles.header}>
      <span className={styles.avatar} aria-hidden="true">{otherLabel.charAt(0)}</span>
      <div className={styles.identity}>
        <Dialog.Title className={styles.title}>{otherLabel}</Dialog.Title>
        <Dialog.Description className={styles.subtitle}>Conversa sobre sua entrega</Dialog.Description>
      </div>
      <Dialog.Close className={styles.close} aria-label="Fechar conversa"><FontAwesomeIcon icon={faXmark} /></Dialog.Close>
    </header>
    <div className={styles.orderContext}>
      <span className={styles.orderMark} aria-hidden="true">TD</span>
      <div><strong>{orderLabel || 'TigreDelivery'}</strong><span>Pedido #{orderId.slice(0, 6).toUpperCase()}</span></div>
    </div>
    <div className={styles.messages} ref={listRef} onScroll={event => {
      const list = event.currentTarget
      nearBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80
    }} role="log" aria-label="Mensagens da conversa" aria-live="polite" aria-relevant="additions text" aria-busy={loading}>
      {loading && !messages.length && <div className={styles.loading} role="status"><i /><i /><i /><span>Carregando conversa…</span></div>}
      {!loading && !messages.length && !error && <div className={styles.empty}>
        <svg viewBox="0 0 100 78" fill="none" aria-hidden="true"><path d="M18 9h44a12 12 0 0 1 12 12v20a12 12 0 0 1-12 12H36L20 64v-11h-2A12 12 0 0 1 6 41V21A12 12 0 0 1 18 9Z" fill="#FFDA00" /><path d="M51 32h30a12 12 0 0 1 12 12v10a12 12 0 0 1-12 12h-1v9L67 66H51a12 12 0 0 1-12-12V44a12 12 0 0 1 12-12Z" fill="#fff" stroke="#292A25" strokeWidth="2" /><path d="M22 26h29M22 35h16M53 47h25M53 55h17" stroke="#292A25" strokeWidth="2" strokeLinecap="round" /></svg>
        <h3>Uma mensagem resolve.</h3>
        <p>Combine o ponto de encontro ou um detalhe da entrega com {otherLabel === 'Motorista' ? 'o motorista' : 'o cliente'}.</p>
      </div>}
      {messages.map((message, index) => {
        const previous = messages[index - 1]
        const mine = message.sender_id === currentUserId
        const newDay = !previous || !sameDay(previous.created_at, message.created_at)
        const grouped = !newDay && previous.sender_id === message.sender_id && new Date(message.created_at) - new Date(previous.created_at) < 180000
        return <Fragment key={message.id}>
          {newDay && <div className={styles.dateSeparator}><span>{dayLabel(message.created_at)}</span></div>}
          <div className={`${styles.message} ${mine ? styles.mine : ''} ${grouped ? styles.grouped : ''}`}>
            <p>{message.body}</p>
            <span className={styles.messageMeta}><time dateTime={message.created_at}>{time(message.created_at)}</time>{mine && <FontAwesomeIcon icon={faCheck} aria-label="Enviada" role="img" />}</span>
          </div>
        </Fragment>
      })}
    </div>
    <footer className={styles.footer}>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!loading && !error && !messages.length && <div className={styles.suggestions} aria-label="Sugestões de mensagem">{suggestions.map(text => <button type="button" key={text} onClick={() => chooseReply(text)}>{text}</button>)}</div>}
      <form className={styles.composer} onSubmit={onSend}>
        <textarea ref={composerRef} value={draft} maxLength={1000} onChange={event => onDraftChange(event.target.value)} onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit() }
        }} placeholder="Escreva sua mensagem…" rows={Math.min(4, Math.max(1, draft.split('\n').length))} aria-label="Mensagem" />
        <button type="submit" disabled={!draft.trim() || sending} aria-label={sending ? 'Enviando mensagem' : 'Enviar mensagem'}>{sending ? <i className={styles.sending} /> : <FontAwesomeIcon icon={faArrowUp} />}</button>
      </form>
      <p className={styles.composerHint}>Enter para enviar <span>·</span> Shift + Enter para pular linha</p>
    </footer>
  </>
}
