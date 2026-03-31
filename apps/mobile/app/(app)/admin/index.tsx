import { useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, TextInput,
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { apiRequest } from '../../../lib/api'

// ─── types ────────────────────────────────────────────────────────────────────

interface AdminStats {
  users: {
    total: number
    trial: number
    active: number
    expired: number
    suspended: number
    newToday: number
    newThisWeek: number
    trialEndingThisWeek: number
  }
}

interface AdminUser {
  _id: string
  username: string
  email: string
  tiknokId: string | null
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'suspended'
  subscriptionTier: 'free' | 'pro'
  trialEndsAt: string | null
  paidUntil: string | null
  isAdmin: boolean
  createdAt: string | null
}

interface UsersResponse {
  users: AdminUser[]
  total: number
  page: number
  pages: number
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

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff <= 0) return 'Ended'
  return `${diff}d left`
}

// ─── stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={{
      flex: 1, backgroundColor: '#141414', borderRadius: 14,
      borderWidth: 1, borderColor: '#2A2A2A', padding: 14,
    }}>
      <Text style={{ color: color ?? '#FFFFFF', fontSize: 24, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: '#606060', fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  )
}

// ─── user row ─────────────────────────────────────────────────────────────────

function UserRow({ user, onPress }: { user: AdminUser; onPress: () => void }) {
  const color = statusColor(user.subscriptionStatus)
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        backgroundColor: '#141414', borderRadius: 12,
        borderWidth: 1, borderColor: '#2A2A2A',
        padding: 14, marginBottom: 8,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>@{user.username}</Text>
          {user.isAdmin && (
            <View style={{ backgroundColor: '#C8A84B22', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
              <Text style={{ color: '#C8A84B', fontSize: 9, fontWeight: '700' }}>ADMIN</Text>
            </View>
          )}
        </View>
        <Text style={{ color: '#606060', fontSize: 11 }}>{user.tiknokId ?? '—'} · {user.email}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <View style={{ backgroundColor: `${color}22`, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{statusLabel(user.subscriptionStatus)}</Text>
        </View>
        <Text style={{ color: '#606060', fontSize: 10 }}>
          {user.subscriptionStatus === 'trial'  ? daysUntil(user.trialEndsAt) :
           user.subscriptionStatus === 'active' ? daysUntil(user.paidUntil)   : ''}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

// ─── filter pill ──────────────────────────────────────────────────────────────

const FILTERS = [
  { label: 'All',       value: '' },
  { label: 'Trial',     value: 'trial' },
  { label: 'Active',    value: 'active' },
  { label: 'Expired',   value: 'expired' },
  { label: 'Suspended', value: 'suspended' },
]

// ─── main screen ──────────────────────────────────────────────────────────────

export default function AdminScreen() {
  const router = useRouter()

  const [stats, setStats]         = useState<AdminStats | null>(null)
  const [users, setUsers]         = useState<AdminUser[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [isAdmin, setIsAdmin]     = useState<boolean | null>(null)

  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('')

  const load = useCallback(async (q = search, f = filter) => {
    try {
      setError(null)

      // Check admin access first via /auth/me
      const me = await apiRequest<{ isAdmin: boolean }>('/auth/me')
      if (!me.isAdmin) { setIsAdmin(false); return }
      setIsAdmin(true)

      const params = new URLSearchParams()
      if (f) params.set('status', f)
      if (q) params.set('search', q)

      const [statsRes, usersRes] = await Promise.all([
        apiRequest<AdminStats>('/admin/stats'),
        apiRequest<UsersResponse>(`/admin/users?${params.toString()}`),
      ])
      setStats(statsRes)
      setUsers(usersRes.users)
      setTotal(usersRes.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
  }, [search, filter])

  useFocusEffect(useCallback(() => {
    setLoading(true)
    load().finally(() => setLoading(false))
  }, [load]))

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  // Not admin
  if (isAdmin === false) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 32, marginBottom: 12 }}>🔒</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Access Denied</Text>
        <Text style={{ color: '#606060', fontSize: 13, marginTop: 6 }}>Admin only.</Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#C8A84B" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ color: '#EF4444', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>{error}</Text>
        <TouchableOpacity
          onPress={() => { setLoading(true); load().finally(() => setLoading(false)) }}
          style={{ backgroundColor: '#C8A84B22', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 }}
        >
          <Text style={{ color: '#C8A84B', fontWeight: '700' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

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
        <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '800', flex: 1 }}>Admin Panel</Text>
        <View style={{ backgroundColor: '#C8A84B22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ color: '#C8A84B', fontSize: 10, fontWeight: '700' }}>ADMIN</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C8A84B" />}
      >

        {/* Stats grid */}
        {stats && (
          <>
            <Text style={{ color: '#606060', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Overview
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <StatCard label="Total Users"  value={stats.users.total} />
              <StatCard label="Active (Pro)"  value={stats.users.active}  color="#22C55E" />
              <StatCard label="On Trial"     value={stats.users.trial}   color="#C8A84B" />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
              <StatCard label="Expired"      value={stats.users.expired}   color="#EF4444" />
              <StatCard label="New Today"    value={stats.users.newToday}  color="#3B82F6" />
              <StatCard label="Trial Ending Soon" value={stats.users.trialEndingThisWeek} color="#F59E0B" />
            </View>
          </>
        )}

        {/* Search */}
        <TextInput
          style={{
            backgroundColor: '#141414', color: '#FFFFFF', fontSize: 14,
            borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A',
            paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10,
          }}
          placeholder="Search username, email, TK-ID..."
          placeholderTextColor="#606060"
          value={search}
          onChangeText={(v) => {
            setSearch(v)
            load(v, filter)
          }}
          returnKeyType="search"
        />

        {/* Filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {FILTERS.map((f) => (
              <TouchableOpacity
                key={f.value}
                onPress={() => { setFilter(f.value); load(search, f.value) }}
                activeOpacity={0.8}
                style={{
                  backgroundColor: filter === f.value ? '#C8A84B' : '#1E1E1E',
                  borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7,
                  borderWidth: 1, borderColor: filter === f.value ? '#C8A84B' : '#2A2A2A',
                }}
              >
                <Text style={{ color: filter === f.value ? '#0A0A0A' : '#A0A0A0', fontSize: 12, fontWeight: '700' }}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Users list */}
        <Text style={{ color: '#606060', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
          Users ({total})
        </Text>

        {users.length === 0 ? (
          <Text style={{ color: '#606060', fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>No users found.</Text>
        ) : (
          users.map((user) => (
            <UserRow
              key={user._id}
              user={user}
              onPress={() => router.push(`/(app)/admin/user/${user._id}` as any)}
            />
          ))
        )}

      </ScrollView>
    </View>
  )
}
