import { useRef, useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import SimpleBottomSheet, {
  BottomSheetView,
  BottomSheetScrollView,
  type SimpleBottomSheetRef,
} from '../../../../components/SimpleBottomSheet'
import { apiRequest } from '../../../../lib/api'

type Season = {
  _id: string
  name: string
  year: number
  markingsGenerated: boolean
  generatedAt: string | null
  matingCount: number
  createdAt: string
}

type DuplicateResult = {
  season: Season
  sourceSeasonName: string
  matingsCopied: number
}

const SEASON_TYPES = ['Early Bird', 'Local', 'National', 'Late Born', 'Off Season', 'Others'] as const

export default function MarkingGeneratorScreen() {
  const router = useRouter()
  const sheetRef = useRef<SimpleBottomSheetRef>(null)
  const optionsSheetRef = useRef<SimpleBottomSheetRef>(null)

  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [customName, setCustomName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // collapsible year groups — past years collapsed by default
  const currentYear = new Date().getFullYear()
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set([currentYear]))

  // season options sheet
  const [optionsSeason, setOptionsSeason] = useState<Season | null>(null)
  const [duplicating, setDuplicating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  async function loadSeasons() {
    try {
      const data = await apiRequest<Season[]>('/seasons')
      setSeasons(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load seasons')
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      loadSeasons()
    }, []),
  )

  function buildSeasonName(type: string, year: number): string {
    const existing = seasons.filter((s) => {
      if (s.year !== year) return false
      // Match exact base name or "Base N" pattern
      return s.name === type || new RegExp(`^${type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\d+$`).test(s.name)
    })
    if (existing.length === 0) return type
    return `${type} ${existing.length + 1}`
  }

  function openCreateSheet() {
    setSelectedType(null)
    setCustomName('')
    setCreateError(null)
    sheetRef.current?.expand()
  }

  async function handleCreateSeason() {
    if (!selectedType) {
      setCreateError('Select a season type')
      return
    }
    const year = new Date().getFullYear()
    const name = selectedType === 'Others' ? customName.trim() : buildSeasonName(selectedType, year)
    if (!name) {
      setCreateError('Enter a season name')
      return
    }

    setCreating(true)
    setCreateError(null)
    try {
      const season = await apiRequest<Season>('/seasons', {
        method: 'POST',
        body: { name, year: new Date().getFullYear() },
      })
      setSeasons((prev) => [season, ...prev])
      sheetRef.current?.close(() => {
        router.push(`/(app)/breeder/marking-generator/${season._id}` as any)
      })
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create season')
    } finally {
      setCreating(false)
    }
  }

  function openOptions(season: Season) {
    setOptionsSeason(season)
    setOptionsError(null)
    setDeleteConfirm(false)
    optionsSheetRef.current?.expand()
  }

  async function handleDuplicate() {
    if (!optionsSeason) return
    setDuplicating(true)
    setOptionsError(null)
    try {
      const result = await apiRequest<DuplicateResult>(`/seasons/${optionsSeason._id}/duplicate`, { method: 'POST' })
      setSeasons((prev) => [result.season, ...prev])
      // expand current year so the new season is visible
      setExpandedYears((prev) => new Set([...prev, currentYear]))
      optionsSheetRef.current?.close(() => {
        router.push(`/(app)/breeder/marking-generator/${result.season._id}` as any)
      })
    } catch (e) {
      setOptionsError(e instanceof Error ? e.message : 'Failed to duplicate season')
    } finally {
      setDuplicating(false)
    }
  }

  async function handleDelete() {
    if (!optionsSeason) return
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    setDeleting(true)
    setOptionsError(null)
    try {
      await apiRequest(`/seasons/${optionsSeason._id}`, { method: 'DELETE' })
      setSeasons((prev) => prev.filter((s) => s._id !== optionsSeason._id))
      optionsSheetRef.current?.close()
    } catch (e) {
      setOptionsError(e instanceof Error ? e.message : 'Failed to delete season')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <View className="flex-1 bg-canvas">
      {/* Header */}
      <View className="px-5 pt-16 pb-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-3">
          <Text className="text-accent text-base">‹ Breeder</Text>
        </TouchableOpacity>
        <Text className="text-ink text-2xl font-bold">Breeding Records</Text>
      </View>

      {/* Season list */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#C8A84B" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-danger text-center">{error}</Text>
          <TouchableOpacity onPress={loadSeasons} className="mt-4">
            <Text className="text-accent font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : seasons.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl mb-4">🐓</Text>
          <Text className="text-ink text-xl font-bold mb-2">Start Your First Season</Text>
          <Text className="text-ink-2 text-center text-sm leading-5">
            Create a breeding season to manage matings, generate markings, and track egg and chick counts.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
          {(() => {
            const byYear = new Map<number, Season[]>()
            for (const s of seasons) {
              if (!byYear.has(s.year)) byYear.set(s.year, [])
              byYear.get(s.year)!.push(s)
            }
            const years = Array.from(byYear.keys()).sort((a, b) => b - a)
            return years.map((year) => {
              const isExpanded = expandedYears.has(year)
              const list = byYear.get(year)!
              return (
                <View key={year}>
                  <TouchableOpacity
                    onPress={() =>
                      setExpandedYears((prev) => {
                        const next = new Set(prev)
                        if (next.has(year)) next.delete(year)
                        else next.add(year)
                        return next
                      })
                    }
                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8, gap: 8 }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: '#606060', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                      {year}
                    </Text>
                    {!isExpanded && (
                      <Text style={{ color: '#606060', fontSize: 11 }}>
                        ({list.length} season{list.length !== 1 ? 's' : ''})
                      </Text>
                    )}
                    <Text style={{ color: '#606060', fontSize: 11 }}>{isExpanded ? '▲' : '▶'}</Text>
                  </TouchableOpacity>

                  {isExpanded && list.map((s) => (
                    <View
                      key={s._id}
                      className="bg-card rounded-xl p-4 mb-3 border border-rim"
                    >
                      <TouchableOpacity
                        onPress={() => router.push(`/(app)/breeder/marking-generator/${s._id}` as any)}
                        activeOpacity={0.7}
                      >
                        <View className="flex-row items-center justify-between mb-1">
                          <Text className="text-ink font-semibold text-base flex-1 mr-2" numberOfLines={1}>{s.name}</Text>
                          <View className="flex-row items-center gap-2">
                            <View className={`px-2.5 py-1 rounded-full ${s.markingsGenerated ? 'bg-success/10' : 'bg-warning/10'}`}>
                              <Text className={`text-xs font-semibold ${s.markingsGenerated ? 'text-success' : 'text-warning'}`}>
                                {s.markingsGenerated ? 'Generated' : 'Pending'}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => openOptions(s)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={{ paddingHorizontal: 6, paddingVertical: 2 }}
                            >
                              <Text style={{ color: '#606060', fontSize: 18, lineHeight: 20 }}>⋯</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <Text className="text-ink-2 text-sm">
                          {s.matingCount === 0
                            ? 'No matings yet'
                            : `${s.matingCount} mating${s.matingCount !== 1 ? 's' : ''}`}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )
            })
          })()}
          <View className="h-24" />
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-8 right-5 bg-accent rounded-full w-14 h-14 items-center justify-center shadow-lg"
        onPress={openCreateSheet}
        activeOpacity={0.8}
      >
        <Text className="text-white text-3xl font-bold leading-none">+</Text>
      </TouchableOpacity>

      {/* Season Options Sheet */}
      <SimpleBottomSheet
        ref={optionsSheetRef}
        snapPoints={['45%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: '#18181B' }}
        handleIndicatorStyle={{ backgroundColor: '#A1A1AA' }}
        onClose={() => { setDeleteConfirm(false); setOptionsError(null) }}
      >
        <BottomSheetView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 }}>
          {optionsSeason && (
            <>
              <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginBottom: 4 }}>
                {optionsSeason.name}
              </Text>
              <Text style={{ color: '#606060', fontSize: 13, marginBottom: 24 }}>
                {optionsSeason.year} · {optionsSeason.matingCount} mating{optionsSeason.matingCount !== 1 ? 's' : ''}
              </Text>

              {optionsError && (
                <Text style={{ color: '#EF4444', fontSize: 13, marginBottom: 12 }}>{optionsError}</Text>
              )}

              <TouchableOpacity
                onPress={handleDuplicate}
                disabled={duplicating}
                style={{ backgroundColor: '#1E1E1E', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10, borderWidth: 1, borderColor: '#2A2A2A', flexDirection: 'row', alignItems: 'center', gap: 12 }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 20 }}>📋</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>
                    {duplicating ? 'Duplicating…' : 'Duplicate Season'}
                  </Text>
                  <Text style={{ color: '#606060', fontSize: 12, marginTop: 2 }}>
                    Copy matings to a new {currentYear} season
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDelete}
                disabled={deleting}
                style={{ backgroundColor: deleteConfirm ? '#EF444420' : '#1E1E1E', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: deleteConfirm ? '#EF4444' : '#2A2A2A', flexDirection: 'row', alignItems: 'center', gap: 12 }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 20 }}>🗑️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#EF4444', fontSize: 15, fontWeight: '600' }}>
                    {deleting ? 'Deleting…' : deleteConfirm ? 'Tap again to confirm delete' : 'Delete Season'}
                  </Text>
                  {!deleteConfirm && (
                    <Text style={{ color: '#606060', fontSize: 12, marginTop: 2 }}>
                      Removes all matings and markings
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            </>
          )}
        </BottomSheetView>
      </SimpleBottomSheet>

      {/* Create Season Bottom Sheet */}
      <SimpleBottomSheet
        ref={sheetRef}
        snapPoints={['72%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: '#18181B' }}
        handleIndicatorStyle={{ backgroundColor: '#A1A1AA' }}
      >
        <BottomSheetView style={{ flex: 1 }}>
          <Text className="text-ink text-lg font-bold px-5 pt-2 pb-1">New Breeding Season</Text>
          <Text className="text-ink-3 text-xs px-5 mb-4">A season = one breeding cycle or batch. You can create multiple.</Text>
          <Text className="text-ink-2 text-xs font-semibold uppercase tracking-wider px-5 mb-3">
            Season Type
          </Text>

          <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}>
            <View className="gap-2">
              {SEASON_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  className={`flex-row items-center px-4 py-3 rounded-xl border ${
                    selectedType === type
                      ? 'bg-accent-muted border-accent'
                      : 'bg-canvas border-rim'
                  }`}
                  onPress={() => setSelectedType(type)}
                >
                  <View
                    className={`w-4 h-4 rounded-full border-2 mr-3 items-center justify-center ${
                      selectedType === type ? 'border-accent' : 'border-ink-2'
                    }`}
                  >
                    {selectedType === type && (
                      <View className="w-2 h-2 rounded-full bg-accent" />
                    )}
                  </View>
                  <Text
                    className={`text-base ${selectedType === type ? 'text-accent font-semibold' : 'text-ink'}`}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedType === 'Others' && (
              <TextInput
                className="bg-canvas text-ink text-base rounded-xl px-4 py-3.5 border border-rim mt-3"
                placeholder="Season name"
                placeholderTextColor="#A1A1AA"
                value={customName}
                onChangeText={setCustomName}
                autoFocus
              />
            )}

            {/* Auto-name preview when duplicate detected */}
            {selectedType && selectedType !== 'Others' && (() => {
              const year = new Date().getFullYear()
              const proposed = buildSeasonName(selectedType, year)
              if (proposed === selectedType) return null
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: '#C8A84B15', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Text style={{ color: '#C8A84B', fontSize: 13 }}>
                    Already exists this year — will be created as{' '}
                    <Text style={{ fontWeight: '700' }}>{proposed}</Text>
                  </Text>
                </View>
              )
            })()}
          </BottomSheetScrollView>

          {/* Pinned bottom — always visible */}
          <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, borderTopWidth: 1, borderTopColor: '#27272A' }}>
            {createError ? (
              <Text className="text-danger text-sm mb-3">{createError}</Text>
            ) : null}
            <TouchableOpacity
              className="bg-accent rounded-xl py-4 items-center"
              onPress={handleCreateSeason}
              disabled={creating}
              activeOpacity={0.8}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">Create Season</Text>
              )}
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </SimpleBottomSheet>
    </View>
  )
}
