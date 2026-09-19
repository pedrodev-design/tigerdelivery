import { useSyncExternalStore } from 'react'
import { getPwaInstallSnapshot, requestPwaInstall, subscribePwaInstall } from '../pwa'

export function usePwaInstall() {
  const state = useSyncExternalStore(subscribePwaInstall, getPwaInstallSnapshot, getPwaInstallSnapshot)
  return { ...state, install: requestPwaInstall }
}
