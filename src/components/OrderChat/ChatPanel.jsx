import { Fragment, useEffect, useRef } from 'react'
import { Dialog } from 'radix-ui'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUp, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons'
import { orderPhoto } from '../../services/orderPresentation'
import styles from './OrderChat.module.css'

const time = date => new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()
const dayLabel = date => sameDay(date, new Date()) ? 'Hoje' : new Date(date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })

function PersonPhoto({ name, photo }) {
  return <span className={styles.personPhoto}>{photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : <span aria-hidden="true">{name?.charAt(0)?.toLocaleUpperCase('pt-BR') || '?'}</span>}</span>
}

export function ChatPanel({ orderId, currentUserId, orderLabel, context, messages, loading, sending, error, draft, onDraftChange, onSend, listRef, composerRef }) {
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

  const people = [
    { role: 'Loja', name: context?.store_name || orderLabel || 'Loja', photo: context?.store_logo_url },
    { role: 'Cliente', name: context?.customer_name || 'Cliente', photo: context?.customer_avatar_url },
    ...(context?.driver_id ? [{ role: 'Motorista', name: context.driver_name || 'Motorista', photo: context.driver_avatar_url }] : []),
  ]
  const picture = orderPhoto(context)
  const authorFor = message => {
    if (message.sender_id === currentUserId) return { name: 'Você' }
    if (message.sender_id === context?.customer_id) return { name: context.customer_name || 'Cliente', photo: context.customer_avatar_url }
    if (message.sender_id === context?.driver_id) return { name: context.driver_name || 'Motorista', photo: context.driver_avatar_url }
    return { name: context?.store_name || 'Participante do pedido', photo: context?.store_logo_url }
  }
  const chooseReply = value => { onDraftChange(value); composerRef.current?.focus() }

  return <>
    <header className={styles.header}>
      <div className={styles.identity}>
        <span className={styles.headerEyebrow}>TigreDelivery · pedido #{orderId.slice(0, 6).toUpperCase()}</span>
        <Dialog.Title className={styles.title}>Conversa do pedido</Dialog.Title>
        <Dialog.Description className={styles.subtitle}>{context?.driver_id ? 'Cliente, loja e motorista no mesmo lugar' : 'Converse com a loja sobre seu pedido'}</Dialog.Description>
      </div>
      <Dialog.Close className={styles.close} aria-label="Fechar conversa"><FontAwesomeIcon icon={faXmark} /></Dialog.Close>
    </header>
    <div className={styles.orderContext}>
      <span className={styles.orderMark}>{picture ? <img src={picture} alt="" /> : <span aria-hidden="true">TD</span>}</span>
      <div><strong>{context?.item_name || orderLabel || 'Seu pedido'}</strong><span>{context?.store_name || orderLabel || 'TigreDelivery'}{context?.item_count > 1 ? ` · +${context.item_count - 1} ${context.item_count === 2 ? 'item' : 'itens'}` : ''}</span></div>
    </div>
    <div className={styles.participants} aria-label="Participantes da conversa">
      {people.map(person => <span key={person.role} className={styles.participant}><PersonPhoto name={person.name} photo={person.photo} /><span><small>{person.role}</small><strong>{person.name}</strong></span></span>)}
    </div>
    <div className={styles.messages} ref={listRef} onScroll={event => {
      const list = event.currentTarget
      nearBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80
    }} role="log" aria-label="Mensagens da conversa" aria-live="polite" aria-relevant="additions text" aria-busy={loading}>
      {loading && !messages.length && <div className={styles.loading} role="status"><i /><i /><i /><span>Carregando conversa…</span></div>}
      {!loading && !messages.length && !error && <div className={styles.empty}><span className={styles.emptyMark}>“</span><h3>Conversa aberta</h3><p>Uma dúvida sobre o preparo ou a entrega? Escreva aqui. Todos do pedido acompanham.</p></div>}
      {messages.map((message, index) => {
        const previous = messages[index - 1]
        const mine = message.sender_id === currentUserId
        const author = authorFor(message)
        const newDay = !previous || !sameDay(previous.created_at, message.created_at)
        const grouped = !newDay && previous.sender_id === message.sender_id && new Date(message.created_at) - new Date(previous.created_at) < 180000
        return <Fragment key={message.id}>
          {newDay && <div className={styles.dateSeparator}><span>{dayLabel(message.created_at)}</span></div>}
          <div className={`${styles.messageRow} ${mine ? styles.myRow : ''} ${grouped ? styles.grouped : ''}`}>
            {!mine && <PersonPhoto name={author.name} photo={author.photo} />}
            <div className={styles.message}>
              {!grouped && <strong className={styles.author}>{author.name}</strong>}
              <p>{message.body}</p>
              <span className={styles.messageMeta}><time dateTime={message.created_at}>{time(message.created_at)}</time>{mine && <FontAwesomeIcon icon={faCheck} aria-label="Enviada" role="img" />}</span>
            </div>
          </div>
        </Fragment>
      })}
    </div>
    <footer className={styles.footer}>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!loading && !error && !messages.length && <div className={styles.suggestions} aria-label="Sugestões de mensagem">{['Olá! Tudo certo com o pedido?', 'Pode me dar uma atualização?'].map(value => <button type="button" key={value} onClick={() => chooseReply(value)}>{value}</button>)}</div>}
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
