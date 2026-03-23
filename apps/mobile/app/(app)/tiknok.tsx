import {
  View, Text, TouchableOpacity, FlatList, RefreshControl,
  ActivityIndicator, Dimensions, TextInput, ListRenderItemInfo,
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useFocusEffect } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'
import { apiRequest } from '../../lib/api'
import { useAuthStore } from '../../stores/auth'
import SimpleBottomSheet, { BottomSheetScrollView, type SimpleBottomSheetRef } from '../../components/SimpleBottomSheet'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

interface Author {
  id: string
  username: string
  profilePhoto: string | null
  isBreeder: boolean
}

interface VideoPost {
  id: string
  author: Author
  hlsUrl: string | null
  thumbnailUrl: string | null
  caption: string
  hashtags: string[]
  likeCount: number
  liked: boolean
  commentCount: number
  viewCount: number
  processingStatus: string | null
}

interface Comment { id: string; author: Author; text: string; createdAt: string }

// ─── VideoCard ─────────────────────────────────────────────────────────────────

function VideoCard({
  item, isActive, height, onLike, onView, onAuthorPress, onCommentPress,
}: {
  item: VideoPost
  isActive: boolean
  height: number
  onLike: (id: string, liked: boolean) => void
  onView: (id: string) => void
  onAuthorPress: (id: string) => void
  onCommentPress: (id: string) => void
}) {
  const [muted, setMuted] = useState(true)
  const viewedRef = useRef(false)

  const player = useVideoPlayer(null, (p) => {
    p.loop = true
    p.muted = true
  })

  useEffect(() => {
    if (!item.hlsUrl) return
    let cancelled = false
    if (isActive) {
      player.replaceAsync(item.hlsUrl).then(() => {
        if (!cancelled) player.play()
      }).catch(() => {})
      viewedRef.current = false
      const timer = setTimeout(() => {
        if (!viewedRef.current) {
          viewedRef.current = true
          onView(item.id)
        }
      }, 3000)
      return () => { cancelled = true; clearTimeout(timer) }
    } else {
      player.pause()
      player.currentTime = 0
      player.replaceAsync(null).catch(() => {})
    }
  }, [isActive, item.hlsUrl])

  useEffect(() => { player.muted = muted }, [muted])

  const isProcessing = item.processingStatus === 'pending' || item.processingStatus === 'processing'

  return (
    <View style={{ width: SCREEN_WIDTH, height, backgroundColor: '#000' }}>
      {item.hlsUrl && !isProcessing ? (
        <VideoView
          player={player}
          style={{ width: SCREEN_WIDTH, height }}
          contentFit="contain"
          nativeControls={false}
        />
      ) : item.thumbnailUrl ? (
        <Image source={{ uri: item.thumbnailUrl }} style={{ width: SCREEN_WIDTH, height }} contentFit="cover" />
      ) : (
        <View style={{ width: SCREEN_WIDTH, height, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 48 }}>🎬</Text>
          {isProcessing && <Text style={{ color: '#A0A0A0', fontSize: 13, marginTop: 12 }}>Processing video...</Text>}
        </View>
      )}

      {/* Scrim */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 200, backgroundColor: 'rgba(0,0,0,0.45)' }} pointerEvents="none" />

      {/* Author + caption */}
      <View style={{ position: 'absolute', bottom: 24, left: 16, right: 80 }}>
        <TouchableOpacity
          onPress={() => onAuthorPress(item.author?.id)}
          activeOpacity={0.8}
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
        >
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,61,90,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 8, overflow: 'hidden' }}>
            {item.author?.profilePhoto
              ? <Image source={{ uri: item.author.profilePhoto }} style={{ width: 36, height: 36 }} />
              : <Text style={{ color: '#FF3D5A', fontWeight: 'bold' }}>{item.author?.username?.[0]?.toUpperCase() ?? '?'}</Text>
            }
          </View>
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>@{item.author?.username}</Text>
          {item.author?.isBreeder && <Text style={{ marginLeft: 4, fontSize: 14 }}>🐓</Text>}
        </TouchableOpacity>
        {item.caption ? (
          <Text style={{ color: '#FFFFFF', fontSize: 13, lineHeight: 18 }} numberOfLines={2}>{item.caption}</Text>
        ) : null}
        {item.hashtags.length > 0 && (
          <Text style={{ color: '#7B61FF', fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {item.hashtags.map(h => `#${h}`).join(' ')}
          </Text>
        )}
      </View>

      {/* Action buttons */}
      <View style={{ position: 'absolute', right: 12, bottom: 24, alignItems: 'center', gap: 20 }}>
        <TouchableOpacity onPress={() => onLike(item.id, item.liked)} activeOpacity={0.7} style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 28, color: item.liked ? '#FF3D5A' : '#FFFFFF' }}>{item.liked ? '♥' : '♡'}</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 12, marginTop: 2 }}>{item.likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onCommentPress(item.id)} activeOpacity={0.7} style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 26 }}>💬</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 12, marginTop: 2 }}>{item.commentCount}</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 22, color: '#FFFFFF' }}>👁</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 12, marginTop: 2 }}>{item.viewCount}</Text>
        </View>
        <TouchableOpacity onPress={() => setMuted(m => !m)} activeOpacity={0.7} style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 24, color: '#FFFFFF' }}>{muted ? '🔇' : '🔊'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ─── CommentsSheet ─────────────────────────────────────────────────────────────

function CommentsSheet({ postId, sheetRef }: {
  postId: string | null
  sheetRef: React.RefObject<SimpleBottomSheetRef | null>
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!postId) return
    setLoading(true)
    setComments([])
    apiRequest<{ comments: Comment[]; nextCursor: string | null }>(`/posts/${postId}/comments`)
      .then(data => setComments(data.comments))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [postId])

  const handleComment = async () => {
    if (!postId || !commentText.trim() || submitting) return
    setSubmitting(true)
    try {
      const comment = await apiRequest<Comment>(`/posts/${postId}/comments`, {
        method: 'POST', body: { text: commentText.trim() },
      })
      setComments(prev => [comment, ...prev])
      setCommentText('')
    } catch { /* ignore */ } finally { setSubmitting(false) }
  }

  return (
    <SimpleBottomSheet
      ref={sheetRef}
      snapPoints={['75%']}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: '#18181B' }}
      handleIndicatorStyle={{ backgroundColor: '#A1A1AA' }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#27272A' }}>
          <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }}>Comments</Text>
        </View>
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          {loading ? (
            <ActivityIndicator color="#FF3D5A" style={{ marginTop: 20 }} />
          ) : comments.length === 0 ? (
            <Text style={{ color: '#A1A1AA', fontSize: 13, textAlign: 'center', marginTop: 20 }}>No comments yet. Be first!</Text>
          ) : (
            comments.map(c => (
              <View key={c.id} style={{ flexDirection: 'row', marginBottom: 14 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#27272A', alignItems: 'center', justifyContent: 'center', marginRight: 8, marginTop: 2 }}>
                  <Text style={{ color: '#A1A1AA', fontSize: 11, fontWeight: '700' }}>{c.author?.username?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#FFF', fontSize: 13, lineHeight: 18 }}>
                    <Text style={{ fontWeight: '700' }}>@{c.author?.username} </Text>
                    {c.text}
                  </Text>
                  <Text style={{ color: '#A1A1AA', fontSize: 11, marginTop: 3 }}>{timeAgo(c.createdAt)}</Text>
                </View>
              </View>
            ))
          )}
        </BottomSheetScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#27272A' }}>
          <TextInput
            style={{ flex: 1, backgroundColor: '#0F0F11', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, color: '#FFF', fontSize: 14, borderWidth: 1, borderColor: '#27272A', marginRight: 10 }}
            placeholder="Add a comment..."
            placeholderTextColor="#A1A1AA"
            value={commentText}
            onChangeText={setCommentText}
            returnKeyType="send"
            onSubmitEditing={handleComment}
          />
          <TouchableOpacity onPress={handleComment} disabled={submitting || !commentText.trim()} activeOpacity={0.7}>
            {submitting
              ? <ActivityIndicator color="#FF3D5A" size="small" />
              : <Text style={{ color: commentText.trim() ? '#FF3D5A' : '#A1A1AA', fontWeight: '700', fontSize: 14 }}>Post</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </SimpleBottomSheet>
  )
}

// ─── Tiknok Screen ─────────────────────────────────────────────────────────────

export default function TiknokScreen() {
  const router = useRouter()
  const _currentUserId = useAuthStore(s => s.userId)
  const [videos, setVideos] = useState<VideoPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [commentPostId, setCommentPostId] = useState<string | null>(null)
  const [newVideosCount, setNewVideosCount] = useState(0)
  const newVideosBannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commentSheetRef = useRef<SimpleBottomSheetRef>(null)
  const hasLoadedRef = useRef(false)

  const loadVideos = useCallback(async (cursor?: string) => {
    try {
      setError(null)
      const url = cursor ? `/posts/video-feed?cursor=${cursor}` : '/posts/video-feed'
      const data = await apiRequest<{ videos: VideoPost[]; nextCursor: string | null }>(url)
      if (cursor) {
        setVideos(prev => [...prev, ...data.videos])
      } else {
        setVideos(data.videos)
      }
      setNextCursor(data.nextCursor)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load videos')
    }
  }, [])

  useFocusEffect(useCallback(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      setLoading(true)
      loadVideos().finally(() => setLoading(false))
    }
  }, [loadVideos]))

  const onEndReached = useCallback(async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    await loadVideos(nextCursor)
    setLoadingMore(false)
  }, [nextCursor, loadingMore, loadVideos])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setNextCursor(null)
    hasLoadedRef.current = false
    const prevCount = videos.length
    await loadVideos()
    hasLoadedRef.current = true
    setRefreshing(false)
    setVideos(current => {
      const diff = current.length - prevCount
      if (diff > 0) {
        setNewVideosCount(diff)
        if (newVideosBannerTimer.current) clearTimeout(newVideosBannerTimer.current)
        newVideosBannerTimer.current = setTimeout(() => setNewVideosCount(0), 3000)
      }
      return current
    })
  }, [loadVideos, videos.length])

  const handleLike = useCallback(async (id: string, liked: boolean) => {
    setVideos(prev => prev.map(v =>
      v.id === id ? { ...v, liked: !liked, likeCount: liked ? v.likeCount - 1 : v.likeCount + 1 } : v
    ))
    try {
      await apiRequest(`/posts/${id}/${liked ? 'unlike' : 'like'}`, { method: 'POST' })
    } catch {
      setVideos(prev => prev.map(v =>
        v.id === id ? { ...v, liked, likeCount: liked ? v.likeCount + 1 : v.likeCount - 1 } : v
      ))
    }
  }, [])

  const handleView = useCallback((id: string) => {
    apiRequest(`/posts/${id}/view`, { method: 'POST' }).catch(() => {})
  }, [])

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 })
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0)
  })

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#FF3D5A" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ color: '#A1A1AA', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>{error}</Text>
        <TouchableOpacity
          style={{ backgroundColor: '#FF3D5A', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 }}
          onPress={() => { setLoading(true); hasLoadedRef.current = false; loadVideos().finally(() => setLoading(false)) }}
          activeOpacity={0.85}
        >
          <Text style={{ color: '#FFF', fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (videos.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🎬</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>No videos yet</Text>
        <Text style={{ color: '#A1A1AA', fontSize: 13, textAlign: 'center' }}>Be the first to post a short video</Text>
      </View>
    )
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: '#000' }}
      onLayout={e => setContainerHeight(e.nativeEvent.layout.height)}
    >
      {containerHeight > 0 && (
        <FlatList<VideoPost>
          data={videos}
          keyExtractor={item => item.id}
          style={{ height: containerHeight }}
          renderItem={({ item, index }: ListRenderItemInfo<VideoPost>) => (
            <VideoCard
              item={item}
              isActive={index === activeIndex}
              height={containerHeight}
              onLike={handleLike}
              onView={handleView}
              onAuthorPress={id => router.push(`/(app)/profile/${id}` as any)}
              onCommentPress={id => { setCommentPostId(id); commentSheetRef.current?.expand() }}
            />
          )}
          snapToInterval={containerHeight}
          snapToAlignment="start"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({ length: containerHeight, offset: containerHeight * index, index })}
          viewabilityConfig={viewabilityConfig.current}
          onViewableItemsChanged={onViewableItemsChanged.current}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FF3D5A" />}
          ListFooterComponent={loadingMore ? (
            <View style={{ height: containerHeight, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#FF3D5A" />
            </View>
          ) : null}
        />
      )}
      {newVideosCount > 0 && (
        <TouchableOpacity
          onPress={() => setNewVideosCount(0)}
          activeOpacity={0.85}
          style={{
            position: 'absolute', top: 56, alignSelf: 'center',
            backgroundColor: '#FF3D5A', borderRadius: 999,
            paddingHorizontal: 18, paddingVertical: 8,
            flexDirection: 'row', alignItems: 'center', gap: 6,
          }}
        >
          <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '700' }}>
            ▲ {newVideosCount} new {newVideosCount === 1 ? 'video' : 'videos'}
          </Text>
        </TouchableOpacity>
      )}
      <CommentsSheet postId={commentPostId} sheetRef={commentSheetRef} />
    </View>
  )
}
