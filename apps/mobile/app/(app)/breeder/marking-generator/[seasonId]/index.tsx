import { useRef, useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { captureRef } from 'react-native-view-shot'
import * as MediaLibrary from 'expo-media-library'
import * as SecureStore from 'expo-secure-store'
import SimpleBottomSheet, {
  BottomSheetScrollView,
  type SimpleBottomSheetRef,
} from '../../../../../components/SimpleBottomSheet'
import MarkingExportCard, { type SeasonTotals } from '../../../../../components/MarkingExportCard'
import { apiRequest, apiUpload } from '../../../../../lib/api'

type Season = {
  _id: string
  name: string
  year: number
  markingsGenerated: boolean
  eggsLaid: number | null
  expectedHatchDate: string | null
}

type Hen = {
  _id: string
  henName: string
  marking: string | null
  previousMarking: string | null
  photo: string | null
  eggsLaid: number | null
  chicksHatched: number | null
  maleCount: number | null
  femaleCount: number | null
}

type Mating = {
  _id: string
  maleName: string
  sameMarking: boolean | null
  mandatoryMarking: string | null
  noseGroup: string | null
  malePhoto: string | null
  hens: Hen[]
  useIndividualHenCount: boolean
  penEggsLaid: number | null
  penChicksHatched: number | null
  penMaleCount: number | null
  penFemaleCount: number | null
  totalEggsLaid: number | null
  totalChicksHatched: number | null
  totalMaleCount: number | null
  totalFemaleCount: number | null
}

type EditValues = { eggs: string; hatched: string; males: string; females: string }

// Compute season-level totals by summing across all matings
function computeSeasonTotals(matings: Mating[]) {
  let eggs = 0, hatched = 0, males = 0, females = 0
  let hasEggs = false, hasHatch = false, hasSex = false
  for (const m of matings) {
    if (m.totalEggsLaid !== null) { eggs += m.totalEggsLaid; hasEggs = true }
    if (m.totalChicksHatched !== null) { hatched += m.totalChicksHatched; hasHatch = true }
    if (m.totalMaleCount !== null) { males += m.totalMaleCount; hasSex = true }
    if (m.totalFemaleCount !== null) { females += m.totalFemaleCount; hasSex = true }
  }
  return {
    eggsLaid: hasEggs ? eggs : null,
    chicksHatched: hasHatch ? hatched : null,
    hatchRate: hasEggs && hasHatch && eggs > 0 ? Math.round((hatched / eggs) * 1000) / 10 : null,
    maleCount: hasSex ? males : null,
    femaleCount: hasSex ? females : null,
  }
}

function validateEdit(v: EditValues, label?: string): string | null {
  const e = v.eggs    !== '' ? parseInt(v.eggs)    : null
  const h = v.hatched !== '' ? parseInt(v.hatched) : null
  const m = v.males   !== '' ? parseInt(v.males)   : null
  const f = v.females !== '' ? parseInt(v.females) : null
  const prefix = label ? `${label}: ` : ''
  if (e !== null && h !== null && h > e)
    return `${prefix}Hatched (${h}) cannot exceed eggs laid (${e})`
  if (h !== null && m !== null && f !== null && m + f > h)
    return `${prefix}Males + females (${m + f}) cannot exceed hatched (${h})`
  if (h !== null && m !== null && f === null && m > h)
    return `${prefix}Males (${m}) cannot exceed hatched (${h})`
  if (h !== null && f !== null && m === null && f > h)
    return `${prefix}Females (${f}) cannot exceed hatched (${h})`
  return null
}

export default function SeasonScreen() {
  const { seasonId } = useLocalSearchParams<{ seasonId: string }>()
  const router = useRouter()
  const detailSheetRef = useRef<SimpleBottomSheetRef>(null)
  const seasonCardRef = useRef<View>(null)
  const matingCardRef = useRef<View>(null)
  const exportSheetRef = useRef<SimpleBottomSheetRef>(null)

  const [season, setSeason] = useState<Season | null>(null)
  const [matings, setMatings] = useState<Mating[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMating, setSelectedMating] = useState<Mating | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deletingSeason, setDeletingSeason] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [exportTarget, setExportTarget] = useState<'season' | 'mating'>('season')

  // Export card customization
  const [farmName, setFarmName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [includeBreedingTotals, setIncludeBreedingTotals] = useState(true)

  useEffect(() => {
    SecureStore.getItemAsync('tiknok_farm_name').then((v) => v && setFarmName(v))
    SecureStore.getItemAsync('tiknok_owner_name').then((v) => v && setOwnerName(v))
  }, [])

  // Single sheet, two modes: 'detail' shows hen list, 'edit' shows the count form
  const [sheetMode, setSheetMode] = useState<'detail' | 'edit'>('detail')
  const [editTarget, setEditTarget] = useState<{ type: 'hen'; hen: Hen } | { type: 'pen' } | null>(null)
  const [editValues, setEditValues] = useState<EditValues>({ eggs: '', hatched: '', males: '', females: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Photo viewer
  const [photoModal, setPhotoModal] = useState<{ uri: string; title: string } | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null)


  async function loadData() {
    try {
      setError(null)
      const [s, m] = await Promise.all([
        apiRequest<Season>(`/seasons/${seasonId}`),
        apiRequest<Mating[]>(`/seasons/${seasonId}/matings`),
      ])
      setSeason(s)
      setMatings(m)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      loadData()
    }, [seasonId]),
  )

  function openMatingDetail(mating: Mating) {
    setSelectedMating(mating)
    setSheetMode('detail')
    setEditTarget(null)
    setEditError(null)
    detailSheetRef.current?.expand()
  }

  function openHenEdit(hen: Hen) {
    setEditTarget({ type: 'hen', hen })
    setEditValues({
      eggs:    hen.eggsLaid      != null ? String(hen.eggsLaid)      : '',
      hatched: hen.chicksHatched != null ? String(hen.chicksHatched) : '',
      males:   hen.maleCount     != null ? String(hen.maleCount)     : '',
      females: hen.femaleCount   != null ? String(hen.femaleCount)   : '',
    })
    setEditError(null)
    setSheetMode('edit')
  }

  function openPenEdit(mating: Mating) {
    setEditTarget({ type: 'pen' })
    setEditValues({
      eggs:    mating.penEggsLaid      != null ? String(mating.penEggsLaid)      : '',
      hatched: mating.penChicksHatched != null ? String(mating.penChicksHatched) : '',
      males:   mating.penMaleCount     != null ? String(mating.penMaleCount)     : '',
      females: mating.penFemaleCount   != null ? String(mating.penFemaleCount)   : '',
    })
    setEditError(null)
    setSheetMode('edit')
  }

  function updateEdit(field: keyof EditValues, val: string) {
    setEditValues((prev) => ({ ...prev, [field]: val.replace(/[^0-9]/g, '') }))
    setEditError(null)
  }

  async function handleSaveHen(hen: Hen, mating: Mating) {
    const err = validateEdit(editValues, hen.henName)
    if (err) { setEditError(err); return }
    setEditSaving(true)
    try {
      const updated = await apiRequest<Mating>(
        `/seasons/${seasonId}/matings/${mating._id}/lifecycle`,
        {
          method: 'PATCH',
          body: {
            useIndividualHenCount: true,
            hens: [{
              henId: hen._id,
              eggsLaid:      editValues.eggs    !== '' ? parseInt(editValues.eggs)    : null,
              chicksHatched: editValues.hatched !== '' ? parseInt(editValues.hatched) : null,
              maleCount:     editValues.males   !== '' ? parseInt(editValues.males)   : null,
              femaleCount:   editValues.females !== '' ? parseInt(editValues.females) : null,
            }],
          },
        },
      )
      setMatings((prev) => prev.map((m) => m._id === updated._id ? updated : m))
      setSelectedMating(updated)
      setSheetMode('detail')
      refreshSeason()
    } catch (e: any) {
      setEditError(e.message || 'Save failed')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleSavePen(mating: Mating) {
    const err = validateEdit(editValues)
    if (err) { setEditError(err); return }
    setEditSaving(true)
    try {
      const updated = await apiRequest<Mating>(
        `/seasons/${seasonId}/matings/${mating._id}/lifecycle`,
        {
          method: 'PATCH',
          body: {
            useIndividualHenCount: false,
            penEggsLaid:      editValues.eggs    !== '' ? parseInt(editValues.eggs)    : null,
            penChicksHatched: editValues.hatched !== '' ? parseInt(editValues.hatched) : null,
            penMaleCount:     editValues.males   !== '' ? parseInt(editValues.males)   : null,
            penFemaleCount:   editValues.females !== '' ? parseInt(editValues.females) : null,
          },
        },
      )
      setMatings((prev) => prev.map((m) => m._id === updated._id ? updated : m))
      setSelectedMating(updated)
      setSheetMode('detail')
      refreshSeason()
    } catch (e: any) {
      setEditError(e.message || 'Save failed')
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDeleteSeason() {
    if (!season) return
    Alert.alert('Delete Season', `Delete "${season.name}" and all its matings? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingSeason(true)
          try {
            await apiRequest(`/seasons/${seasonId}`, { method: 'DELETE' })
            router.back()
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to delete season')
          } finally {
            setDeletingSeason(false)
          }
        },
      },
    ])
  }

  async function refreshSeason() {
    const s = await apiRequest<Season>(`/seasons/${seasonId}`)
    setSeason(s)
  }

  function handleShareSeason() {
    setExportTarget('season')
    exportSheetRef.current?.expand()
  }

  function handleShareMating() {
    setExportTarget('mating')
    exportSheetRef.current?.expand()
  }

  async function handleConfirmExport() {
    const ref = exportTarget === 'season' ? seasonCardRef : matingCardRef
    if (!ref.current) return
    setSaving(true)
    try {
      await SecureStore.setItemAsync('tiknok_farm_name', farmName)
      await SecureStore.setItemAsync('tiknok_owner_name', ownerName)
      exportSheetRef.current?.close()
      await new Promise((r) => setTimeout(r, 350))
      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow access to your photo library to save markings.')
        return
      }
      const uri = await captureRef(ref, { format: 'png', quality: 1 })
      await MediaLibrary.saveToLibraryAsync(uri)
      Alert.alert('Saved!', 'Card saved to your Photos.')
    } catch {
      Alert.alert('Error', 'Could not save image. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteMating() {
    if (!selectedMating) return
    Alert.alert('Delete Mating', `Remove "${selectedMating.maleName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true)
          try {
            await apiRequest(`/seasons/${seasonId}/matings/${selectedMating._id}`, { method: 'DELETE' })
            detailSheetRef.current?.close()
            setMatings((prev) => prev.filter((m) => m._id !== selectedMating._id))
          } finally {
            setDeleting(false)
          }
        },
      },
    ])
  }

  async function handleKeepPrevious(mating: Mating, prevMarking: string) {
    try {
      const updated = await apiRequest<Mating>(
        `/seasons/${seasonId}/matings/${mating._id}`,
        { method: 'PATCH', body: { mandatoryMarking: prevMarking } },
      )
      setMatings((prev) => prev.map((m) => m._id === updated._id ? updated : m))
      setSelectedMating(updated)
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to set marking')
    }
  }

  async function pickAndUpload(endpoint: string, trackKey: string) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload photos.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (result.canceled) return
    setUploadingPhoto(trackKey)
    try {
      const updated = await apiUpload<Mating>(`/seasons/${seasonId}/${endpoint}`, result.assets[0]!.uri)
      setMatings((prev) => prev.map((m) => m._id === updated._id ? updated : m))
      if (selectedMating?._id === updated._id) setSelectedMating(updated)
    } catch (e: any) {
      Alert.alert('Upload failed', e.message || 'Try again')
    } finally {
      setUploadingPhoto(null)
    }
  }

  async function handleMalePhotoTap(mating: Mating) {
    if (mating.malePhoto) {
      Alert.alert(mating.maleName, 'Photo options', [
        { text: 'View Photo', onPress: () => setPhotoModal({ uri: mating.malePhoto!, title: mating.maleName }) },
        { text: 'Change Photo', onPress: () => pickAndUpload(`matings/${mating._id}/photo`, `male_${mating._id}`) },
        { text: 'Remove Photo', style: 'destructive', onPress: async () => {
          try {
            const updated = await apiRequest<Mating>(`/seasons/${seasonId}/matings/${mating._id}/photo`, { method: 'DELETE' })
            setMatings((prev) => prev.map((m) => m._id === updated._id ? updated : m))
            if (selectedMating?._id === updated._id) setSelectedMating(updated)
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to remove photo')
          }
        }},
        { text: 'Cancel', style: 'cancel' },
      ])
    } else {
      pickAndUpload(`matings/${mating._id}/photo`, `male_${mating._id}`)
    }
  }

  async function handleHenPhotoTap(mating: Mating, hen: Hen) {
    if (hen.photo) {
      Alert.alert(hen.henName, 'Photo options', [
        { text: 'View Photo', onPress: () => setPhotoModal({ uri: hen.photo!, title: hen.henName }) },
        { text: 'Change Photo', onPress: () => pickAndUpload(`matings/${mating._id}/hens/${hen._id}/photo`, `hen_${hen._id}`) },
        { text: 'Remove Photo', style: 'destructive', onPress: async () => {
          try {
            const updated = await apiRequest<Mating>(`/seasons/${seasonId}/matings/${mating._id}/hens/${hen._id}/photo`, { method: 'DELETE' })
            setMatings((prev) => prev.map((m) => m._id === updated._id ? updated : m))
            if (selectedMating?._id === updated._id) setSelectedMating(updated)
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to remove photo')
          }
        }},
        { text: 'Cancel', style: 'cancel' },
      ])
    } else {
      pickAndUpload(`matings/${mating._id}/hens/${hen._id}/photo`, `hen_${hen._id}`)
    }
  }

  if (loading) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator color="#C8A84B" />
      </View>
    )
  }

  if (error || !season) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center px-8">
        <Text className="text-ink-2 text-base text-center mb-4">{error ?? 'Season not found'}</Text>
        <TouchableOpacity
          className="bg-accent rounded-xl px-6 py-3"
          onPress={() => { setLoading(true); loadData() }}
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const canGenerate = matings.length > 0
  const generated = season.markingsGenerated

  return (
    <View className="flex-1 bg-canvas">
      {/* Header */}
      <View className="px-5 pt-16 pb-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-3">
          <Text className="text-accent text-base">‹ Breeding Records</Text>
        </TouchableOpacity>
        <Text className="text-ink text-2xl font-bold">{season.name}</Text>
        <View className="flex-row items-center gap-3 mt-1">
          <Text className="text-ink-2 text-sm">{season.year}</Text>
          <Text className="text-rim">·</Text>
          <Text className="text-ink-2 text-sm">{matings.length} mating{matings.length !== 1 ? 's' : ''}</Text>
          <Text className="text-rim">·</Text>
          <View className={`px-2 py-0.5 rounded-full ${generated ? 'bg-success/10' : 'bg-warning/10'}`}>
            <Text className={`text-xs font-semibold ${generated ? 'text-success' : 'text-warning'}`}>
              Markings {generated ? 'Generated' : 'Pending'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>

        {/* Breeding Totals card — always on top */}
        {(() => {
          const totals = computeSeasonTotals(matings)
          const hatchDate = season.expectedHatchDate ? new Date(season.expectedHatchDate) : null
          const hatchLabel = hatchDate ? (() => {
            const diff = Math.ceil((hatchDate.getTime() - Date.now()) / 86400000)
            const str = hatchDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
            if (diff > 0) return `${str} · in ${diff}d`
            if (diff === 0) return `${str} · today! 🐣`
            return `${str} · ${Math.abs(diff)}d ago`
          })() : null
          return (
            <View style={{ backgroundColor: '#141414', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', padding: 16, marginBottom: 12, marginTop: 4 }}>
              <Text style={{ color: '#C8A84B', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                Breeding Totals
              </Text>
              <View style={{ gap: 6 }}>
                <LifecycleRow label="Eggs Incubated" value={totals.eggsLaid      != null ? String(totals.eggsLaid) : '—'} />
                <LifecycleRow label="Chicks Hatched" value={totals.chicksHatched != null ? `${totals.chicksHatched}${totals.hatchRate != null ? ` (${totals.hatchRate}%)` : ''}` : '—'} />
                <LifecycleRow label="Male / Female"  value={totals.maleCount     != null ? `${totals.maleCount}M / ${totals.femaleCount ?? '?'}F` : '—'} />
                {hatchLabel && (
                  <View style={{ borderTopWidth: 1, borderTopColor: '#2A2A2A', marginTop: 4, paddingTop: 8 }}>
                    <LifecycleRow label="Expected Hatch" value={hatchLabel} gold />
                  </View>
                )}
              </View>
              {totals.eggsLaid === null && matings.length > 0 && (
                <Text style={{ color: '#606060', fontSize: 12, marginTop: 8 }}>
                  Tap a mating › open a hen row to enter counts.
                </Text>
              )}
              {matings.length === 0 && (
                <Text style={{ color: '#606060', fontSize: 12, marginTop: 8 }}>
                  Add matings below to start tracking.
                </Text>
              )}
            </View>
          )
        })()}

        {/* Previous season markings notice */}
        {!generated && matings.some((m) => m.hens.some((h) => h.previousMarking)) && (
          <View style={{ backgroundColor: '#C8A84B15', borderRadius: 12, borderWidth: 1, borderColor: '#C8A84B30', padding: 14, marginBottom: 12 }}>
            <Text style={{ color: '#C8A84B', fontSize: 12, fontWeight: '700', marginBottom: 3 }}>Previous Season Markings</Text>
            <Text style={{ color: '#A0A0A0', fontSize: 12, lineHeight: 18 }}>
              This season was copied from a previous one. Each hen had a marking last season — keep it or let TIKNOK assign a new one.
            </Text>
          </View>
        )}

        {/* Add Mating + Generate — always visible at top */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: '#141414', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A', borderStyle: 'dashed' }}
            onPress={() => router.push(`/(app)/breeder/marking-generator/${seasonId}/mating/create` as any)}
            activeOpacity={0.7}
          >
            <Text style={{ color: '#C8A84B', fontWeight: '600', fontSize: 14 }}>+ Add Mating</Text>
          </TouchableOpacity>

          {canGenerate && (
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: generated ? '#141414' : '#C8A84B', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: generated ? '#F59E0B44' : '#C8A84B' }}
              onPress={() =>
                generated
                  ? Alert.alert('Reset Markings', 'Clears all generated combos. Your matings and hens are not deleted.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Reset',
                        style: 'destructive',
                        onPress: async () => {
                          await apiRequest(`/seasons/${seasonId}/generate`, { method: 'DELETE' })
                          setSeason((s) => s ? { ...s, markingsGenerated: false } : s)
                          setMatings((prev) => prev.map((m) => ({
                            ...m, noseGroup: null,
                            hens: m.hens.map((h) => ({ ...h, marking: null })),
                          })))
                        },
                      },
                    ])
                  : router.push(`/(app)/breeder/marking-generator/generate/${seasonId}` as any)
              }
              activeOpacity={0.8}
            >
              <Text style={{ color: generated ? '#F59E0B' : '#000000', fontWeight: '700', fontSize: 14 }}>
                {generated ? 'Regenerate' : 'Generate Markings'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Share markings button — shown only after generation */}
        {generated && matings.some((m) => m.hens.some((h) => h.marking)) && (
          <TouchableOpacity
            onPress={handleShareSeason}
            disabled={saving}
            style={{ backgroundColor: '#3B82F6', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            activeOpacity={0.8}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Text style={{ fontSize: 16 }}>🖼</Text>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Save Markings Card</Text>
                </>
            }
          </TouchableOpacity>
        )}

        {/* Mating grid */}
        {matings.length === 0 ? (
          <View className="items-center py-8">
            <Text className="text-ink-2 text-sm text-center">No matings yet. Add your first mating above.</Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-3 mb-8">
            {matings.map((m) => (
              <TouchableOpacity
                key={m._id}
                className="bg-card rounded-xl p-4 border border-rim flex-1 min-w-[44%]"
                onPress={() => openMatingDetail(m)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Text className="text-ink font-semibold text-sm flex-1 mr-1" numberOfLines={2}>{m.maleName}</Text>
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); handleMalePhotoTap(m) }}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    {m.malePhoto ? (
                      <Image source={{ uri: m.malePhoto }} style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#C8A84B' }} />
                    ) : (
                      <Text style={{ fontSize: 16, opacity: uploadingPhoto === `male_${m._id}` ? 0.4 : 0.35 }}>📷</Text>
                    )}
                  </TouchableOpacity>
                </View>
                <Text className="text-ink-2 text-xs mt-1">
                  {m.hens.length} hen{m.hens.length !== 1 ? 's' : ''}
                  {m.sameMarking !== null ? (m.sameMarking ? ' · Same' : ' · Diff') : ''}
                </Text>
                {/* Assigned markings */}
                {m.hens.some((h) => h.marking) && (() => {
                  if (m.sameMarking) {
                    const mk = m.hens[0]?.marking
                    if (!mk) return null
                    return (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                        <View style={{ backgroundColor: '#C8A84B22', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: '#C8A84B', fontSize: 10, fontWeight: '700' }}>{mk}</Text>
                        </View>
                        {m.hens.length > 1 && (
                          <Text style={{ color: '#606060', fontSize: 10 }}>×{m.hens.length}</Text>
                        )}
                      </View>
                    )
                  }
                  const marked = m.hens.filter((h) => h.marking)
                  const shown = marked.slice(0, 2)
                  const extra = marked.length - 2
                  return (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {shown.map((h) => (
                        <View key={h._id} style={{ backgroundColor: '#C8A84B22', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: '#C8A84B', fontSize: 10, fontWeight: '700' }}>{h.marking}</Text>
                        </View>
                      ))}
                      {extra > 0 && (
                        <Text style={{ color: '#606060', fontSize: 10, alignSelf: 'center' }}>+{extra}</Text>
                      )}
                    </View>
                  )
                })()}
                {m.totalEggsLaid !== null && (
                  <Text style={{ color: '#A0A0A0', fontSize: 11, marginTop: 4 }}>
                    {m.totalEggsLaid} eggs{m.totalChicksHatched != null ? ` · ${m.totalChicksHatched} hatched` : ''}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Delete Season — bottom of scroll, intentional placement */}
        <TouchableOpacity
          onPress={handleDeleteSeason}
          disabled={deletingSeason}
          style={{ marginTop: 16, marginBottom: 32, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', paddingVertical: 14, alignItems: 'center' }}
          activeOpacity={0.7}
        >
          {deletingSeason
            ? <ActivityIndicator color="#EF4444" size="small" />
            : <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '600' }}>Delete Season</Text>
          }
        </TouchableOpacity>
      </ScrollView>

      {/* Single sheet — swaps between detail view and edit form */}
      <SimpleBottomSheet
        ref={detailSheetRef}
        snapPoints={['90%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: '#18181B' }}
        handleIndicatorStyle={{ backgroundColor: '#A1A1AA' }}
      >
        {selectedMating && sheetMode === 'edit' && editTarget && (
          <BottomSheetScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 220 }}
          >
            {/* Back link */}
            <TouchableOpacity onPress={() => { setSheetMode('detail'); setEditError(null) }} style={{ marginBottom: 16 }}>
              <Text style={{ color: '#C8A84B', fontSize: 14 }}>‹ Back</Text>
            </TouchableOpacity>

            <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 2 }}>
              {editTarget.type === 'hen' ? editTarget.hen.henName : 'All Hens Combined'}
            </Text>
            {editTarget.type === 'hen' && editTarget.hen.marking && (
              <View style={{ flexDirection: 'row', marginBottom: 20 }}>
                <View style={{ backgroundColor: '#C8A84B22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: '#C8A84B', fontSize: 12, fontWeight: '700' }}>{editTarget.hen.marking}</Text>
                </View>
              </View>
            )}
            {editTarget.type === 'pen' && (
              <Text style={{ color: '#606060', fontSize: 13, marginBottom: 20 }}>{selectedMating.maleName}</Text>
            )}

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <InlineInput label="Eggs Incubated" value={editValues.eggs}    onChange={(v) => updateEdit('eggs', v)} />
              <InlineInput label="Chicks Hatched" value={editValues.hatched} onChange={(v) => updateEdit('hatched', v)} />
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <InlineInput label="Males"   value={editValues.males}   onChange={(v) => updateEdit('males', v)} />
              <InlineInput label="Females" value={editValues.females} onChange={(v) => updateEdit('females', v)} />
            </View>

            {editError && (
              <View style={{ backgroundColor: '#EF444420', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#EF444440' }}>
                <Text style={{ color: '#EF4444', fontSize: 13 }}>{editError}</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={() =>
                editTarget.type === 'hen'
                  ? handleSaveHen(editTarget.hen, selectedMating)
                  : handleSavePen(selectedMating)
              }
              disabled={editSaving}
              activeOpacity={0.85}
              style={{ backgroundColor: '#C8A84B', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
            >
              {editSaving
                ? <ActivityIndicator color="#000000" />
                : <Text style={{ color: '#000000', fontSize: 16, fontWeight: '700' }}>Save</Text>
              }
            </TouchableOpacity>
          </BottomSheetScrollView>
        )}

        {selectedMating && sheetMode === 'detail' && (
          <View style={{ flex: 1 }}>
            <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}>
              {/* Sheet header row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
                  <TouchableOpacity onPress={() => handleMalePhotoTap(selectedMating)} activeOpacity={0.7}>
                    {selectedMating.malePhoto ? (
                      <Image source={{ uri: selectedMating.malePhoto }} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: '#C8A84B' }} />
                    ) : (
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#1E1E1E', borderWidth: 1, borderColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 20 }}>📷</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <Text className="text-ink text-2xl font-bold flex-1" numberOfLines={1}>{selectedMating.maleName}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => detailSheetRef.current?.close()}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  activeOpacity={0.6}
                >
                  <Text style={{ color: '#606060', fontSize: 22, lineHeight: 26 }}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                <View className="bg-canvas rounded-full px-3 py-1">
                  <Text className="text-ink-2 text-xs">
                    {selectedMating.hens.length} hen{selectedMating.hens.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                {selectedMating.sameMarking !== null && (
                  <View className="bg-canvas rounded-full px-3 py-1">
                    <Text className="text-ink-2 text-xs">
                      {selectedMating.sameMarking ? 'Same marking' : 'Diff markings'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Keep previous marking — same-marking matings only, before generation */}
              {!generated && selectedMating.sameMarking && !selectedMating.mandatoryMarking &&
               selectedMating.hens.some((h) => h.previousMarking) && (() => {
                const prev = selectedMating.hens.find((h) => h.previousMarking)?.previousMarking
                if (!prev) return null
                return (
                  <TouchableOpacity
                    onPress={() => handleKeepPrevious(selectedMating, prev)}
                    style={{ backgroundColor: '#C8A84B15', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#C8A84B30', flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: '#C8A84B', fontSize: 13, flex: 1 }}>
                      Keep previous marking: <Text style={{ fontWeight: '700' }}>{prev}</Text>
                    </Text>
                    <Text style={{ color: '#C8A84B', fontSize: 12 }}>Set ›</Text>
                  </TouchableOpacity>
                )
              })()}

              {selectedMating.mandatoryMarking && (
                <View className="bg-canvas rounded-xl px-4 py-3 mb-4 border border-rim">
                  <Text className="text-ink-2 text-xs mb-1">Force Marking</Text>
                  <Text className="text-secondary font-bold text-lg">{selectedMating.mandatoryMarking}</Text>
                </View>
              )}

              {/* ── DIFFERENT MARKINGS — each hen row tappable ── */}
              {selectedMating.sameMarking !== true ? (
                <>
                  <Text className="text-ink-2 text-xs font-semibold uppercase tracking-wider mb-2">
                    Hens — tap row to update counts
                  </Text>
                  <View style={{ gap: 8 }}>
                    {selectedMating.hens.map((hen, idx) => (
                      <TouchableOpacity
                        key={hen._id}
                        onPress={() => openHenEdit(hen)}
                        activeOpacity={0.7}
                        style={{ backgroundColor: '#0F0F11', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#27272A', flexDirection: 'row', alignItems: 'center', gap: 10 }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#606060', fontSize: 11 }}>Hen {idx + 1}</Text>
                          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>{hen.henName}</Text>
                          {!hen.marking && hen.previousMarking && (
                            <Text style={{ color: '#606060', fontSize: 10, marginTop: 1 }}>prev: {hen.previousMarking}</Text>
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={() => handleHenPhotoTap(selectedMating, hen)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          {hen.photo ? (
                            <Image source={{ uri: hen.photo }} style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#C8A84B' }} />
                          ) : (
                            <Text style={{ fontSize: 14, opacity: uploadingPhoto === `hen_${hen._id}` ? 0.4 : 0.25 }}>📷</Text>
                          )}
                        </TouchableOpacity>
                        {hen.marking && (
                          <View style={{ backgroundColor: '#C8A84B22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                            <Text style={{ color: '#C8A84B', fontSize: 12, fontWeight: '700' }}>{hen.marking}</Text>
                          </View>
                        )}
                        {hen.eggsLaid !== null ? (
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: '#C8A84B', fontSize: 11 }}>🥚{hen.eggsLaid} 🐣{hen.chicksHatched ?? '—'}</Text>
                            {hen.maleCount !== null && (
                              <Text style={{ color: '#A0A0A0', fontSize: 11 }}>♂{hen.maleCount} ♀{hen.femaleCount ?? '?'}</Text>
                            )}
                          </View>
                        ) : (
                          <Text style={{ color: '#404040', fontSize: 12 }}>add counts</Text>
                        )}
                        <Text style={{ color: '#404040', fontSize: 13, marginLeft: 2 }}>
                          {hen.eggsLaid !== null ? 'Edit ›' : '›'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                /* ── SAME MARKING — static hen list + single tappable totals row ── */
                <>
                  <Text className="text-ink-2 text-xs font-semibold uppercase tracking-wider mb-2">Hens</Text>
                  <View style={{ gap: 8, marginBottom: 16 }}>
                    {selectedMating.hens.map((hen, idx) => (
                      <View key={hen._id} style={{ backgroundColor: '#0F0F11', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#27272A', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#606060', fontSize: 11 }}>Hen {idx + 1}</Text>
                          <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>{hen.henName}</Text>
                          {!hen.marking && hen.previousMarking && (
                            <Text style={{ color: '#606060', fontSize: 10, marginTop: 1 }}>prev: {hen.previousMarking}</Text>
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={() => handleHenPhotoTap(selectedMating, hen)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          {hen.photo ? (
                            <Image source={{ uri: hen.photo }} style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#C8A84B' }} />
                          ) : (
                            <Text style={{ fontSize: 14, opacity: uploadingPhoto === `hen_${hen._id}` ? 0.4 : 0.25 }}>📷</Text>
                          )}
                        </TouchableOpacity>
                        {hen.marking && (
                          <View style={{ backgroundColor: '#C8A84B22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                            <Text style={{ color: '#C8A84B', fontSize: 12, fontWeight: '700' }}>{hen.marking}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>

                  <Text className="text-ink-2 text-xs font-semibold uppercase tracking-wider mb-2">
                    Egg &amp; Hatch Count
                  </Text>
                  <TouchableOpacity
                    onPress={() => openPenEdit(selectedMating)}
                    activeOpacity={0.7}
                    style={{ backgroundColor: '#0F0F11', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: '#27272A', flexDirection: 'row', alignItems: 'center' }}
                  >
                    <View style={{ flex: 1 }}>
                      {selectedMating.penEggsLaid != null ? (
                        <View style={{ gap: 4 }}>
                          <Text style={{ color: '#FFFFFF', fontSize: 14 }}>
                            🥚 <Text style={{ fontWeight: '700' }}>{selectedMating.penEggsLaid}</Text>
                            <Text style={{ color: '#606060' }}> eggs  </Text>
                            🐣 <Text style={{ fontWeight: '700' }}>{selectedMating.penChicksHatched ?? '—'}</Text>
                            <Text style={{ color: '#606060' }}> hatched</Text>
                          </Text>
                          {selectedMating.penMaleCount != null && (
                            <Text style={{ color: '#A0A0A0', fontSize: 13 }}>♂{selectedMating.penMaleCount} ♀{selectedMating.penFemaleCount ?? '?'}</Text>
                          )}
                        </View>
                      ) : (
                        <Text style={{ color: '#606060', fontSize: 13 }}>No counts yet — tap to add</Text>
                      )}
                    </View>
                    <Text style={{ color: '#404040', fontSize: 13, marginLeft: 8 }}>
                      {selectedMating.penEggsLaid != null ? 'Edit ›' : '›'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </BottomSheetScrollView>

            {/* Action buttons */}
            <View style={{ gap: 8, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#27272A' }}>
              {/* Share button — only if mating has markings */}
              {selectedMating.hens.some((h) => h.marking) && (
                <TouchableOpacity
                  style={{ backgroundColor: '#3B82F6', borderRadius: 12, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                  onPress={handleShareMating}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <>
                        <Text style={{ fontSize: 15 }}>🖼</Text>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Save to Photos</Text>
                      </>
                  }
                </TouchableOpacity>
              )}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#0F0F11', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#27272A' }}
                  onPress={() => {
                    detailSheetRef.current?.close(() => {
                      router.push(`/(app)/breeder/marking-generator/${seasonId}/mating/edit?matingId=${selectedMating._id}` as any)
                    })
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Edit Mating</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' }}
                  onPress={handleDeleteMating}
                  disabled={deleting}
                >
                  {deleting
                    ? <ActivityIndicator color="#EF4444" />
                    : <Text style={{ color: '#EF4444', fontWeight: '600' }}>Delete</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </SimpleBottomSheet>

      {/* Export options sheet */}
      <SimpleBottomSheet
        ref={exportSheetRef}
        snapPoints={['72%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: '#18181B' }}
        handleIndicatorStyle={{ backgroundColor: '#A1A1AA' }}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 4 }}>Customize Card</Text>
          <Text style={{ color: '#606060', fontSize: 13, marginBottom: 20 }}>These details will appear on the saved image.</Text>

          <Text style={{ color: '#A0A0A0', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Farm Name</Text>
          <TextInput
            value={farmName}
            onChangeText={setFarmName}
            placeholder="e.g. Dela Cruz Gamefarm"
            placeholderTextColor="#404040"
            style={{ backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 10, color: '#FFFFFF', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 }}
          />

          <Text style={{ color: '#A0A0A0', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Owner Name</Text>
          <TextInput
            value={ownerName}
            onChangeText={setOwnerName}
            placeholder="e.g. Juan Dela Cruz"
            placeholderTextColor="#404040"
            style={{ backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 10, color: '#FFFFFF', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20 }}
          />

          {exportTarget === 'season' && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: '#A0A0A0', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Include Breeding Totals?</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[{ label: 'Yes', value: true }, { label: 'No', value: false }].map(({ label, value }) => (
                  <TouchableOpacity
                    key={String(value)}
                    onPress={() => setIncludeBreedingTotals(value)}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, backgroundColor: includeBreedingTotals === value ? '#C8A84B22' : '#0A0A0A', borderColor: includeBreedingTotals === value ? '#C8A84B' : '#2A2A2A' }}
                  >
                    <Text style={{ color: includeBreedingTotals === value ? '#C8A84B' : '#606060', fontWeight: '600' }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={handleConfirmExport}
            disabled={saving}
            activeOpacity={0.85}
            style={{ backgroundColor: '#C8A84B', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
          >
            {saving
              ? <ActivityIndicator color="#000000" />
              : <Text style={{ color: '#000000', fontSize: 16, fontWeight: '700' }}>Save to Photos</Text>
            }
          </TouchableOpacity>
        </BottomSheetScrollView>
      </SimpleBottomSheet>

      {/* Off-screen export cards — rendered at opacity 0, captured by view-shot */}
      {season && (() => {
        const totals: SeasonTotals = computeSeasonTotals(matings)
        return (
          <MarkingExportCard
            ref={seasonCardRef}
            mode="season"
            farmName={farmName}
            ownerName={ownerName}
            season={{ name: season.name, year: season.year }}
            matings={matings}
            includeBreedingTotals={includeBreedingTotals}
            totals={totals}
            expectedHatchDate={season.expectedHatchDate}
          />
        )
      })()}
      {season && selectedMating && (
        <MarkingExportCard
          ref={matingCardRef}
          mode="mating"
          farmName={farmName}
          ownerName={ownerName}
          season={{ name: season.name, year: season.year }}
          mating={selectedMating}
        />
      )}

      {/* Full-screen photo modal */}
      <Modal
        visible={photoModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoModal(null)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setPhotoModal(null)}
          activeOpacity={1}
        >
          {photoModal && (
            <>
              <Text style={{ color: '#A0A0A0', fontSize: 13, marginBottom: 14 }}>{photoModal.title}</Text>
              <Image
                source={{ uri: photoModal.uri }}
                style={{ width: 300, height: 300, borderRadius: 16 }}
                resizeMode="contain"
              />
              <Text style={{ color: '#606060', fontSize: 12, marginTop: 20 }}>Tap anywhere to close</Text>
            </>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

function LifecycleRow({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={{ color: gold ? '#C8A84B' : '#A0A0A0', fontSize: 13 }}>{label}</Text>
      <Text style={{ color: gold ? '#C8A84B' : '#FFFFFF', fontSize: 13, fontWeight: '600' }}>{value}</Text>
    </View>
  )
}

function InlineInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: '#606060', fontSize: 11, marginBottom: 5 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        placeholder="—"
        placeholderTextColor="#404040"
        selectTextOnFocus
        style={{
          backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: '#2A2A2A',
          borderRadius: 8, color: '#FFFFFF', fontSize: 15, fontWeight: '600',
          paddingHorizontal: 10, paddingVertical: 10, textAlign: 'center',
        }}
      />
    </View>
  )
}
