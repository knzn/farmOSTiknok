import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { apiRequest } from '../../lib/api'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [sent, setSent]       = useState(false)

  async function handleSubmit() {
    setError(null)
    if (!email.trim()) return setError('Email is required')

    setLoading(true)
    try {
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim().toLowerCase() },
      })
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
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
        {/* Back */}
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={{ marginBottom: 32 }}
        >
          <Text style={{ color: '#C8A84B', fontSize: 15 }}>← Back</Text>
        </TouchableOpacity>

        {/* Heading */}
        <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginBottom: 8 }}>
          Forgot password?
        </Text>
        <Text style={{ color: '#A0A0A0', fontSize: 14, lineHeight: 22, marginBottom: 36 }}>
          Enter the email linked to your account and we'll send you a reset link.
        </Text>

        {sent ? (
          /* ── Success state ── */
          <View style={{
            backgroundColor: '#22C55E18',
            borderRadius: 16, borderWidth: 1, borderColor: '#22C55E44',
            padding: 24, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 40, marginBottom: 16 }}>📬</Text>
            <Text style={{ color: '#22C55E', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
              Check your inbox
            </Text>
            <Text style={{ color: '#A0A0A0', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              If an account exists for {email}, you'll receive a reset link shortly.
              {'\n\n'}Tap the link in the email to set a new password. It expires in 1 hour.
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
              <Text style={{ color: '#0A0A0A', fontWeight: '700', fontSize: 15 }}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Form ── */
          <View style={{ gap: 16 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#141414', borderRadius: 14,
              borderWidth: 1, borderColor: '#2A2A2A',
              paddingHorizontal: 16,
            }}>
              <TextInput
                style={inputStyle}
                placeholder="Email address"
                placeholderTextColor="#606060"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="send"
                onSubmitEditing={handleSubmit}
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
              onPress={handleSubmit}
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
                : <Text style={{ color: '#0A0A0A', fontSize: 16, fontWeight: '700' }}>Send Reset Link</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
