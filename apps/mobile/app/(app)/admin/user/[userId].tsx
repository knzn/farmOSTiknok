import { useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router'
import { apiRequest } from '../../../../lib/api'

// ─── types ────────────────────────────────────────────────────────────────────

interface AdminUserDetail {
  _id: string
  username: string
  email: string
  tiknokId: string | null
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'suspended'
  subscriptionTier: 'free' | 'pro'
  trialEndsAt: string | null
  paidUntil: string | null
  dataDeletesAt: string | null
  isAdmin: boolean
  isBreeder: boolean
  createdAt: string | null
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function statusColor(s: string) {
  if (s === 'active')    return '#22C55E'
  if (s === 'trial')     return '#C8A84B'
  if (s === 'expired')   return '#EF4444'
  if (s === 'suspended') return '#A0A0A0'
  return '#606060'
}

function statusLabel(s: string) {
  if (s === 'active')    return 'Active'
  if (s === 'trial')     return 'Trial'
  if (s === 'expired')   return 'Expired'
  if (s === 'suspended') return 'Suspended'
  return s
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return `Ended ${Math.abs(diff)}d ago`
  if (diff === 0) return 'Ends today'
  return `${diff}d remaining`
}

// ─── info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1E1E1E',
    }}>
      <Text style={{ color: '#606060', fontSize: 12 }}>{label}</Text>
      <Text style={{ color: valueColor ?? '#FFFFFF', fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  )
}

// ─── action button ────────────────────────────────────────────────────────────

function ActionButton({
  label, color, onPress, loading,
}: {
  label: string
  color: string
  onPress: () => void
  loading?: boolean
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={loading}
      style={{
        backgroundColor: `${color}22`,
        borderRadius: 10, borderWidth: 1, borderColor: `${color}55`,
        paddingVertical: 12, paddingHorizontal: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        marginBottom: 10,
      }}
    >
      {loading
        ? <ActivityIndicator color={color} size="small" />
        : <Text style={{ color, fontSize: 14, fontWeight: '700' }}>{label}</Text>
      }
    </TouchableOpacity>
  )
}

// ─── main screen ──────────────────────────────────────────────────────────────

export default function AdminUserDetailScreen() {
  const router = useRouter()
  const { userId } = useLocalSearchParams<{ userId: string }>()

  const [user, setUser]         = useState<AdminUserDetail | null>(null)
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [busy, setBusy]         = useState<string | null>(null) // which action is loading

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await apiRequest<AdminUserDetail>(`/admin/users/${userId}`)
      setUser(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load user')
    }
  }, [userId])

  useFocusEffect(useCallback(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load]))

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  async function runAction(key: string, fn: () => Promise<void>) {
    setBusy(key)
    try {
      await fn()
      await load()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  function confirmActivate(days: number) {
    Alert.alert(
      `Activate ${days === 365 ? '1 Year' : '1 Month'}`,
      `Activate ${user?.username}'s subscription for ${days} days?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: () => runAction(`activate_${days}`, () =>
            apiRequest(`/admin/activate/${userId}`, { method: 'POST', body: { days } })
          ),
        },
      ]
    )
  }

  function confirmExtend() {
    Alert.alert(
      'Extend 7 Days',
      `Grant ${user?.username} a 7-day grace extension?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Extend',
          onPress: () => runAction('extend', () =>
            apiRequest(`/admin/extend/${userId}`, { method: 'POST', body: { days: 7 } })
          ),
        },
      ]
    )
  }

  function confirmSuspend() {
    Alert.alert(
      'Suspend Account',
      `Suspend ${user?.username}? They will lose access immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Suspend',
          style: 'destructive',
          onPress: () => runAction('suspend', () =>
            apiRequest(`/admin/suspend/${userId}`, { method: 'POST' })
          ),
        },
      ]
    )
  }

  function confirmUnsuspend() {
    Alert.alert(
      'Unsuspend Account',
      `Restore ${user?.username}'s access?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unsuspend',
          onPress: () => runAction('unsuspend', () =>
            apiRequest(`/admin/unsuspend/${userId}`, { method: 'POST' })
          ),
        },
      ]
    )
  }

  function confirmDelete() {
    Alert.alert(
      'Delete Account',
      `Permanently delete ${user?.username}'s account? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => runAction('delete', async () => {
            await apiRequest(`/admin/users/${userId}`, { method: 'DELETE' })
            router.back()
          }),
        },
      ]
    )
  }

  // ── render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#C8A84B" />
      </View>
    )
  }

  if (error || !user) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ color: '#EF4444', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>{error ?? 'User not found'}</Text>
        <TouchableOpacity
          onPress={() => { setLoading(true); load().finally(() => setLoading(false)) }}
          style={{ backgroundColor: '#C8A84B22', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 }}
        >
          <Text style={{ color: '#C8A84B', fontWeight: '700' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const statusCol = statusColor(user.subscriptionStatus)
  const isSuspended = user.subscriptionStatus === 'suspended'

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>

      {/* Header */}
      <View style={{
        paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16,
        borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
        flexDirection: 'row', alignItems: 'center',
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }} activeOpacity={0.7}>
          <Text style={{ color: '#C8A84B', fontSize: 15 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '800', flex: 1 }}>User Detail</Text>
        {user.isAdmin && (
          <View style={{ backgroundColor: '#C8A84B22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: '#C8A84B', fontSize: 10, fontWeight: '700' }}>ADMIN</Text>
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C8A84B" />}
      >

        {/* Identity card */}
        <View style={{
          backgroundColor: '#141414', borderRadius: 14,
          borderWidth: 1, borderColor: '#2A2A2A',
          padding: 16, marginBottom: 16,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>@{user.username}</Text>
              <Text style={{ color: '#606060', fontSize: 12, marginTop: 2 }}>{user.email}</Text>
            </View>
            <View style={{ backgroundColor: `${statusCol}22`, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
              <Text style={{ color: statusCol, fontSize: 12, fontWeight: '700' }}>{statusLabel(user.subscriptionStatus)}</Text>
            </View>
          </View>

          <InfoRow label="TK-ID"         value={user.tiknokId ?? '—'} />
          <InfoRow label="Tier"          value={user.subscriptionTier === 'pro' ? 'Pro' : 'Free'} valueColor={user.subscriptionTier === 'pro' ? '#22C55E' : '#606060'} />
          <InfoRow label="Trial ends"    value={user.trialEndsAt ? `${formatDate(user.trialEndsAt)} · ${daysUntil(user.trialEndsAt)}` : '—'} />
          <InfoRow label="Paid until"    value={user.paidUntil   ? `${formatDate(user.paidUntil)}   · ${daysUntil(user.paidUntil)}`   : '—'} />
          <InfoRow label="Data deletes"  value={user.dataDeletesAt ? formatDate(user.dataDeletesAt) : '—'} valueColor={user.dataDeletesAt ? '#EF4444' : '#606060'} />
          <InfoRow label="Joined"        value={formatDate(user.createdAt)} />
        </View>

        {/* Actions */}
        <Text style={{ color: '#606060', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          Actions
        </Text>

        {/* Activate */}
        <ActionButton
          label="✓  Activate — 1 Month (30 days)"
          color="#22C55E"
          loading={busy === 'activate_30'}
          onPress={() => confirmActivate(30)}
        />
        <ActionButton
          label="✓  Activate — 1 Year (365 days)"
          color="#22C55E"
          loading={busy === 'activate_365'}
          onPress={() => confirmActivate(365)}
        />

        {/* Extend */}
        <ActionButton
          label="⊕  Extend Grace — 7 Days"
          color="#3B82F6"
          loading={busy === 'extend'}
          onPress={confirmExtend}
        />

        {/* Suspend / Unsuspend */}
        {isSuspended ? (
          <ActionButton
            label="↑  Unsuspend Account"
            color="#C8A84B"
            loading={busy === 'unsuspend'}
            onPress={confirmUnsuspend}
          />
        ) : (
          <ActionButton
            label="⊘  Suspend Account"
            color="#F59E0B"
            loading={busy === 'suspend'}
            onPress={confirmSuspend}
          />
        )}

        {/* Delete — only if not admin */}
        {!user.isAdmin && (
          <ActionButton
            label="✕  Delete Account"
            color="#EF4444"
            loading={busy === 'delete'}
            onPress={confirmDelete}
          />
        )}

      </ScrollView>
    </View>
  )
}
