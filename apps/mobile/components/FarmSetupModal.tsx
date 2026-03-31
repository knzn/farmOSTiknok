import { useEffect, useRef, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

export function FarmSetupModal() {
  const [visible, setVisible] = useState(false)
  const [farmName, setFarmName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [saving, setSaving] = useState(false)
  const checked = useRef(false)

  useEffect(() => {
    if (checked.current) return
    checked.current = true
    SecureStore.getItemAsync('tiknok_farm_name').then((val) => {
      if (!val) setVisible(true)
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    await SecureStore.setItemAsync('tiknok_farm_name', farmName.trim())
    await SecureStore.setItemAsync('tiknok_owner_name', ownerName.trim())
    setSaving(false)
    setVisible(false)
  }

  function handleSkip() {
    SecureStore.setItemAsync('tiknok_farm_name', ' ') // non-empty so we don't prompt again
    setVisible(false)
  }

  if (!visible) return null

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#000000CC', justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ backgroundColor: '#18181B', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 48 }}>
          {/* Handle */}
          <View style={{ width: 36, height: 4, backgroundColor: '#3F3F46', borderRadius: 2, alignSelf: 'center', marginBottom: 24 }} />

          <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginBottom: 6 }}>
            Set Up Your Farm
          </Text>
          <Text style={{ color: '#A0A0A0', fontSize: 14, marginBottom: 28, lineHeight: 20 }}>
            Your farm name and owner name appear on markings cards and payslips. You can change these anytime.
          </Text>

          <Text style={{ color: '#A0A0A0', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Farm Name
          </Text>
          <TextInput
            style={{ backgroundColor: '#0A0A0A', color: '#FFFFFF', fontSize: 15, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 16 }}
            placeholder="e.g. Dela Cruz Farm, Bantay Inahin"
            placeholderTextColor="#606060"
            value={farmName}
            onChangeText={setFarmName}
            returnKeyType="next"
          />

          <Text style={{ color: '#A0A0A0', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            Owner Name
          </Text>
          <TextInput
            style={{ backgroundColor: '#0A0A0A', color: '#FFFFFF', fontSize: 15, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 28 }}
            placeholder="e.g. Juan Dela Cruz"
            placeholderTextColor="#606060"
            value={ownerName}
            onChangeText={setOwnerName}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || !farmName.trim()}
            activeOpacity={0.8}
            style={{ backgroundColor: farmName.trim() ? '#C8A84B' : '#2A2A2A', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 12 }}
          >
            <Text style={{ color: farmName.trim() ? '#0A0A0A' : '#606060', fontSize: 15, fontWeight: '800' }}>
              {saving ? 'Saving…' : 'Save & Continue'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={{ alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ color: '#606060', fontSize: 13 }}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
