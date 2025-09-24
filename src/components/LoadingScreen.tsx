import React, { useEffect, useState } from 'react'
import { StyleSheet, ActivityIndicator } from 'react-native'
import { ViewThemed, TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

export function LoadingScreen() {
  const [dots, setDots] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return ''
        return prev + '.'
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <ViewThemed style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
      <TextThemed style={styles.text}>Loading{dots}</TextThemed>
      <TextThemed style={styles.subText}>Checking authentication</TextThemed>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  subText: {
    marginTop: 4,
    fontSize: 14,
  },
})
