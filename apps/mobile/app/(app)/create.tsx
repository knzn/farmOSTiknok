import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useState, useRef } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { useAuthStore } from '../../stores/auth'
import SimpleBottomSheet, { BottomSheetScrollView, type SimpleBottomSheetRef } from '../../components/SimpleBottomSheet'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3001/api'

type Visibility = 'public' | 'unlisted' | 'private'
type Step = 'pick' | 'details'
type ActiveSheet = 'visibility' | 'bloodline' | 'derby' | null


// ─── Data ─────────────────────────────────────────────────────────────────────

const BLOODLINES = [
  'Chopsuey', 'Sweater', 'Hatch', 'Roundhead', 'Grey', 'Kelso', 'Lemon',
  'Claret', 'Whitehackle', 'Gull', 'Albany', 'Butcher', 'Radio', 'Asil',
  'SBR', 'Henny', 'White', 'Gold', 'DOM', 'Bulik', 'Lieper',
  'Miner Blue (MUG)', 'Pumpkin', 'Black', 'Blue', 'NOT in the List',
]

const DERBY_TYPES = [
  '2 Wins', '3 Wins', '4 Wins', '5 Wins', 'Hack Fight', 'Fun Run',
]

const VISIBILITY_OPTIONS: { value: Visibility; label: string; desc: string }[] = [
  { value: 'public',   label: 'Public',   desc: 'Anyone can search for and view' },
  { value: 'unlisted', label: 'Unlisted', desc: 'Anyone with the link can view' },
  { value: 'private',  label: 'Private',  desc: 'Only people who choose can view' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function SettingsRow({
  icon, label, value, onPress, required, showError,
}: {
  icon: string
  label: string
  value: string | null
  onPress: () => void
  required?: boolean
  showError?: boolean
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 17,
        borderBottomWidth: 1, borderBottomColor: '#27272A',
      }}
    >
      <Text style={{ fontSize: 20, marginRight: 14, width: 26, textAlign: 'center' }}>{icon}</Text>
      <Text style={{ flex: 1, color: '#FFFFFF', fontSize: 15 }}>
        {label}
        {required && <Text style={{ color: '#FF3D5A' }}> *</Text>}
      </Text>
      <Text style={{
        color: showError ? '#FF3D5A' : value ? '#A1A1AA' : '#555',
        fontSize: 14, marginRight: 8,
      }}>
        {value ?? (required ? 'Required' : 'Optional')}
      </Text>
      <Text style={{ color: '#555', fontSize: 20, lineHeight: 22 }}>›</Text>
    </TouchableOpacity>
  )
}

function RadioRow({
  label, subtitle, selected, onPress,
}: {
  label: string
  subtitle?: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.6}
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 16,
        borderBottomWidth: 1, borderBottomColor: '#27272A',
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>{label}</Text>
        {subtitle ? (
          <Text style={{ color: '#A1A1AA', fontSize: 13, marginTop: 3 }}>{subtitle}</Text>
        ) : null}
      </View>
      <View style={{
        width: 22, height: 22, borderRadius: 11,
        borderWidth: 2,
        borderColor: selected ? '#FF3D5A' : '#555',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {selected && (
          <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: '#FF3D5A' }} />
        )}
      </View>
    </TouchableOpacity>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CreateScreen() {
  const router = useRouter()

  const [step, setStep]             = useState<Step>('pick')
  const [media, setMedia]           = useState<ImagePicker.ImagePickerAsset | null>(null)
  const [caption, setCaption]       = useState('')
  const [visibility, setVisibility] = useState<Visibility | null>(null)
  const [bloodline, setBloodline]   = useState<string | null>(null)
  const [derbyType, setDerbyType]   = useState<string | null>(null)
  const [loading, setLoading]       = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null)

  const sheetRef = useRef<SimpleBottomSheetRef>(null)

  // ── Media helpers ────────────────────────────────────────────────────────────

  async function pickMedia() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    })
    if (!result.canceled && result.assets[0]) {
      setMedia(result.assets[0])
      setSubmitError('')
    }
  }

  // ── Sheet helpers ────────────────────────────────────────────────────────────

  function openSheet(type: ActiveSheet) {
    setActiveSheet(type)
    sheetRef.current?.expand()
  }

  // ── Upload ───────────────────────────────────────────────────────────────────

  async function handlePost() {
    if (!visibility || !bloodline) {
      setShowErrors(true)
      setSubmitError('Please fill all required fields.')
      return
    }
    if (!media) return

    setLoading(true)
    setSubmitError('')

    try {
      const formData = new FormData()
      formData.append('file', {
        uri: media.uri,
        name: media.fileName ?? 'photo.jpg',
        type: media.mimeType ?? 'image/jpeg',
      } as any)
      formData.append('caption', caption)
      formData.append('visibility', visibility)
      formData.append('bloodline', bloodline)
      if (derbyType) formData.append('derbyType', derbyType)

      const tags = caption.match(/#(\w+)/g)?.map(t => t.slice(1)) ?? []
      formData.append('hashtags', JSON.stringify(tags))

      const endpoint = `${API_URL}/posts`
      const freshToken = useAuthStore.getState().accessToken
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${freshToken}` },
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as any).message || `HTTP ${res.status}`)
      }

      router.replace('/(app)')
    } catch (e: any) {
      setSubmitError(e.message || 'Upload failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const coverUri: string | null = media?.uri ?? null

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Pick media
  // ─────────────────────────────────────────────────────────────────────────────

  if (step === 'pick') {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0F11' }}>
        {/* Header */}
        <View style={{
          paddingTop: 58, paddingBottom: 16, paddingHorizontal: 20,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          borderBottomWidth: 1, borderBottomColor: '#27272A',
        }}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={{ color: '#A1A1AA', fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>New Post</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Media picker area */}
        <TouchableOpacity
          onPress={pickMedia}
          activeOpacity={0.8}
          style={{
            marginHorizontal: 20, marginTop: 16,
            borderRadius: 16, overflow: 'hidden',
            backgroundColor: '#18181B',
            borderWidth: 1, borderColor: '#27272A',
            height: 380, alignItems: 'center', justifyContent: 'center',
          }}
        >
          {media && coverUri ? (
            <View style={{ width: '100%', height: 380 }}>
              <Image
                source={{ uri: coverUri }}
                style={{ width: '100%', height: 380 }}
                contentFit="cover"
              />
              <View style={{
                position: 'absolute', top: 10, right: 10,
                backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 999,
                paddingHorizontal: 10, paddingVertical: 5,
                flexDirection: 'row', alignItems: 'center', gap: 5,
              }}>
                <Text style={{ color: '#22C55E', fontSize: 11 }}>✓</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '600' }}>1:1 Cropped</Text>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 52 }}>📷</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Select Photo</Text>
              <Text style={{ color: '#A1A1AA', fontSize: 13 }}>From your library</Text>
            </View>
          )}
        </TouchableOpacity>

        {media && (
          <TouchableOpacity onPress={pickMedia} activeOpacity={0.7} style={{ alignItems: 'center', marginTop: 10 }}>
            <Text style={{ color: '#C8A84B', fontSize: 14, fontWeight: '600' }}>Change photo</Text>
          </TouchableOpacity>
        )}

        {/* Next button */}
        <View style={{ position: 'absolute', bottom: 40, left: 20, right: 20 }}>
          <TouchableOpacity
            onPress={() => {
              if (!media) { Alert.alert('Select photo', 'Please choose a photo first.'); return }
              setStep('details')
            }}
            activeOpacity={0.85}
            style={{
              backgroundColor: media ? '#C8A84B' : '#27272A',
              borderRadius: 28, paddingVertical: 18,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
              Next
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2 — Add Details
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#0F0F11' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={{
        paddingTop: 58, paddingBottom: 16, paddingHorizontal: 20,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderBottomWidth: 1, borderBottomColor: '#27272A',
      }}>
        <TouchableOpacity onPress={() => setStep('pick')} activeOpacity={0.7}>
          <Text style={{ color: '#FFFFFF', fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>Add Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Cover + Caption row */}
        <View style={{
          flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 16,
          borderBottomWidth: 1, borderBottomColor: '#27272A', gap: 14,
        }}>
          {/* Cover thumbnail */}
          <View style={{
            width: 80, height: 100, borderRadius: 8, overflow: 'hidden',
            backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={{ width: 80, height: 100 }} contentFit="cover" />
            ) : (
              <Text style={{ color: '#A1A1AA', fontSize: 22 }}>📷</Text>
            )}
          </View>

          {/* Caption */}
          <View style={{ flex: 1 }}>
            <TextInput
              style={{
                flex: 1, color: '#FFFFFF', fontSize: 14,
                textAlignVertical: 'top', minHeight: 100,
                backgroundColor: '#18181B', borderRadius: 8, padding: 12,
                borderWidth: 1, borderColor: '#27272A',
              }}
              placeholder="Caption your post... #hashtags"
              placeholderTextColor="#555"
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={2200}
            />
            <Text style={{ color: caption.length > 2000 ? '#FF3D5A' : '#555', fontSize: 11, textAlign: 'right', marginTop: 4 }}>
              {caption.length} / 2200
            </Text>
          </View>
        </View>

        {/* Settings rows */}
        <View style={{ marginTop: 8 }}>
          <SettingsRow
            icon="👁"
            label="Visibility"
            value={visibility ? VISIBILITY_OPTIONS.find(v => v.value === visibility)?.label ?? null : null}
            onPress={() => openSheet('visibility')}
            required
            showError={showErrors && !visibility}
          />
          <SettingsRow
            icon="🐓"
            label="Select Bloodline"
            value={bloodline}
            onPress={() => openSheet('bloodline')}
            required
            showError={showErrors && !bloodline}
          />
          <SettingsRow
            icon="🏆"
            label="Fight Type"
            value={derbyType}
            onPress={() => openSheet('derby')}
          />
        </View>

        {/* Error */}
        {submitError ? (
          <View style={{
            marginHorizontal: 20, marginTop: 16,
            backgroundColor: 'rgba(255,61,90,0.1)', borderRadius: 10,
            paddingHorizontal: 16, paddingVertical: 12,
            borderWidth: 1, borderColor: 'rgba(255,61,90,0.3)',
          }}>
            <Text style={{ color: '#FF3D5A', fontSize: 13 }}>{submitError}</Text>
          </View>
        ) : null}

      </ScrollView>

      {/* Upload button (fixed bottom) */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12,
        backgroundColor: '#0F0F11',
        borderTopWidth: 1, borderTopColor: '#27272A',
      }}>
        <TouchableOpacity
          onPress={handlePost}
          disabled={loading}
          activeOpacity={0.85}
          style={{
            backgroundColor: '#C8A84B', borderRadius: 28,
            paddingVertical: 18, alignItems: 'center', justifyContent: 'center',
          }}
        >
          {loading
            ? <ActivityIndicator color="#000000" />
            : <Text style={{ color: '#000000', fontSize: 16, fontWeight: '700' }}>Share Post</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Options Sheet (Visibility / Bloodline / Derby) */}
      <SimpleBottomSheet
        ref={sheetRef}
        snapPoints={activeSheet === 'bloodline' ? ['70%'] : ['45%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: '#18181B' }}
        handleIndicatorStyle={{ backgroundColor: '#A1A1AA' }}
      >
        <View style={{ paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#27272A' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700' }}>
            {activeSheet === 'visibility' ? 'Set Visibility'
              : activeSheet === 'bloodline' ? 'Select Bloodline'
              : 'Fight Type'}
          </Text>
        </View>

        <BottomSheetScrollView>
          {activeSheet === 'visibility' && VISIBILITY_OPTIONS.map(opt => (
            <RadioRow
              key={opt.value}
              label={opt.label}
              subtitle={opt.desc}
              selected={visibility === opt.value}
              onPress={() => { setVisibility(opt.value); sheetRef.current?.close() }}
            />
          ))}

          {activeSheet === 'bloodline' && BLOODLINES.map(b => (
            <RadioRow
              key={b}
              label={b}
              selected={bloodline === b}
              onPress={() => { setBloodline(b); sheetRef.current?.close() }}
            />
          ))}

          {activeSheet === 'derby' && DERBY_TYPES.map(d => (
            <RadioRow
              key={d}
              label={d}
              selected={derbyType === d}
              onPress={() => { setDerbyType(d); sheetRef.current?.close() }}
            />
          ))}
        </BottomSheetScrollView>
      </SimpleBottomSheet>
    </KeyboardAvoidingView>
  )
}
