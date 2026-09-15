import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCamera, faCheck, faCircleNotch, faRotate, faShieldHalved, faXmark } from '@fortawesome/free-solid-svg-icons'
import { supabase } from '../../lib/supabase'
import styles from './FaceScan.module.css'

const Icon = ({ icon, spin = false }) => <FontAwesomeIcon icon={icon} fixedWidth spin={spin} aria-hidden="true" />
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm'
const VISION_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm'

const averageLight = video => {
  const canvas = document.createElement('canvas')
  canvas.width = 16; canvas.height = 16
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(video, 0, 0, 16, 16)
  const pixels = context.getImageData(0, 0, 16, 16).data
  let total = 0
  for (let index = 0; index < pixels.length; index += 4) total += (pixels[index] * .2126) + (pixels[index + 1] * .7152) + (pixels[index + 2] * .0722)
  return total / (pixels.length / 4)
}

export function FaceScan({ user, onClose, onComplete }) {
  const videoRef = useRef(null); const streamRef = useRef(null); const detectorRef = useRef(null); const frameRef = useRef(null)
  const [phase, setPhase] = useState('loading'); const [challenge] = useState(() => (Math.random() > .5 ? 'blink' : 'turn')); const [challengeDone, setChallengeDone] = useState(false)
  const [faceFound, setFaceFound] = useState(false); const [detectorReady, setDetectorReady] = useState(false); const [detectorLoading, setDetectorLoading] = useState(true); const [progress, setProgress] = useState(8)
  const [message, setMessage] = useState('Preparando a câmera…'); const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function setup() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('camera_unsupported')
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false })
        if (cancelled) { stream.getTracks().forEach(track => track.stop()); return }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) throw new Error('camera_unavailable')
        video.srcObject = stream
        if (video.readyState < 1) await new Promise(resolve => { video.onloadedmetadata = resolve })
        await video.play().catch(() => undefined)
        setPhase('scanning'); setProgress(25); setMessage('Carregando o detector facial…')
        try {
          const vision = await import(/* @vite-ignore */ VISION_URL)
          const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL)
          detectorRef.current = await vision.FaceLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' }, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, minFaceDetectionConfidence: .62, minTrackingConfidence: .62 })
          setDetectorReady(true); setDetectorLoading(false); setMessage(challenge === 'blink' ? 'Olhe para a câmera e pisque uma vez' : 'Olhe para a câmera e vire levemente o rosto')
        } catch { setDetectorLoading(false); setMessage('Câmera pronta. Centralize o rosto para continuar.') }
      } catch (cameraError) {
        const reason = cameraError.name === 'NotAllowedError' ? 'Permita o acesso à câmera no navegador e tente novamente.' : cameraError.name === 'NotFoundError' ? 'Nenhuma câmera foi encontrada neste dispositivo.' : cameraError.message === 'camera_unsupported' ? 'Seu navegador não permite acesso à câmera.' : 'Não foi possível iniciar a câmera. Confira a permissão e tente novamente.'
        setError(reason); setPhase('error')
      }
    }
    setup()
    return () => { cancelled = true; if (frameRef.current) cancelAnimationFrame(frameRef.current); detectorRef.current?.close?.(); streamRef.current?.getTracks().forEach(track => track.stop()) }
  }, [challenge])

  useEffect(() => {
    if (phase !== 'scanning') return undefined
    let last = 0
    const scan = timestamp => {
      if (timestamp - last > 180 && detectorRef.current && videoRef.current?.readyState >= 2) {
        last = timestamp
        try {
          const result = detectorRef.current.detectForVideo(videoRef.current, timestamp); const landmarks = result.faceLandmarks?.[0]
          if (!landmarks?.length) { setFaceFound(false); setProgress(28); setMessage('Posicione o rosto dentro do círculo') }
          else {
            const xs = landmarks.map(point => point.x); const ys = landmarks.map(point => point.y); const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys)
            const width = maxX - minX; const centerX = (minX + maxX) / 2; const centerY = (minY + maxY) / 2; const light = averageLight(videoRef.current)
            const centered = Math.abs(centerX - .5) < .18 && Math.abs(centerY - .48) < .2
            if (light < 48) { setFaceFound(false); setProgress(35); setMessage('Procure um lugar mais iluminado') }
            else if (width < .2) { setFaceFound(false); setProgress(40); setMessage('Aproxime um pouco o rosto') }
            else if (width > .72) { setFaceFound(false); setProgress(40); setMessage('Afaste um pouco o rosto') }
            else if (!centered) { setFaceFound(false); setProgress(48); setMessage('Centralize o rosto no círculo') }
            else {
              setFaceFound(true); const blendshapes = result.faceBlendshapes?.[0]?.categories || []; const blinkLeft = blendshapes.find(item => item.categoryName === 'eyeBlinkLeft')?.score || 0; const blinkRight = blendshapes.find(item => item.categoryName === 'eyeBlinkRight')?.score || 0; const passed = challenge === 'blink' ? blinkLeft > .4 && blinkRight > .4 : Math.abs((landmarks[1]?.x || centerX) - .5) > .1
              if (passed) { setChallengeDone(true); setProgress(100); setMessage('Rosto confirmado. Toque para capturar') } else { setProgress(70); setMessage(challenge === 'blink' ? 'Pisque uma vez para confirmar' : 'Vire levemente o rosto para o lado') }
            }
          }
        } catch { /* mantém o guia ativo */ }
      }
      frameRef.current = requestAnimationFrame(scan)
    }
    frameRef.current = requestAnimationFrame(scan); return () => frameRef.current && cancelAnimationFrame(frameRef.current)
  }, [challenge, phase])

  async function capture() {
    if (!videoRef.current || !user || (detectorReady && !challengeDone)) return
    setPhase('saving'); setProgress(100); setMessage('Salvando sua captura com segurança…')
    const video = videoRef.current; const canvas = document.createElement('canvas'); const size = Math.min(video.videoWidth, video.videoHeight); canvas.width = 720; canvas.height = 720
    canvas.getContext('2d').drawImage(video, (video.videoWidth - size) / 2, (video.videoHeight - size) / 2, size, size, 0, 0, 720, 720)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .86))
    if (!blob) { setError('Não foi possível capturar a imagem.'); setPhase('error'); return }
    const path = `${user.id}/${crypto.randomUUID()}.jpg`; const upload = await supabase.storage.from('driver-selfies').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false })
    if (upload.error) { setError('Não foi possível salvar a captura. Tente novamente.'); setPhase('error'); return }
    const result = await supabase.rpc('submit_driver_face_scan', { p_selfie_path: path })
    if (result.error) { await supabase.storage.from('driver-selfies').remove([path]); setError('A captura foi feita, mas não conseguimos registrar a análise.'); setPhase('error'); return }
    streamRef.current?.getTracks().forEach(track => track.stop()); setPhase('sent'); setMessage('Captura enviada para análise'); window.setTimeout(() => onComplete?.(result.data), 500)
  }

  return <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Captura de rosto"><section className={styles.sheet}>
    <header><div><small>Verificação rápida</small><h2>Mostre seu rosto</h2></div><button type="button" onClick={onClose} aria-label="Fechar"><Icon icon={faXmark} /></button></header>
    <div className={styles.progressSteps} aria-label="Progresso da captura"><span className={progress >= 25 ? styles.done : ''}>Preparando câmera</span><span className={faceFound || challengeDone ? styles.done : ''}>Rosto encontrado</span><span className={phase === 'saving' || phase === 'sent' ? styles.done : ''}>Capturando</span><span className={phase === 'sent' ? styles.done : ''}>Enviado</span></div>
    {phase === 'error' ? <div className={styles.errorState}><span><Icon icon={faRotate} /></span><h3>Não foi possível concluir a captura</h3><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></div> : phase === 'sent' ? <div className={styles.sentState}><span><Icon icon={faCheck} /></span><h3>Captura enviada</h3><p>A equipe vai conferir seu rosto e liberar a próxima etapa.</p><button type="button" onClick={onClose}>Continuar</button></div> : <>
      <div className={`${styles.camera} ${faceFound ? styles.cameraReady : ''}`}><video ref={videoRef} muted playsInline /><div className={styles.faceGuide}><i /><i /></div><span className={styles.cameraStatus}><Icon icon={faceFound ? faCheck : faCamera} />{message}</span>{phase === 'saving' && <div className={styles.cameraLoading}><Icon icon={faCircleNotch} spin /></div>}</div>
      <div className={styles.progressBar}><span style={{ width: `${progress}%` }} /></div>
      <div className={styles.privacy}><Icon icon={faShieldHalved} /><span><strong>Captura protegida</strong>Usamos esta selfie só para a análise do cadastro.</span></div>
      <button type="button" className={styles.capture} onClick={capture} disabled={phase !== 'scanning' || detectorLoading || (detectorReady && !challengeDone)}>{phase === 'saving' ? 'Salvando…' : 'Capturar selfie'}<Icon icon={faCamera} /></button>
    </>}
  </section></div>
}
