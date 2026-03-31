import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView,
} from 'react-native'
import { apiRequest } from '../lib/api'

interface Props {
  visible: boolean
  hasPlaceholderEmail: boolean
  onClose: () => void
  onSecured: () => void
}

export function SecureAccountSheet({ visible, hasPlaceholderEmail, onClose, onSecured }: Props) {
  const [email, setEmail]                   = useState('')
  const [password, setPassword]             = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mobileNumber, setMobileNumber]     = useState('')
  const [showPassword, setShowPassword]     = useState(false)
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState<string | null>(null)

  async function handleSave() {
    setError(null)

    if (hasPlaceholderEmail && !email.trim()) return setError('Email is required')
    if (password.length < 8)                 return setError('Password must be at least 8 characters')
    if (password !== confirmPassword)        return setError('Passwords do not match')

    setLoading(true)
    try {
      await apiRequest('/auth/set-password', {
        method: 'POST',
        body: {
          password,
          email: hasPlaceholderEmail ? email.trim().toLowerCase() : undefined,
          mobileNumber: mobileNumber.trim() || undefined,
        },
      })
      onSecured()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const inputRow = {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    backgroundColor: '#1E1E1E', borderRadius: 12,
    borderWidth: 1, borderColor: '#2A2A2A',
    paddingHorizontal: 14,
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: '#0F0F0F',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          borderTopWidth: 1, borderTopColor: '#2A2A2A',
        }}>
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#3A3A3A' }} />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', flex: 1 }}>
                🔐 Secure Your Account
              </Text>
              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <Text style={{ color: '#606060', fontSize: 22 }}>×</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ color: '#A0A0A0', fontSize: 13, lineHeight: 20, marginBottom: 24 }}>
              Add a password so you can always log in — even if Google is unavailable.
            </Text>

            <View style={{ gap: 12 }}>
              {/* Email — only if placeholder */}
              {hasPlaceholderEmail && (
                <View style={inputRow}>
                  <TextInput
                    style={{ flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 14 }}
                    placeholder="Email address"
                    placeholderTextColor="#606060"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>
              )}

              {/* Password */}
              <View style={inputRow}>
                <TextInput
                  style={{ flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 14 }}
                  placeholder="New password (8+ characters)"
                  placeholderTextColor="#606060"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} activeOpacity={0.7}>
                  <Text style={{ color: '#606060', fontSize: 13 }}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>

              {/* Confirm */}
              <View style={inputRow}>
                <TextInput
                  style={{ flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 14 }}
                  placeholder="Confirm password"
                  placeholderTextColor="#606060"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>

              {/* Mobile number (optional) */}
              <View style={inputRow}>
                <TextInput
                  style={{ flex: 1, color: '#FFFFFF', fontSize: 15, paddingVertical: 14 }}
                  placeholder="Mobile number (optional)"
                  placeholderTextColor="#606060"
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  keyboardType="phone-pad"
                />
              </View>

              {error ? (
                <View style={{
                  backgroundColor: '#EF444418', borderRadius: 10,
                  paddingHorizontal: 14, paddingVertical: 10,
                  borderWidth: 1, borderColor: '#EF444440',
                }}>
                  <Text style={{ color: '#EF4444', fontSize: 13 }}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                onPress={handleSave}
                disabled={loading}
                activeOpacity={0.85}
                style={{
                  backgroundColor: '#C8A84B', borderRadius: 50,
                  paddingVertical: 16, alignItems: 'center', marginTop: 4,
                }}
              >
                {loading
                  ? <ActivityIndicator color="#0A0A0A" />
                  : <Text style={{ color: '#0A0A0A', fontSize: 15, fontWeight: '800' }}>Save & Secure Account</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity onPress={onClose} activeOpacity={0.6} style={{ alignItems: 'center', paddingVertical: 8 }}>
                <Text style={{ color: '#606060', fontSize: 13 }}>Remind me later</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
