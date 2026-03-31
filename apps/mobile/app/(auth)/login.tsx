import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Image,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/auth'
import { apiRequest } from '../../lib/api'
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn'

type LoginResponse = {
  accessToken: string
  refreshToken: string
  user: { _id: string }
}

export default function LoginScreen() {
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [loading, setLoading]           = useState(false)

  const setTokens = useAuthStore((s) => s.setTokens)
  const router    = useRouter()

  const { signIn: googleSignIn, loading: googleLoading, error: googleError } = useGoogleSignIn(
    () => router.replace('/(app)')
  )

  async function handleLogin() {
    setError(null)
    if (!email.trim())  return setError('Email is required')
    if (!password)      return setError('Password is required')
    setLoading(true)
    try {
      const data = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body: { email: email.trim().toLowerCase(), password },
      })
      await setTokens(data.accessToken, data.refreshToken, data.user._id)
      router.replace('/(app)')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0A0A0A' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <Image
            source={require('../../assets/wordmark.png')}
            style={{ width: 260, height: 80 }}
            resizeMode="contain"
          />
          <Text style={{ color: '#A0A0A0', fontSize: 14, marginTop: 12 }}>
            For breeders and enthusiasts
          </Text>
        </View>

        {/* Google — primary CTA */}
        {googleError ? (
          <View style={{
            backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12,
            paddingHorizontal: 16, paddingVertical: 10, marginBottom: 12,
            borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
          }}>
            <Text style={{ color: '#EF4444', fontSize: 13 }}>{googleError}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={googleSignIn}
          disabled={googleLoading}
          activeOpacity={0.85}
          style={{
            backgroundColor: '#FFFFFF', borderRadius: 50,
            paddingVertical: 18, alignItems: 'center',
            flexDirection: 'row', justifyContent: 'center', gap: 10,
            shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
            marginBottom: 14,
          }}
        >
          {googleLoading
            ? <ActivityIndicator color="#1a1a1a" />
            : <>
                <Text style={{ fontSize: 18 }}>G</Text>
                <Text style={{ color: '#1a1a1a', fontSize: 16, fontWeight: '800' }}>Continue with Google</Text>
              </>
          }
        </TouchableOpacity>

        {/* Email form toggle */}
        <TouchableOpacity
          onPress={() => { setShowEmailForm(v => !v); setError(null) }}
          activeOpacity={0.7}
          style={{ alignItems: 'center', paddingVertical: 12, marginBottom: 4 }}
        >
          <Text style={{ color: '#606060', fontSize: 13 }}>
            {showEmailForm ? '▲  Hide email sign in' : 'or sign in with email'}
          </Text>
        </TouchableOpacity>

        {/* Collapsible email / password form */}
        {showEmailForm && (
          <View style={{ gap: 14, marginTop: 4 }}>
            {/* Email */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#141414', borderRadius: 14,
              borderWidth: 1, borderColor: '#2A2A2A',
              paddingHorizontal: 16,
            }}>
              <Text style={{ color: '#606060', fontSize: 16, marginRight: 10 }}>@</Text>
              <TextInput
                style={{ flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 16 }}
                placeholder="Email address"
                placeholderTextColor="#606060"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
              />
            </View>

            {/* Password */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#141414', borderRadius: 14,
              borderWidth: 1, borderColor: '#2A2A2A',
              paddingHorizontal: 16,
            }}>
              <Text style={{ color: '#606060', fontSize: 16, marginRight: 10 }}>🔒</Text>
              <TextInput
                style={{ flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 16 }}
                placeholder="Password"
                placeholderTextColor="#606060"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(v => !v)}
                activeOpacity={0.7}
                style={{ padding: 4 }}
              >
                <Text style={{ fontSize: 18, opacity: showPassword ? 1 : 0.4 }}>👁</Text>
              </TouchableOpacity>
            </View>

            {/* Forgot password */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={{ alignSelf: 'flex-end', marginTop: -4 }}
              onPress={() => router.push('/(auth)/forgot-password' as any)}
            >
              <Text style={{ color: '#C8A84B', fontSize: 13, fontWeight: '600' }}>
                Forgot password?
              </Text>
            </TouchableOpacity>

            {/* Error */}
            {error ? (
              <View style={{
                backgroundColor: 'rgba(200,168,75,0.1)', borderRadius: 12,
                paddingHorizontal: 16, paddingVertical: 12,
                borderWidth: 1, borderColor: 'rgba(200,168,75,0.3)',
              }}>
                <Text style={{ color: '#C8A84B', fontSize: 13 }}>{error}</Text>
              </View>
            ) : null}

            {/* Sign In button */}
            <TouchableOpacity
              onPress={handleLogin}
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
                : <Text style={{ color: '#0A0A0A', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 }}>
                    Sign In
                  </Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Sign up link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 32 }}>
          <Text style={{ color: '#A0A0A0', fontSize: 14 }}>New to Tiknok?</Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={{ color: '#C8A84B', fontSize: 14, fontWeight: '700' }}>Create account</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
