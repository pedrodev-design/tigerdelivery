import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCamera, faCheck, faCircleNotch, faRotate, faShieldHalved, faXmark } from '@fortawesome/free-solid-svg-icons'
import { supabase } from '../../lib/supabase'
import styles from './FaceScan.module.css'

const Icon = ({ icon }) => <FontAwesomeIcon icon={icon} fixedWidth aria-hidden="true" />
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/face_detector.task'
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm'
const VISION_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm'

export function FaceScan({ user, onClose, onComplete }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const detectorRef = useRef(null)
  const frameRef = useRef(null)
  const [phase, setPhase] = useState('loading')
  const [faceFound, setFaceFound] = useState(false)
  const [detectorReady, setDetectorReady] = useState(false)
  const [message, setMessage] = useState('Preparando a câmera…')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function setup() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('camera_unsupported')
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false })
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return }
        streamRef.current = stream
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setPhase('scanning')
        setMessage('Posicione o rosto dentro do círculo')
        try {
          const vision = await import(/* @vite-ignore */ VISION_URL)
          const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL)
          detectorRef.current = await vision.FaceDetector.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' }, runningMode: 'VIDEO', minDetectionConfidence: .62 })
          setDetectorReady(true)
        } catch {
          setMessage('Câmera pronta. Centralize o rosto para continuar.')
        }
      } catch (cameraError) {
        setError(cameraError.message === 'camera_unsupported' ? 'Seu navegador não permite acesso à câmera.' : 'Permita o acesso à câmera para fazer a captura.')
        setPhase('error')
      }
    }
    setup()
    return () => {
      cancelled = true
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      detectorRef.current?.close?.()
      streamRef.current?.getTracks().forEach(track => track.stop())
    }
  }, [])

  useEffect(() => {
    if (phase !== 'scanning') return undefined
    let last = 0
    const scan = timestamp => {
      if (timestamp - last > 160 && detectorRef.current && videoRef.current?.readyState >= 2) {
        last = timestamp
        try {
          const result = detectorRef.current.detectForVideo(videoRef.current, timestamp)
          const box = result.detections?.[0]?.boundingBox
          const width = videoRef.current.videoWidth || 1
          const height = videoRef.current.videoHeight || 1
          const centered = box && box.width / width > .2 && box.width / width < .8 && Math.abs((box.originX + box.width / 2) / width - .5) < .2 && Math.abs((box.originY + box.height / 2) / height - .48) < .22
          setFaceFound(Boolean(centered))
          setMessage(centered ? 'Perfeito. Toque para capturar' : box ? 'Aproxime e centralize o rosto' : 'Posicione o rosto dentro do círculo')
        } catch { /* mantém o guia ativo */ }
      }
      frameRef.current = requestAnimationFrame(scan)
    }
    frameRef.current = requestAnimationFrame(scan)
    return () => frameRef.current && cancelAnimationFrame(frameRef.current)
  }, [phase])

  async function capture() {
    if (!videoRef.current || !user || (!faceFound && detectorRef.current)) return
    setPhase('saving'); setMessage('Salvando sua captura com segurança…')
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    const size = Math.min(video.videoWidth, video.videoHeight)
    canvas.width = 720; canvas.height = 720
    canvas.getContext('2d').drawImage(video, (video.videoWidth - size) / 2, (video.videoHeight - size) / 2, size, size, 0, 0, 720, 720)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .86))
    if (!blob) { setError('Não foi possível capturar a imagem.'); setPhase('error'); return }
    const path = `${user.id}/${crypto.randomUUID()}.jpg`
    const upload = await supabase.storage.from('driver-selfies').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false })
    if (upload.error) { setError('Não foi possível salvar a captura. Tente novamente.'); setPhase('error'); return }
    const result = await supabase.rpc('submit_driver_face_scan', { p_selfie_path: path })
    if (result.error) { await supabase.storage.from('driver-selfies').remove([path]); setError('Não foi possível registrar a captura. Tente novamente.'); setPhase('error'); return }
    streamRef.current?.getTracks().forEach(track => track.stop())
    onComplete?.(result.data)
  }

  return <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Captura de rosto">
    <section className={styles.sheet}>
      <header><div><small>VERIFICAÇÃO RÁPIDA</small><h2>Mostre seu rosto</h2></div><button type="button" onClick={onClose} aria-label="Fechar"><Icon icon={faXmark} /></button></header>
      {phase === 'error' ? <div className={styles.errorState}><span><Icon icon={faRotate} /></span><h3>Não conseguimos abrir a câmera</h3><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></div> : <>
        <div className={`${styles.camera} ${faceFound ? styles.cameraReady : ''}`}><video ref={videoRef} muted playsInline /><div className={styles.faceGuide}><i /><i /></div><span className={styles.cameraStatus}><Icon icon={faceFound ? faCheck : faCamera} />{message}</span>{phase === 'saving' && <div className={styles.cameraLoading}><Icon icon={faCircleNotch} spin /></div>}</div>
        <div className={styles.privacy}><Icon icon={faShieldHalved} /><span><strong>Captura protegida</strong>Usamos esta selfie só para a análise do cadastro.</span></div>
        <button type="button" className={styles.capture} onClick={capture} disabled={phase !== 'scanning' || (detectorReady && !faceFound)}>{phase === 'saving' ? 'Salvando…' : 'Capturar selfie'}<Icon icon={faCamera} /></button>
      </>}
    </section>
  </div>
}
