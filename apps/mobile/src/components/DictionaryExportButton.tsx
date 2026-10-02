import { useRef, useState } from 'react'
import { ActivityIndicator, TouchableOpacity } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { Ionicons } from '@expo/vector-icons'
import { useThemeColor } from '@/components/Themed'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import {
  exportOfflineDictionaryCollection,
  serializeDictionaryTransfer,
} from '@/services/dictionaryTransferService'
import { isDictionaryContentEnabled } from '@/constants/dictionaryContent'
import { useApplicationStore } from '@/stores/useApplicationStore'

export function DictionaryExportButton({
  collectionId,
}: {
  collectionId: string
}) {
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const tint = useThemeColor({}, 'tint')
  if (!isDictionaryContentEnabled()) return null
  const copy = async () => {
    if (inFlight.current) return
    const owner = useApplicationStore.getState().currentUserId
    inFlight.current = true
    setBusy(true)
    try {
      const document = await exportOfflineDictionaryCollection(collectionId)
      if (!owner || useApplicationStore.getState().currentUserId !== owner)
        return
      if (
        !(await Clipboard.setStringAsync(serializeDictionaryTransfer(document)))
      )
        throw new Error('Could not copy the document.')
      if (useApplicationStore.getState().currentUserId === owner)
        ToastService.show('Full collection JSON copied.', ToastType.SUCCESS)
    } catch (error) {
      if (useApplicationStore.getState().currentUserId === owner)
        ToastService.show(
          error instanceof Error ? error.message : 'Export failed.',
          ToastType.ERROR
        )
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Copy collection JSON export"
      disabled={busy}
      onPress={copy}
      style={{ padding: 6 }}
    >
      {busy ? (
        <ActivityIndicator color={tint} />
      ) : (
        <Ionicons name="download-outline" size={24} color={tint} />
      )}
    </TouchableOpacity>
  )
}
