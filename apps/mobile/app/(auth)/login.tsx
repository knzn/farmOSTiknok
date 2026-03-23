import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/auth'
import { apiRequest } from '../../lib/api'

type LoginResponse = {
  accessToken: string
  refreshToken: string
  user: { _id: string }
}

export default function LoginScreen() {
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [loading, setLoading]         = useState(false)

  const setTokens = useAuthStore((s) => s.setTokens)
  const router    = useRouter()

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
      style={{ flex: 1, backgroundColor: '#0F0F11' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 24,
            backgroundColor: '#FF3D5A', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20,
            shadowColor: '#FF3D5A', shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
          }}>
            <Text style={{ fontSize: 40 }}>🐓</Text>
          </View>
          <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '800', letterSpacing: 3 }}>
            TIKNOK
          </Text>
          <Text style={{ color: '#A1A1AA', fontSize: 14, marginTop: 6 }}>
            For breeders and enthusiasts
          </Text>
        </View>

        {/* Form */}
        <View style={{ gap: 14 }}>

          {/* Email */}
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: '#18181B', borderRadius: 14,
            borderWidth: 1, borderColor: '#27272A',
            paddingHorizontal: 16,
          }}>
            <Text style={{ color: '#555', fontSize: 16, marginRight: 10 }}>@</Text>
            <TextInput
              style={{ flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 16 }}
              placeholder="Email address"
              placeholderTextColor="#555"
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
            backgroundColor: '#18181B', borderRadius: 14,
            borderWidth: 1, borderColor: '#27272A',
            paddingHorizontal: 16,
          }}>
            <Text style={{ color: '#555', fontSize: 16, marginRight: 10 }}>🔒</Text>
            <TextInput
              style={{ flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 16 }}
              placeholder="Password"
              placeholderTextColor="#555"
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
          <TouchableOpacity activeOpacity={0.7} style={{ alignSelf: 'flex-end', marginTop: -4 }}>
            <Text style={{ color: '#FF3D5A', fontSize: 13, fontWeight: '600' }}>
              Forgot password?
            </Text>
          </TouchableOpacity>

          {/* Error */}
          {error ? (
            <View style={{
              backgroundColor: 'rgba(255,61,90,0.1)', borderRadius: 12,
              paddingHorizontal: 16, paddingVertical: 12,
              borderWidth: 1, borderColor: 'rgba(255,61,90,0.3)',
            }}>
              <Text style={{ color: '#FF3D5A', fontSize: 13 }}>{error}</Text>
            </View>
          ) : null}

          {/* Sign In button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
            style={{
              backgroundColor: '#FF3D5A', borderRadius: 50,
              paddingVertical: 18, alignItems: 'center',
              marginTop: 6,
              shadowColor: '#FF3D5A', shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
            }}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 }}>
                  Sign In
                </Text>
            }
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 32, gap: 12 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: '#27272A' }} />
          <Text style={{ color: '#555', fontSize: 13 }}>or</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: '#27272A' }} />
        </View>

        {/* Sign up link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: '#A1A1AA', fontSize: 14 }}>New to Tiknok?</Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={{ color: '#FF3D5A', fontSize: 14, fontWeight: '700' }}>Create account</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
