import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    if (standalone) return

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as InstallPromptEvent)
      setVisible(true)
    }
    const onInstalled = () => {
      setVisible(false)
      setInstallEvent(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    setVisible(false)
    if (choice.outcome === 'accepted') setInstallEvent(null)
  }

  if (!visible || !installEvent) return null

  return (
    <aside className="fixed bottom-4 left-4 right-4 z-[200] mx-auto flex max-w-md items-center gap-3 border border-primary/40 bg-card p-3 shadow-2xl sm:left-auto sm:right-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary/15 text-primary">
        <Download size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">Instalar BodegaApliSmart</p>
        <p className="text-[11px] text-muted-foreground">Accede más rápido desde tu dispositivo.</p>
      </div>
      <button
        type="button"
        onClick={() => void install()}
        className="min-h-[40px] shrink-0 bg-primary px-3 text-xs font-semibold text-primary-foreground"
      >
        Instalar
      </button>
      <button
        type="button"
        onClick={() => setVisible(false)}
        aria-label="Cerrar aviso de instalación"
        className="flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <X size={16} />
      </button>
    </aside>
  )
}
