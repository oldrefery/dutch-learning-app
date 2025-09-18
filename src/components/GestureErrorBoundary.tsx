import React from 'react'
import { View } from 'react-native'
import { TextThemed } from '@/components/Themed'
import { Sentry } from '@/lib/sentry'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class GestureErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('🚨 GESTURE ERROR BOUNDARY: Error caught:', error)
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 GESTURE ERROR BOUNDARY: componentDidCatch triggered')
    console.error('🚨 ERROR:', error)
    console.error('🚨 ERROR INFO:', errorInfo)

    // Report to Sentry
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
          errorBoundary: 'GestureErrorBoundary',
        },
      },
    })
  }

  render() {
    if (this.state.hasError) {
      console.log('🚨 GESTURE ERROR BOUNDARY: Rendering fallback UI')

      return (
        this.props.fallback || (
          <View style={{ padding: 20, backgroundColor: '#ffebee' }}>
            <TextThemed style={{ color: '#c62828', textAlign: 'center' }}>
              Gesture Error: {this.state.error?.message || 'Unknown error'}
            </TextThemed>
            <TextThemed
              style={{ color: '#666', textAlign: 'center', marginTop: 8 }}
            >
              Please try refreshing the screen
            </TextThemed>
          </View>
        )
      )
    }

    return this.props.children
  }
}
