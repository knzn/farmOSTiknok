import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Dimensions,
} from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState, useCallback } from 'react'
import { useFocusEffect } from 'expo-router'
import { apiRequest } from '../../../lib/api'
import { useAuthStore } from '../../../stores/auth'
import { PostModal } from '../../../components/PostModal'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const GRID_GAP = 2
const GRID_SIZE = (SCREEN_WIDTH - GRID_GAP * 4) / 3

interface UserProfile {
  id: string
  username: string
  profilePhoto: string | null
  coverPhoto: string | null
  bio: string
  location: string
  isBreeder: boolean
  followerCount: number
  followingCount: number
  isFollowing: boolean
}

interface GridPost {
  id: string
  thumbnailUrl: string | null
  type: string
  likeCount: number
  commentCount: number
}

export default function ProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  const router = useRouter()
  const currentUserId = useAuthStore(s => s.userId)
  const clearTokens = useAuthStore(s => s.clearTokens)

  const isMe = userId === 'me' || userId === currentUserId

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [posts, setPosts] = useState<GridPost[]>([])
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalPostId, setModalPostId] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    try {
      setError(null)
      const targetId = isMe ? currentUserId : userId
      const [profileData, postsData] = await Promise.all([
        apiRequest<UserProfile>(`/users/${targetId}`),
        apiRequest<{ posts: GridPost[] }>(`/users/${targetId}/posts`),
      ])
      setProfile(profileData)
      setFollowing(profileData.isFollowing)
      setPosts(postsData.posts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile')
    }
  }, [isMe, userId, currentUserId])

  useFocusEffect(useCallback(() => {
    setLoading(true)
    loadProfile().finally(() => setLoading(false))
  }, [loadProfile]))

  const handleFollow = async () => {
    if (!profile || followLoading) return
    setFollowLoading(true)
    try {
      await apiRequest(`/users/${profile.id}/${following ? 'unfollow' : 'follow'}`, { method: 'POST' })
      setFollowing(!following)
      setProfile(p => p ? {
        ...p,
        followerCount: following ? p.followerCount - 1 : p.followerCount + 1,
        isFollowing: !following,
      } : p)
    } catch { /* ignore */ } finally {
      setFollowLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F0F11' }}>
        {/* Banner skeleton */}
        <View style={{ width: '100%', height: 150, backgroundColor: '#1E1E1E' }} />
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          {/* Avatar skeleton */}
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#27272A', marginTop: -40, marginBottom: 12, borderWidth: 3, borderColor: '#0F0F11' }} />
          {/* Username skeleton */}
          <View style={{ width: 140, height: 18, borderRadius: 8, backgroundColor: '#27272A', marginBottom: 8 }} />
          <View style={{ width: 100, height: 13, borderRadius: 6, backgroundColor: '#1E1E1E', marginBottom: 16 }} />
          {/* Stats skeleton */}
          <View style={{ flexDirection: 'row', marginBottom: 20 }}>
            {[80, 80, 80].map((w, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <View style={{ width: w * 0.4, height: 18, borderRadius: 6, backgroundColor: '#27272A', marginBottom: 4 }} />
                <View style={{ width: w * 0.6, height: 12, borderRadius: 4, backgroundColor: '#1E1E1E' }} />
              </View>
            ))}
          </View>
          {/* Button skeletons */}
          <View style={{ height: 42, borderRadius: 8, backgroundColor: '#27272A', marginBottom: 10 }} />
          <View style={{ height: 42, borderRadius: 8, backgroundColor: '#1E1E1E' }} />
        </View>
        {/* Grid skeleton */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: GRID_GAP, marginTop: 8 }}>
          {Array.from({ length: 9 }).map((_, i) => (
            <View key={i} style={{ width: GRID_SIZE, height: GRID_SIZE, margin: GRID_GAP, borderRadius: 2, backgroundColor: i % 2 === 0 ? '#1E1E1E' : '#27272A' }} />
          ))}
        </View>
      </View>
    )
  }

  if (error) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center px-8">
        <Text className="text-ink-2 text-base text-center mb-4">{error}</Text>
        <TouchableOpacity
          className="bg-accent rounded-lg px-6 py-3"
          onPress={() => { setLoading(true); loadProfile().finally(() => setLoading(false)) }}
          activeOpacity={0.85}
        >
          <Text className="text-white font-semibold">Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <>
    <ScrollView className="flex-1 bg-canvas">
      {/* Cover banner */}
      <View style={{ width: '100%', height: 150, backgroundColor: '#18181B' }}>
        {profile?.coverPhoto ? (
          <Image source={{ uri: profile.coverPhoto }} style={{ width: '100%', height: 150 }} contentFit="cover" />
        ) : (
          <View style={{ flex: 1, backgroundColor: '#1A1A1A' }} />
        )}
        {/* Gradient scrim at bottom so avatar sits cleanly */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, backgroundColor: 'rgba(15,15,17,0.55)' }} pointerEvents="none" />
        {/* Back button */}
        {(userId !== 'me') && (
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={{ position: 'absolute', top: 52, left: 16, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>‹ Back</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Header info */}
      <View className="px-4 pb-6 border-b border-rim">
        {/* Avatar — overlaps bottom of banner */}
        <View style={{ marginTop: -40, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FF3D5A33', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 3, borderColor: '#0F0F11' }}>
            {profile?.profilePhoto ? (
              <Image source={{ uri: profile.profilePhoto }} style={{ width: 80, height: 80 }} />
            ) : (
              <Text className="text-accent text-3xl font-bold">
                {profile?.username?.[0]?.toUpperCase() ?? '?'}
              </Text>
            )}
          </View>
        </View>

        {/* Username + badges */}
        <View className="flex-row items-center gap-2 mb-1">
          <Text className="text-ink text-xl font-bold">@{profile?.username}</Text>
          {profile?.isBreeder && <Text>🐓</Text>}
        </View>
        {profile?.location ? (
          <Text className="text-ink-2 text-sm mb-3">📍 {profile.location}</Text>
        ) : null}

        {/* Bio */}
        {profile?.bio ? (
          <Text className="text-ink-2 text-sm mb-5 leading-5">{profile.bio}</Text>
        ) : null}

        {/* Stats */}
        <View style={{ flexDirection: 'row', marginBottom: 20 }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text className="text-ink font-bold text-lg">{posts.length}</Text>
            <Text className="text-ink-2 text-xs mt-0.5">Posts</Text>
          </View>
          <View style={{ width: 1, backgroundColor: '#27272A', marginVertical: 4 }} />
          <TouchableOpacity
            style={{ flex: 1, alignItems: 'center' }}
            onPress={() => profile && router.push(`/(app)/profile/connections?userId=${profile.id}&type=followers` as any)}
            activeOpacity={0.7}
          >
            <Text className="text-ink font-bold text-lg">{profile?.followerCount ?? 0}</Text>
            <Text className="text-ink-2 text-xs mt-0.5">Followers</Text>
          </TouchableOpacity>
          <View style={{ width: 1, backgroundColor: '#27272A', marginVertical: 4 }} />
          <TouchableOpacity
            style={{ flex: 1, alignItems: 'center' }}
            onPress={() => profile && router.push(`/(app)/profile/connections?userId=${profile.id}&type=following` as any)}
            activeOpacity={0.7}
          >
            <Text className="text-ink font-bold text-lg">{profile?.followingCount ?? 0}</Text>
            <Text className="text-ink-2 text-xs mt-0.5">Following</Text>
          </TouchableOpacity>
        </View>

        {/* Action buttons */}
        {isMe ? (
          <View className="gap-3">
            <TouchableOpacity
              className="bg-accent rounded-lg py-3 items-center"
              onPress={() => router.push('/(app)/profile/edit' as any)}
              activeOpacity={0.85}
            >
              <Text className="text-white font-semibold text-sm">Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-card rounded-lg py-3 items-center border border-rim"
              onPress={() => router.push('/(app)/breeder' as any)}
              activeOpacity={0.8}
            >
              <Text className="text-ink font-semibold text-sm">🐓  Breeder Module</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={clearTokens}
              activeOpacity={0.6}
              style={{ alignItems: 'center', paddingVertical: 10 }}
            >
              <Text style={{ color: '#EF4444', fontSize: 13 }}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            className={`rounded-lg py-3 items-center border ${following ? 'bg-transparent border-rim' : 'bg-accent border-accent'}`}
            onPress={handleFollow}
            disabled={followLoading}
            activeOpacity={0.85}
          >
            {followLoading
              ? <ActivityIndicator color={following ? '#FF3D5A' : '#FFF'} size="small" />
              : <Text className={`font-semibold text-sm ${following ? 'text-ink-2' : 'text-white'}`}>
                  {following ? 'Following' : 'Follow'}
                </Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* Posts grid */}
      <View className="mt-0.5">
        {posts.length === 0 ? (
          <View className="items-center py-16">
            <Text className="text-4xl mb-3">📷</Text>
            <Text className="text-ink-2 text-sm">No posts yet</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: GRID_GAP }}>
            {posts.map(post => (
              <TouchableOpacity
                key={post.id}
                style={{ width: GRID_SIZE, height: GRID_SIZE, margin: GRID_GAP }}
                onPress={() => setModalPostId(post.id)}
                activeOpacity={0.8}
              >
                {post.thumbnailUrl ? (
                  <View>
                    <Image
                      source={{ uri: post.thumbnailUrl }}
                      style={{ width: GRID_SIZE, height: GRID_SIZE }}
                      contentFit="cover"
                    />
                    {post.type === 'video' && (
                      <View style={{
                        position: 'absolute', top: 4, right: 4,
                        backgroundColor: 'rgba(255,61,90,0.85)', borderRadius: 4,
                        paddingHorizontal: 5, paddingVertical: 2,
                      }}>
                        <Text style={{ color: '#fff', fontSize: 10 }}>▶</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={{ width: GRID_SIZE, height: GRID_SIZE, backgroundColor: '#18181B', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#555', fontSize: 11 }}>No image</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>

    <PostModal
      postId={modalPostId}
      onClose={() => setModalPostId(null)}
      currentUserId={currentUserId}
    />
    </>
  )
}
