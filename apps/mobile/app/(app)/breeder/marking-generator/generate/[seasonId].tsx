import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import SimpleBottomSheet, {
  BottomSheetView,
  type SimpleBottomSheetRef,
} from '../../../../../components/SimpleBottomSheet'
import { MarkingPicker } from '../../../../../components/MarkingPicker'
import { apiRequest } from '../../../../../lib/api'

type HenAssignment = { henName: string; marking: string }

type Assignment = {
  matingId: string
  maleName: string
  noseGroup: string
  hens: HenAssignment[]
}

type MatingRow = {
  _id: string
  maleName: string
  sameMarking: boolean | null
  hens: { henName: string }[]
  override: string | null
}

type Screen = 'prereview' | 'review'

export default function GenerateMarkingsScreen() {
  const { seasonId } = useLocalSearchParams<{ seasonId: string }>()
  const router = useRouter()
  const swapSheetRef = useRef<SimpleBottomSheetRef>(null)

  const [screen, setScreen] = useState<Screen>('prereview')
  const [matingRows, setMatingRows] = useState<MatingRow[]>([])
  const [preview, setPreview] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedOverride, setExpandedOverride] = useState<string | null>(null)

  const [swapTarget, setSwapTarget] = useState<{ matingId: string; henName: string } | null>(null)
  const [swapMarking, setSwapMarking] = useState<string | null>(null)

  useEffect(() => {
    loadMatings()
  }, [])

  async function loadMatings() {
    try {
      const matings = await apiRequest<MatingRow[]>(`/seasons/${seasonId}/matings`)
      setMatingRows(
        matings.map((m) => ({
          _id: m._id,
          maleName: m.maleName,
          sameMarking: m.sameMarking,
          hens: m.hens,
          override: null,
        })),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load matings')
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    setError(null)
    try {
      const overrides = matingRows
        .filter((r) => r.override)
        .map((r) => ({ matingId: r._id, marking: r.override! }))

      const data = await apiRequest<{ preview: Assignment[] }>(`/seasons/${seasonId}/generate`, {
        method: 'POST',
        body: { overrides },
      })
      setPreview(data.preview)
      setScreen('review')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleConfirm() {
    setConfirming(true)
    try {
      await apiRequest(`/seasons/${seasonId}/generate/confirm`, {
        method: 'POST',
        body: {
          assignments: preview.map((a) => ({
            matingId: a.matingId,
            noseGroup: a.noseGroup,
            hens: a.hens,
          })),
        },
      })
      router.back()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save markings')
    } finally {
      setConfirming(false)
    }
  }

  function openSwap(matingId: string, henName: string, currentMarking: string) {
    setSwapTarget({ matingId, henName })
    setSwapMarking(currentMarking)
    swapSheetRef.current?.expand()
  }

  function applySwap() {
    if (!swapTarget || !swapMarking) return
    setPreview((prev) =>
      prev.map((a) =>
        a.matingId === swapTarget.matingId
          ? {
              ...a,
              hens: a.hens.map((h) =>
                h.henName === swapTarget.henName ? { ...h, marking: swapMarking } : h,
              ),
            }
          : a,
      ),
    )
    swapSheetRef.current?.close()
  }

  if (loading) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator color="#C8A84B" />
      </View>
    )
  }

  return (
    <View className="flex-1 bg-canvas">
      <Stack.Screen options={{ headerShown: false }} />
      {screen === 'prereview' ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 py-6"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity onPress={() => router.back()} className="mb-5">
            <Text className="text-accent text-base">‹ Back</Text>
          </TouchableOpacity>
          <Text className="text-ink text-xl font-bold mb-1">Review Matings</Text>
          <Text className="text-ink-2 text-sm mb-6">
            Optionally pre-assign a mandatory marking per mating, then generate.
          </Text>

          {matingRows.map((row) => (
            <View
              key={row._id}
              className="bg-card rounded-xl mb-3 border border-rim overflow-hidden"
            >
              <View className="px-4 py-3 flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-ink font-semibold">{row.maleName}</Text>
                  <Text className="text-ink-2 text-xs mt-0.5">
                    {row.hens.length} hen{row.hens.length !== 1 ? 's' : ''}
                    {row.sameMarking !== null ? (row.sameMarking ? ' · Same' : ' · Diff') : ''}
                  </Text>
                </View>
                <View className="flex-row items-center gap-3">
                  {row.override && (
                    <View className="bg-secondary-muted rounded-lg px-2 py-1">
                      <Text className="text-secondary text-xs font-bold">{row.override}</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() =>
                      setExpandedOverride(expandedOverride === row._id ? null : row._id)
                    }
                  >
                    <Text className="text-ink-2 text-sm">
                      {expandedOverride === row._id ? 'Close ▲' : 'Set ▼'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {expandedOverride === row._id && (
                <View className="px-4 pb-4 border-t border-rim">
                  <Text className="text-ink-2 text-xs mt-3 mb-3">
                    Pre-assign marking (optional — clears to auto-assign)
                  </Text>
                  <MarkingPicker
                    value={row.override}
                    onChange={(m) =>
                      setMatingRows((prev) =>
                        prev.map((r) => (r._id === row._id ? { ...r, override: m } : r)),
                      )
                    }
                  />
                </View>
              )}
            </View>
          ))}

          {error && (
            <View className="bg-accent-muted rounded-xl px-4 py-3 mb-4 border border-accent/30">
              <Text className="text-accent text-sm">{error}</Text>
            </View>
          )}

          <TouchableOpacity
            className="bg-accent rounded-xl py-4 items-center mt-4"
            onPress={handleGenerate}
            disabled={generating}
            activeOpacity={0.8}
          >
            {generating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">Generate Markings</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <View className="flex-1">
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-5 py-6"
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity onPress={() => setScreen('prereview')} className="mb-5">
              <Text className="text-accent text-base">‹ Back</Text>
            </TouchableOpacity>
            <Text className="text-ink text-xl font-bold mb-1">Review Assignments</Text>
            <Text className="text-ink-2 text-sm mb-6">
              Tap [swap] to change any marking before saving.
            </Text>

            {preview.map((a) => (
              <View
                key={a.matingId}
                className="bg-card rounded-xl mb-3 border border-rim overflow-hidden"
              >
                <View className="px-4 py-3 flex-row items-center border-b border-rim">
                  <View className="flex-1">
                    <Text className="text-ink font-semibold">{a.maleName}</Text>
                  </View>
                  <View className="bg-secondary-muted rounded-lg px-3 py-1">
                    <Text className="text-secondary text-sm font-bold">{a.noseGroup}</Text>
                  </View>
                </View>

                {a.hens.map((hen) => (
                  <View
                    key={hen.henName}
                    className="px-4 py-2.5 flex-row items-center justify-between border-b border-rim last:border-b-0"
                  >
                    <Text className="text-ink-2 text-sm flex-1">{hen.henName}</Text>
                    <View className="flex-row items-center gap-3">
                      <Text className="text-secondary font-bold text-base">{hen.marking}</Text>
                      <TouchableOpacity
                        className="bg-canvas rounded-lg px-2 py-1 border border-rim"
                        onPress={() => openSwap(a.matingId, hen.henName, hen.marking)}
                      >
                        <Text className="text-ink-2 text-xs">swap</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}

            {error && (
              <View className="bg-accent-muted rounded-xl px-4 py-3 mb-4 border border-accent/30">
                <Text className="text-accent text-sm">{error}</Text>
              </View>
            )}

            <TouchableOpacity
              className="bg-accent rounded-xl py-4 items-center mt-4 mb-4"
              onPress={handleConfirm}
              disabled={confirming}
              activeOpacity={0.8}
            >
              {confirming ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold">Save & Confirm</Text>
              )}
            </TouchableOpacity>
          </ScrollView>

          <SimpleBottomSheet
            ref={swapSheetRef}
            snapPoints={['70%']}
            enablePanDownToClose
            backgroundStyle={{ backgroundColor: '#18181B' }}
            handleIndicatorStyle={{ backgroundColor: '#A1A1AA' }}
          >
            <BottomSheetView style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 }}>
              <Text className="text-ink text-lg font-bold mb-1">Swap Marking</Text>
              {swapTarget && (
                <Text className="text-ink-2 text-sm mb-5">
                  Hen: {swapTarget.henName}
                </Text>
              )}
              <MarkingPicker value={swapMarking} onChange={setSwapMarking} />
              <TouchableOpacity
                className="bg-accent rounded-xl py-4 items-center mt-5"
                onPress={applySwap}
                activeOpacity={0.8}
              >
                <Text className="text-white font-bold">Apply Swap</Text>
              </TouchableOpacity>
            </BottomSheetView>
          </SimpleBottomSheet>
        </View>
      )}
    </View>
  )
}
