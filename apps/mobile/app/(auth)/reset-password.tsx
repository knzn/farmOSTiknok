import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { apiRequest } from '../../lib/api'

export default function ResetPasswordScreen() {
  const router = useRouter()
  const { token } = useLocalSearchParams<{ token: string }>()

  const [password, setPassword]           = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword]   = useState(false)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [done, setDone]                   = useState(false)

  async function handleReset() {
    setError(null)

    if (!token) {
      return setError('Invalid reset link. Please request a new one.')
    }
    if (password.length < 8) {
      return setError('Password must be at least 8 characters')
    }
    if (password !== confirmPassword) {
      return setError('Passwords do not match')
    }

    setLoading(true)
    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: { token, password },
      })
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  const inputRowStyle = {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    backgroundColor: '#141414', borderRadius: 14,
    borderWidth: 1, borderColor: '#2A2A2A',
    paddingHorizontal: 16,
  }

  const inputStyle = {
    flex: 1, color: '#FFFFFF' as const, fontSize: 15, paddingVertical: 16,
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0A0A0A' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 64 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Heading */}
        <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginBottom: 8 }}>
          Set new password
        </Text>
        <Text style={{ color: '#A0A0A0', fontSize: 14, lineHeight: 22, marginBottom: 36 }}>
          Choose a strong password for your TIKNOK account.
        </Text>

        {done ? (
          /* ── Success state ── */
          <View style={{
            backgroundColor: '#22C55E18',
            borderRadius: 16, borderWidth: 1, borderColor: '#22C55E44',
            padding: 24, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 40, marginBottom: 16 }}>✅</Text>
            <Text style={{ color: '#22C55E', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
              Password updated!
            </Text>
            <Text style={{ color: '#A0A0A0', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              Your password has been changed. You can now sign in with your new password.
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/(auth)/login')}
              activeOpacity={0.8}
              style={{
                marginTop: 24,
                backgroundColor: '#C8A84B',
                borderRadius: 50, paddingVertical: 14, paddingHorizontal: 32,
              }}
            >
              <Text style={{ color: '#0A0A0A', fontWeight: '700', fontSize: 15 }}>Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Form ── */
          <View style={{ gap: 16 }}>
            {/* New password */}
            <View style={inputRowStyle}>
              <TextInput
                style={inputStyle}
                placeholder="New password"
                placeholderTextColor="#606060"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="next"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} activeOpacity={0.7}>
                <Text style={{ color: '#606060', fontSize: 13, paddingLeft: 8 }}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Confirm password */}
            <View style={inputRowStyle}>
              <TextInput
                style={inputStyle}
                placeholder="Confirm new password"
                placeholderTextColor="#606060"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleReset}
              />
            </View>

            {error ? (
              <View style={{
                backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12,
                paddingHorizontal: 16, paddingVertical: 12,
                borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
              }}>
                <Text style={{ color: '#EF4444', fontSize: 13 }}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={handleReset}
              disabled={loading}
              activeOpacity={0.85}
              style={{
                backgroundColor: '#C8A84B', borderRadius: 50,
                paddingVertical: 18, alignItems: 'center',
                shadowColor: '#C8A84B', shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
              }}
            >
              {loading
                ? <ActivityIndicator color="#0A0A0A" />
                : <Text style={{ color: '#0A0A0A', fontSize: 16, fontWeight: '700' }}>Update Password</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
