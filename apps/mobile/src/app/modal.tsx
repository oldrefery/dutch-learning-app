import { StatusBar } from 'expo-status-bar'
import { Platform, StyleSheet } from 'react-native'

import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

export default function ModalScreen() {
  return (
    <ViewThemed style={styles.container}>
      <TextThemed style={styles.title}>Modal</TextThemed>
      <ViewThemed
        style={styles.separator}
        lightColor={Colors.legacy.darkGray}
        darkColor={Colors.transparent.white10}
      />

      {/* Use a light status bar on iOS to account for the black space above the modal */}
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
})
