import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Switch,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/auth'
import { apiRequest } from '../../lib/api'

type AuthResponse = {
  accessToken: string
  refreshToken: string
  user: { _id: string }
}

export default function RegisterScreen() {
  const [username, setUsername]           = useState('')
  const [email, setEmail]                 = useState('')
  const [password, setPassword]           = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isBreeder, setIsBreeder]         = useState(false)
  const [showPassword, setShowPassword]   = useState(false)
  const [showConfirm, setShowConfirm]     = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [loading, setLoading]             = useState(false)

  const setTokens = useAuthStore((s) => s.setTokens)
  const router    = useRouter()

  async function handleRegister() {
    setError(null)
    if (!username.trim())                         return setError('Username is required')
    if (!/^[a-z0-9_]+$/.test(username.trim()))    return setError('Username: lowercase, numbers, underscores only')
    if (username.trim().length < 3)               return setError('Username must be at least 3 characters')
    if (!email.trim())                            return setError('Email is required')
    if (password.length < 8)                      return setError('Password must be at least 8 characters')
    if (password !== confirmPassword)             return setError('Passwords do not match')

    setLoading(true)
    try {
      const data = await apiRequest<AuthResponse>('/auth/register', {
        method: 'POST',
        body: { username: username.trim().toLowerCase(), email: email.trim().toLowerCase(), password, isBreeder },
      })
      await setTokens(data.accessToken, data.refreshToken, data.user._id)
      router.replace('/(app)')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    flex: 1, color: '#FFFFFF' as const, fontSize: 15, paddingVertical: 16,
  }
  const rowStyle = {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    backgroundColor: '#18181B', borderRadius: 14,
    borderWidth: 1, borderColor: '#27272A',
    paddingHorizontal: 16,
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
        <View style={{ alignItems: 'center', marginBottom: 36 }}>
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
            Create your account
          </Text>
        </View>

        {/* Form */}
        <View style={{ gap: 12 }}>

          {/* Username */}
          <View style={rowStyle}>
            <Text style={{ color: '#555', fontSize: 16, marginRight: 10 }}>👤</Text>
            <TextInput
              style={inputStyle}
              placeholder="Username"
              placeholderTextColor="#555"
              value={username}
              onChangeText={(v) => setUsername(v.toLowerCase())}
              autoCapitalize="none"
              autoComplete="username-new"
              returnKeyType="next"
            />
          </View>

          {/* Email */}
          <View style={rowStyle}>
            <Text style={{ color: '#555', fontSize: 16, marginRight: 10 }}>@</Text>
            <TextInput
              style={inputStyle}
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
          <View style={rowStyle}>
            <Text style={{ color: '#555', fontSize: 16, marginRight: 10 }}>🔒</Text>
            <TextInput
              style={inputStyle}
              placeholder="Password (8+ characters)"
              placeholderTextColor="#555"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              returnKeyType="next"
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} activeOpacity={0.7} style={{ padding: 4 }}>
              <Text style={{ fontSize: 18, opacity: showPassword ? 1 : 0.4 }}>👁</Text>
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <View style={rowStyle}>
            <Text style={{ color: '#555', fontSize: 16, marginRight: 10 }}>🔒</Text>
            <TextInput
              style={inputStyle}
              placeholder="Confirm password"
              placeholderTextColor="#555"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
              autoComplete="new-password"
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />
            <TouchableOpacity onPress={() => setShowConfirm(v => !v)} activeOpacity={0.7} style={{ padding: 4 }}>
              <Text style={{ fontSize: 18, opacity: showConfirm ? 1 : 0.4 }}>👁</Text>
            </TouchableOpacity>
          </View>

          {/* Breeder toggle */}
          <View style={{
            backgroundColor: '#18181B', borderRadius: 14,
            borderWidth: 1, borderColor: '#27272A',
            paddingHorizontal: 16, paddingVertical: 14,
            flexDirection: 'row', alignItems: 'center',
          }}>
            <Text style={{ fontSize: 22, marginRight: 12 }}>🐓</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>I'm a Breeder</Text>
              <Text style={{ color: '#A1A1AA', fontSize: 12, marginTop: 2 }}>
                Unlocks the Breeder module
              </Text>
            </View>
            <Switch
              value={isBreeder}
              onValueChange={setIsBreeder}
              trackColor={{ false: '#27272A', true: '#FF3D5A' }}
              thumbColor="#FFFFFF"
            />
          </View>

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

          {/* Create account button */}
          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
            style={{
              backgroundColor: '#FF3D5A', borderRadius: 50,
              paddingVertical: 18, alignItems: 'center',
              marginTop: 4,
              shadowColor: '#FF3D5A', shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
            }}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 }}>
                  Create Account
                </Text>
            }
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 28, gap: 12 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: '#27272A' }} />
          <Text style={{ color: '#555', fontSize: 13 }}>or</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: '#27272A' }} />
        </View>

        {/* Sign in link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: '#A1A1AA', fontSize: 14 }}>Already have an account?</Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={{ color: '#FF3D5A', fontSize: 14, fontWeight: '700' }}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
