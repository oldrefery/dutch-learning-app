import { StyleSheet } from 'react-native'
import { Text, View } from '@/components/Themed'

export default function CollectionsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Collections</Text>
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />
      <Text>Word collections will be displayed here</Text>
      <Text>• Statistics</Text>
      <Text>• Review due words</Text>
      <Text>• Collection management</Text>
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
