import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { apiRequest } from '../../../lib/api'
import { useAuthStore } from '../../../stores/auth'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3001/api'

interface UserProfile {
  id: string
  username: string
  profilePhoto: string | null
  coverPhoto: string | null
  bio: string
  location: string
  isBreeder: boolean
}

export default function EditProfileScreen() {
  const router = useRouter()
  const currentUserId = useAuthStore(s => s.userId)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [coverUri, setCoverUri] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest<UserProfile>(`/users/${currentUserId}`)
      .then(data => {
        setProfile(data)
        setUsername(data.username)
        setBio(data.bio ?? '')
        setLocation(data.location ?? '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentUserId])

  async function pickCover() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setCoverUri(asset.uri)
      setUploadingCover(true)
      try {
        const formData = new FormData()
        formData.append('file', {
          uri: asset.uri,
          name: asset.fileName ?? 'cover.jpg',
          type: asset.mimeType ?? 'image/jpeg',
        } as any)
        const freshToken = useAuthStore.getState().accessToken
        const res = await fetch(`${API_URL}/users/me/cover`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${freshToken}` },
          body: formData,
        })
        if (!res.ok) throw new Error('Upload failed')
        const updated = await res.json()
        setProfile(updated)
      } catch {
        setCoverUri(null)
        Alert.alert('Upload failed', 'Could not upload cover photo. Try again.')
      } finally {
        setUploadingCover(false)
      }
    }
  }

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      setAvatarUri(asset.uri)
      setUploadingAvatar(true)
      try {
        const formData = new FormData()
        formData.append('file', {
          uri: asset.uri,
          name: asset.fileName ?? 'avatar.jpg',
          type: asset.mimeType ?? 'image/jpeg',
        } as any)
        const freshToken = useAuthStore.getState().accessToken
        const res = await fetch(`${API_URL}/users/me/avatar`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${freshToken}` },
          body: formData,
        })
        if (!res.ok) throw new Error('Upload failed')
        const updated = await res.json()
        setProfile(updated)
      } catch {
        setAvatarUri(null)
        Alert.alert('Upload failed', 'Could not upload avatar. Try again.')
      } finally {
        setUploadingAvatar(false)
      }
    }
  }

  async function handleSave() {
    if (!username.trim()) { setError('Username is required'); return }
    if (!/^[a-z0-9_]{3,30}$/.test(username.trim())) {
      setError('Username: 3-30 chars, lowercase letters, numbers, underscores only')
      return
    }
    setSaving(true)
    setError('')
    try {
      await apiRequest('/users/me', {
        method: 'PATCH',
        body: { username: username.trim(), bio: bio.trim(), location: location.trim() },
      })
      router.back()
    } catch (e: any) {
      setError(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator color="#FF3D5A" />
      </View>
    )
  }

  const avatarSource = avatarUri ?? profile?.profilePhoto
  const coverSource = coverUri ?? profile?.coverPhoto

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-canvas"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View className="pt-14 pb-4 px-4 flex-row items-center justify-between border-b border-rim">
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text className="text-ink-2 text-base">Cancel</Text>
          </TouchableOpacity>
          <Text className="text-ink text-lg font-semibold">Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.7}>
            {saving
              ? <ActivityIndicator color="#FF3D5A" size="small" />
              : <Text className="text-accent text-base font-semibold">Save</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Cover photo */}
        <TouchableOpacity onPress={pickCover} activeOpacity={0.85} style={{ width: '100%', height: 130, backgroundColor: '#18181B' }}>
          {coverSource ? (
            <Image source={{ uri: coverSource }} style={{ width: '100%', height: 130 }} contentFit="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Text style={{ fontSize: 24 }}>🖼</Text>
              <Text style={{ color: '#555', fontSize: 12 }}>Tap to add cover photo</Text>
            </View>
          )}
          {uploadingCover && (
            <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#FF3D5A" />
            </View>
          )}
          {coverSource && !uploadingCover && (
            <View style={{ position: 'absolute', bottom: 8, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600' }}>Change cover</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Avatar */}
        <View className="items-center py-6">
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8}>
            <View className="w-24 h-24 rounded-full bg-accent-muted items-center justify-center overflow-hidden">
              {uploadingAvatar ? (
                <ActivityIndicator color="#FF3D5A" />
              ) : avatarSource ? (
                <Image source={{ uri: avatarSource }} style={{ width: 96, height: 96 }} />
              ) : (
                <Text className="text-accent text-4xl font-bold">
                  {username?.[0]?.toUpperCase() ?? '?'}
                </Text>
              )}
            </View>
            <View className="absolute bottom-0 right-0 bg-accent rounded-full w-7 h-7 items-center justify-center border-2 border-canvas">
              <Text className="text-white text-xs font-bold">✎</Text>
            </View>
          </TouchableOpacity>
          <Text className="text-ink-2 text-xs mt-2">Tap to change photo</Text>
        </View>

        {/* Fields */}
        <View className="px-4 gap-4">
          <View>
            <Text className="text-ink-2 text-xs mb-1.5 uppercase tracking-wide">Username</Text>
            <TextInput
              className="bg-card rounded-xl px-4 py-3 text-ink text-base border border-rim"
              value={username}
              onChangeText={t => setUsername(t.toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
              placeholder="username"
              placeholderTextColor="#A1A1AA"
            />
          </View>

          <View>
            <Text className="text-ink-2 text-xs mb-1.5 uppercase tracking-wide">Bio</Text>
            <TextInput
              className="bg-card rounded-xl px-4 py-3 text-ink text-base border border-rim"
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={150}
              placeholder="Tell the community about yourself..."
              placeholderTextColor="#A1A1AA"
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
            <Text className="text-ink-2 text-xs text-right mt-1">{bio.length}/150</Text>
          </View>

          <View>
            <Text className="text-ink-2 text-xs mb-1.5 uppercase tracking-wide">Location</Text>
            <TextInput
              className="bg-card rounded-xl px-4 py-3 text-ink text-base border border-rim"
              value={location}
              onChangeText={setLocation}
              placeholder="City, Province"
              placeholderTextColor="#A1A1AA"
              maxLength={60}
            />
          </View>

          {error ? (
            <View className="bg-accent-muted rounded-lg px-4 py-3 border border-accent/30">
              <Text className="text-accent text-sm">{error}</Text>
            </View>
          ) : null}
        </View>

        <View className="h-10" />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
