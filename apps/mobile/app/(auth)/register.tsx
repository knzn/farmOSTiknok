import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Switch, Image,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import { useAuthStore } from '../../stores/auth'
import { apiRequest } from '../../lib/api'
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn'

type AuthResponse = {
  accessToken: string
  refreshToken: string
  user: { _id: string }
}

export default function RegisterScreen() {
  const [showEmailForm, setShowEmailForm]   = useState(false)
  const [username, setUsername]             = useState('')
  const [email, setEmail]                   = useState('')
  const [password, setPassword]             = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isBreeder, setIsBreeder]           = useState(false)
  const [showPassword, setShowPassword]     = useState(false)
  const [showConfirm, setShowConfirm]       = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [loading, setLoading]               = useState(false)

  const setTokens = useAuthStore((s) => s.setTokens)
  const router    = useRouter()

  const { signIn: googleSignIn, loading: googleLoading, error: googleError } = useGoogleSignIn(
    () => router.replace('/(app)')
  )

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
    backgroundColor: '#141414', borderRadius: 14,
    borderWidth: 1, borderColor: '#2A2A2A',
    paddingHorizontal: 16,
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
            Create your account
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
            {showEmailForm ? '▲  Hide email sign up' : 'or sign up with email'}
          </Text>
        </TouchableOpacity>

        {/* Collapsible email form */}
        {showEmailForm && (
          <View style={{ gap: 12 }}>

            {/* Username */}
            <View style={rowStyle}>
              <Text style={{ color: '#606060', fontSize: 16, marginRight: 10 }}>👤</Text>
              <TextInput
                style={inputStyle}
                placeholder="Username"
                placeholderTextColor="#606060"
                value={username}
                onChangeText={(v) => setUsername(v.toLowerCase())}
                autoCapitalize="none"
                autoComplete="username-new"
                returnKeyType="next"
              />
            </View>

            {/* Email */}
            <View style={rowStyle}>
              <Text style={{ color: '#606060', fontSize: 16, marginRight: 10 }}>@</Text>
              <TextInput
                style={inputStyle}
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
            <View style={rowStyle}>
              <Text style={{ color: '#606060', fontSize: 16, marginRight: 10 }}>🔒</Text>
              <TextInput
                style={inputStyle}
                placeholder="Password (8+ characters)"
                placeholderTextColor="#606060"
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
              <Text style={{ color: '#606060', fontSize: 16, marginRight: 10 }}>🔒</Text>
              <TextInput
                style={inputStyle}
                placeholder="Confirm password"
                placeholderTextColor="#606060"
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
              backgroundColor: '#141414', borderRadius: 14,
              borderWidth: 1, borderColor: '#2A2A2A',
              paddingHorizontal: 16, paddingVertical: 14,
              flexDirection: 'row', alignItems: 'center',
            }}>
              <Text style={{ fontSize: 22, marginRight: 12 }}>🐓</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>I'm a Breeder</Text>
                <Text style={{ color: '#A0A0A0', fontSize: 12, marginTop: 2 }}>
                  Unlocks the Breeder module
                </Text>
              </View>
              <Switch
                value={isBreeder}
                onValueChange={setIsBreeder}
                trackColor={{ false: '#2A2A2A', true: '#C8A84B' }}
                thumbColor="#FFFFFF"
              />
            </View>

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

            {/* Create account button */}
            <TouchableOpacity
              onPress={handleRegister}
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
                    Create Account
                  </Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Sign in link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 32 }}>
          <Text style={{ color: '#A0A0A0', fontSize: 14 }}>Already have an account?</Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={{ color: '#C8A84B', fontSize: 14, fontWeight: '700' }}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
