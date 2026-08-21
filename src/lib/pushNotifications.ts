import { api } from './api'

type PushConfig = { publicKey: string | null; enabled: boolean }

function base64UrlToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
  return bytes
}

export function pushDisponible(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function activarPush(): Promise<void> {
  if (!pushDisponible()) throw new Error('Este navegador no admite notificaciones push.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Debes permitir las notificaciones en el navegador.')
  await registrarSuscripcion()
}

export async function sincronizarPushSiPermitido(): Promise<void> {
  if (!pushDisponible() || Notification.permission !== 'granted') return
  await registrarSuscripcion()
}

async function registrarSuscripcion(): Promise<void> {
  const config = await api.get<PushConfig>('/notificaciones/push/public-key')
  if (!config.enabled || !config.publicKey) throw new Error('Las notificaciones push no están configuradas.')
  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(config.publicKey),
    })
  }
  await api.post('/notificaciones/push/suscribir', subscription.toJSON())
}
