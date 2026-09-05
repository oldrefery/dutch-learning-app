import { Link, Stack } from 'expo-router'
import { StyleSheet } from 'react-native'

import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <ViewThemed style={styles.container}>
        <TextThemed style={styles.title}>
          This screen doesn&apos;t exist.
        </TextThemed>

        <Link href="/" style={styles.link}>
          <TextThemed style={styles.linkText}>Go to home screen!</TextThemed>
        </Link>
      </ViewThemed>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
    color: Colors.link.DEFAULT,
  },
})
