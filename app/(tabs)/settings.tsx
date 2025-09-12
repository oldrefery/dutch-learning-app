import React from 'react'
import { StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { View, Text } from '@/components/Themed'
import { supabase } from '@/lib/supabaseClient'
import { Colors } from '@/constants/Colors'

export default function SettingsScreen() {
  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.auth.signOut()

            if (error) {
              Alert.alert('Error', 'Failed to logout. Please try again.')
              return
            }

            // Navigate to login
            router.replace('/(auth)/login')
          } catch (error) {
            Alert.alert('Error', 'An unexpected error occurred.')
          }
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>
            Manage your account and app preferences
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>

          <Text style={styles.logoutDescription}>
            This will clear your session and return you to the login screen.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.debugText}>Dutch Learning App - Version 1.0</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.neutral[900],
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.neutral[600],
    textAlign: 'center',
  },
  section: {
    marginBottom: 32,
    padding: 20,
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 16,
  },
  logoutButton: {
    backgroundColor: Colors.error.DEFAULT,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  logoutButtonText: {
    color: Colors.background.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  logoutDescription: {
    fontSize: 14,
    color: Colors.neutral[600],
    textAlign: 'center',
  },
  debugText: {
    fontSize: 14,
    color: Colors.neutral[600],
    fontStyle: 'italic',
  },
})
