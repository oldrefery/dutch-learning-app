import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { supabase } from '@/lib/supabaseClient'

interface DiagnosticInfo {
  supabaseUrl: string
  supabaseKey: string
  connectionStatus: 'checking' | 'connected' | 'error'
  sessionCheck: 'checking' | 'success' | 'error'
  error?: string
  userInfo?: any
}

export function SupabaseDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo>({
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || 'NOT SET',
    supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
      ? `${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY.slice(0, 20)}...`
      : 'NOT SET',
    connectionStatus: 'checking',
    sessionCheck: 'checking',
  })

  useEffect(() => {
    const runDiagnostics = async () => {
      console.log('🔍 Starting Supabase diagnostics...')

      try {
        // Test basic connection
        setDiagnostics(prev => ({ ...prev, connectionStatus: 'checking' }))

        // Try to get current session
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession()

        if (sessionError) {
          console.error('❌ Session check failed:', sessionError)
          setDiagnostics(prev => ({
            ...prev,
            connectionStatus: 'error',
            sessionCheck: 'error',
            error: sessionError.message,
          }))
          return
        }

        console.log('✅ Session check successful:', sessionData)

        setDiagnostics(prev => ({
          ...prev,
          connectionStatus: 'connected',
          sessionCheck: 'success',
          userInfo: sessionData.session?.user || null,
        }))

        // Test database connection with a simple query
        try {
          const { data: collections, error: dbError } = await supabase
            .from('collections')
            .select('collection_id, name')
            .limit(1)

          if (dbError) {
            console.error('❌ Database test failed:', dbError)
            setDiagnostics(prev => ({
              ...prev,
              error: `Database error: ${dbError.message}`,
            }))
          } else {
            console.log('✅ Database connection successful')
          }
        } catch (dbError) {
          console.error('❌ Database connection failed:', dbError)
          setDiagnostics(prev => ({
            ...prev,
            error: `Database connection failed: ${dbError}`,
          }))
        }
      } catch (error) {
        console.error('❌ Diagnostics failed:', error)
        setDiagnostics(prev => ({
          ...prev,
          connectionStatus: 'error',
          sessionCheck: 'error',
          error: error instanceof Error ? error.message : String(error),
        }))
      }
    }

    runDiagnostics()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'checking':
        return '#f59e0b'
      case 'connected':
      case 'success':
        return '#10b981'
      case 'error':
        return '#ef4444'
      default:
        return '#6b7280'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'checking':
        return 'Проверка...'
      case 'connected':
      case 'success':
        return 'Успешно'
      case 'error':
        return 'Ошибка'
      default:
        return 'Неизвестно'
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Диагностика Supabase</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Конфигурация</Text>

        <View style={styles.item}>
          <Text style={styles.label}>Supabase URL:</Text>
          <Text
            style={[
              styles.value,
              {
                color:
                  diagnostics.supabaseUrl === 'NOT SET' ? '#ef4444' : '#10b981',
              },
            ]}
          >
            {diagnostics.supabaseUrl}
          </Text>
        </View>

        <View style={styles.item}>
          <Text style={styles.label}>Supabase Key:</Text>
          <Text
            style={[
              styles.value,
              {
                color:
                  diagnostics.supabaseKey === 'NOT SET' ? '#ef4444' : '#10b981',
              },
            ]}
          >
            {diagnostics.supabaseKey}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Статус подключения</Text>

        <View style={styles.item}>
          <Text style={styles.label}>Подключение:</Text>
          <Text
            style={[
              styles.value,
              { color: getStatusColor(diagnostics.connectionStatus) },
            ]}
          >
            {getStatusText(diagnostics.connectionStatus)}
          </Text>
        </View>

        <View style={styles.item}>
          <Text style={styles.label}>Проверка сессии:</Text>
          <Text
            style={[
              styles.value,
              { color: getStatusColor(diagnostics.sessionCheck) },
            ]}
          >
            {getStatusText(diagnostics.sessionCheck)}
          </Text>
        </View>
      </View>

      {diagnostics.userInfo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Информация о пользователе</Text>
          <Text style={styles.codeText}>
            {JSON.stringify(diagnostics.userInfo, null, 2)}
          </Text>
        </View>
      )}

      {diagnostics.error && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: '#ef4444' }]}>
            Ошибка
          </Text>
          <Text style={[styles.codeText, { color: '#ef4444' }]}>
            {diagnostics.error}
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Причины бесконечного цикла</Text>
        <Text style={styles.description}>
          1. SessionProvider и RootLayout перезапускают друг друга{'\n'}
          2. useSession() вызывает повторную инициализацию{'\n'}
          3. router.replace() вызывает перерендер компонентов{'\n'}
          4. useEffect зависимости могут быть нестабильными
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1f2937',
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  codeText: {
    fontFamily: 'SpaceMono',
    fontSize: 12,
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 4,
    color: '#374151',
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
})
