import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { apiRequest } from '../../../lib/api'

interface UserItem {
  id: string
  username: string
  profilePhoto: string | null
  isBreeder: boolean
  followerCount: number
  isFollowing: boolean
}

export default function ConnectionsScreen() {
  const { userId, type } = useLocalSearchParams<{ userId: string; type: 'followers' | 'following' }>()
  const router = useRouter()

  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      apiRequest<{ users: UserItem[] }>(`/users/${userId}/${type}`)
        .then((data) => setUsers(data.users))
        .catch(() => {})
        .finally(() => setLoading(false))
    }, [userId, type]),
  )

  async function handleFollow(item: UserItem) {
    if (followingIds.has(item.id)) return
    setFollowingIds(prev => new Set(prev).add(item.id))
    const action = item.isFollowing ? 'unfollow' : 'follow'
    try {
      await apiRequest(`/users/${item.id}/${action}`, { method: 'POST' })
      setUsers((prev) =>
        prev.map((u) =>
          u.id === item.id
            ? { ...u, isFollowing: !u.isFollowing, followerCount: u.isFollowing ? u.followerCount - 1 : u.followerCount + 1 }
            : u,
        ),
      )
    } catch { /* ignore */ } finally {
      setFollowingIds(prev => { const s = new Set(prev); s.delete(item.id); return s })
    }
  }

  return (
    <View className="flex-1 bg-canvas">
      {/* Header */}
      <View className="pt-14 pb-3 px-4 border-b border-rim">
        <TouchableOpacity onPress={() => router.back()} className="mb-3" activeOpacity={0.7}>
          <Text className="text-accent text-base">‹ Back</Text>
        </TouchableOpacity>
        <Text className="text-ink text-xl font-bold capitalize">{type}</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF3D5A" />
        </View>
      ) : users.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#18181B', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 32 }}>{type === 'followers' ? '👥' : '🔍'}</Text>
          </View>
          <Text className="text-ink font-semibold text-lg text-center mb-2">
            {type === 'followers' ? 'No followers yet' : 'Not following anyone'}
          </Text>
          <Text className="text-ink-2 text-sm text-center leading-5">
            {type === 'followers'
              ? 'Share your posts and interact with the community to grow your following.'
              : 'Follow breeders and enthusiasts to see their posts in your feed.'}
          </Text>
        </View>
      ) : (
        <FlashList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}
          renderItem={({ item }) => (
            <View className="flex-row items-center py-3 border-b border-rim">
              <TouchableOpacity
                className="flex-row items-center flex-1"
                onPress={() => router.push(`/(app)/profile/${item.id}` as any)}
                activeOpacity={0.7}
              >
                <View className="w-12 h-12 rounded-full bg-accent-muted items-center justify-center mr-3 overflow-hidden">
                  {item.profilePhoto ? (
                    <Image source={{ uri: item.profilePhoto }} style={{ width: 48, height: 48 }} />
                  ) : (
                    <Text className="text-accent text-lg font-bold">
                      {item.username[0].toUpperCase()}
                    </Text>
                  )}
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-1">
                    <Text className="text-ink font-semibold text-sm">@{item.username}</Text>
                    {item.isBreeder && <Text className="text-xs">🐓</Text>}
                  </View>
                  <Text className="text-ink-2 text-xs">{item.followerCount} followers</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                className={`px-4 py-1.5 rounded-full border ${
                  item.isFollowing ? 'border-rim' : 'bg-accent border-accent'
                }`}
                onPress={() => handleFollow(item)}
                disabled={followingIds.has(item.id)}
                activeOpacity={0.7}
                style={{ minWidth: 76, alignItems: 'center' }}
              >
                {followingIds.has(item.id) ? (
                  <ActivityIndicator size="small" color={item.isFollowing ? '#A1A1AA' : '#FFF'} style={{ height: 16 }} />
                ) : (
                  <Text className={`text-xs font-semibold ${item.isFollowing ? 'text-ink-2' : 'text-white'}`}>
                    {item.isFollowing ? 'Following' : 'Follow'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  )
}
