import React, { useEffect, useState } from 'react'
import { StyleSheet, ActivityIndicator } from 'react-native'
import { View, Text } from '@/components/Themed'
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
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
      <Text style={styles.text}>Loading{dots}</Text>
      <Text style={styles.subText}>Checking authentication</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: Colors.neutral[700],
  },
  subText: {
    marginTop: 4,
    fontSize: 14,
    color: Colors.neutral[500],
  },
})
