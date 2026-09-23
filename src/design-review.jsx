import { useState, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { Dialog } from 'radix-ui'
import { ChatPanel } from './components/OrderChat/ChatPanel'
import { OrderChat } from './components/OrderChat'
import styles from './components/OrderChat/OrderChat.module.css'
import './index.css'

function Review() {
 const [open,setOpen]=useState(false),[draft,setDraft]=useState(''),[mode,setMode]=useState('customer'),[messages,setMessages]=useState([])
 const listRef=useRef(),composerRef=useRef()
 const samples=[
  {id:'a',sender_id:'driver',body:'Oi! Já retirei seu pedido. Estou a caminho.',created_at:new Date().toISOString()},
  {id:'b',sender_id:'customer',body:'Opa! Pode deixar na portaria, por favor?',created_at:new Date().toISOString()},
  {id:'c',sender_id:'customer',body:'É a entrada ao lado da padaria.',created_at:new Date().toISOString()},
  {id:'d',sender_id:'driver',body:'Combinado. Te aviso quando chegar!',created_at:new Date().toISOString()},
 ]
 return <main style={{padding:24,background:'#fff',minHeight:'100dvh'}}>
  <h1 style={{fontSize:26}}>Revisão visual do chat</h1><p style={{margin:'10px 0 24px'}}>Dados fictícios, sem envio ao banco.</p>
  <Dialog.Root open={open} onOpenChange={setOpen}>
   <Dialog.Trigger className={styles.trigger} onClick={()=>{setMode('customer');setMessages(samples)}}>Conversa do cliente</Dialog.Trigger>{' '}
   <button className={styles.trigger} onClick={()=>{setMode('driver');setMessages(samples);setOpen(true)}}>Conversa do motorista</button>{' '}
   <button className={styles.trigger} onClick={()=>{setMode('customer');setMessages([]);setOpen(true)}}>Conversa vazia</button>
   <Dialog.Portal><Dialog.Overlay className={styles.backdrop}/><Dialog.Content className={styles.panel}>
    <ChatPanel orderId="A78B91-visual" orderLabel="Brasa Burger" currentUserId={mode} otherLabel={mode==='customer'?'Motorista':'Cliente'} messages={messages} draft={draft} onDraftChange={setDraft} onSend={e=>{e.preventDefault();if(!draft.trim())return;setMessages([...messages,{id:crypto.randomUUID(),sender_id:mode,body:draft,created_at:new Date().toISOString()}]);setDraft('')}} listRef={listRef} composerRef={composerRef}/>
   </Dialog.Content></Dialog.Portal>
  </Dialog.Root><div style={{marginTop:20}}><OrderChat orderId="11111111-1111-1111-1111-111111111111" otherLabel="Motorista" /></div>
 </main>
}
createRoot(document.getElementById('root')).render(<Review/>);
