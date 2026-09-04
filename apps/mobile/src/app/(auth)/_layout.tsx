import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

export default function AuthLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="login"
          options={{
            title: 'Sign In',
          }}
        />
        <Stack.Screen
          name="signup"
          options={{
            title: 'Sign Up',
          }}
        />
        <Stack.Screen
          name="forgot-password"
          options={{
            title: 'Forgot Password',
          }}
        />
        <Stack.Screen
          name="reset-password"
          options={{
            title: 'Reset Password',
            headerShown: true,
          }}
        />
      </Stack>
    </>
  )
}
