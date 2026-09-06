import { Switch, View } from 'react-native'
import { TextThemed } from '@/components/Themed'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { reviewFlowStyles as styles } from './styles'

export function ManualRecognitionPreference({
  userId,
  duringSession = false,
}: {
  userId: string
  duringSession?: boolean
}) {
  const enabled = useSettingsStore(
    state => state.manualRecognitionByUser[userId] === true
  )
  const setManual = useSettingsStore(state => state.setManualRecognition)
  return (
    <View style={styles.preference}>
      <View style={styles.preferenceText}>
        <TextThemed style={styles.label}>Manual Recognition ratings</TextThemed>
        <TextThemed style={styles.note}>
          {duringSession
            ? 'Changes apply to the next word.'
            : 'Off: correct answers record Good and advance automatically.'}
        </TextThemed>
      </View>
      <Switch
        value={enabled}
        onValueChange={value => setManual(userId, value)}
        accessibilityLabel="Manual Recognition ratings"
      />
    </View>
  )
}
