import React from 'react'
import { StyleSheet } from 'react-native'
import { Text, View } from '@/components/Themed'

export default function AddWordScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add New Word</Text>
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
      <Text>Enter a Dutch word to analyze with AI:</Text>
      <Text>• Word input field</Text>
      <Text>• AI analysis with Gemini</Text>
      <Text>• Preview and save</Text>
    </View>
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
});
