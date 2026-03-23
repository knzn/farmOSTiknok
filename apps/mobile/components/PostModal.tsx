import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, Modal, ActivityIndicator, Alert, Dimensions, NativeScrollEvent, NativeSyntheticEvent,
} from 'react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useVideoPlayer, VideoView } from 'expo-video'
import { apiRequest } from '../lib/api'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface Author { id: string; username: string; profilePhoto: string | null }
interface Comment { id: string; author: Author; text: string; createdAt: string }
interface PostDetail {
  id: string; author: Author; type: 'photo' | 'video'
  thumbnailUrl: string | null; hlsUrl: string | null; processingStatus: string | null
  caption: string; hashtags: string[]
  likeCount: number; liked: boolean; commentCount: number; createdAt: string
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export function PostModal({ postId, onClose, currentUserId }: {
  postId: string | null
  onClose: () => void
  currentUserId: string | null
}) {
  const router = useRouter()
  const [post, setPost] = useState<PostDetail | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMoreComments, setLoadingMoreComments] = useState(false)
  const [muted, setMuted] = useState(true)
  const loadingMoreRef = useRef(false)

  const isVideoReady = post?.type === 'video' && !!post.hlsUrl && post.processingStatus === 'ready'
  const videoPlayer = useVideoPlayer(isVideoReady ? post!.hlsUrl! : null, p => {
    p.loop = true; p.muted = true
  })

  useEffect(() => {
    if (!postId) { setPost(null); setComments([]); return }
    setLoading(true)
    setCommentText('')
    Promise.all([
      apiRequest<PostDetail>(`/posts/${postId}`),
      apiRequest<{ comments: Comment[]; nextCursor: string | null }>(`/posts/${postId}/comments`),
    ]).then(([p, c]) => {
      setPost(p)
      setLiked(p.liked)
      setLikeCount(p.likeCount)
      setCommentCount(p.commentCount)
      setComments(c.comments)
      setNextCursor(c.nextCursor)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [postId])

  useEffect(() => { if (isVideoReady) videoPlayer.play() }, [isVideoReady])
  useEffect(() => { videoPlayer.muted = muted }, [muted])

  const handleLike = async () => {
    if (!post) return
    const was = liked
    setLiked(!was); setLikeCount(c => was ? c - 1 : c + 1)
    try {
      await apiRequest(`/posts/${post.id}/${was ? 'unlike' : 'like'}`, { method: 'POST' })
    } catch {
      setLiked(was); setLikeCount(c => was ? c + 1 : c - 1)
    }
  }

  const handleComment = async () => {
    if (!post || !commentText.trim() || submitting) return
    setSubmitting(true)
    try {
      const comment = await apiRequest<Comment>(`/posts/${post.id}/comments`, {
        method: 'POST', body: { text: commentText.trim() },
      })
      setComments(prev => [comment, ...prev])
      setCommentCount(c => c + 1)
      setCommentText('')
    } catch { /* ignore */ } finally { setSubmitting(false) }
  }

  const loadMoreComments = useCallback(async () => {
    if (!post || !nextCursor || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMoreComments(true)
    try {
      const data = await apiRequest<{ comments: Comment[]; nextCursor: string | null }>(
        `/posts/${post.id}/comments?cursor=${nextCursor}`
      )
      setComments(prev => [...prev, ...data.comments])
      setNextCursor(data.nextCursor)
    } catch { /* ignore */ } finally {
      setLoadingMoreComments(false)
      loadingMoreRef.current = false
    }
  }, [post, nextCursor])

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
    const nearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100
    if (nearBottom && nextCursor && !loadingMoreRef.current) {
      loadMoreComments()
    }
  }, [nextCursor, loadMoreComments])

  const isOwn = post?.author?.id === currentUserId

  return (
    <Modal visible={!!postId} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#0F0F11' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={{ paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#27272A' }}>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ paddingRight: 16, paddingVertical: 4 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 22, lineHeight: 26 }}>←</Text>
          </TouchableOpacity>
          <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700', flex: 1 }} numberOfLines={1}>
            {post ? `@${post.author?.username}` : ''}
          </Text>
          {isOwn && post && (
            <TouchableOpacity activeOpacity={0.7} onPress={() => Alert.alert('Post Options', '', [
              { text: 'Delete Post', style: 'destructive', onPress: async () => {
                await apiRequest(`/posts/${post.id}`, { method: 'DELETE' }).catch(() => {})
                onClose()
              }},
              { text: 'Cancel', style: 'cancel' },
            ])}>
              <Text style={{ color: '#A1A1AA', fontSize: 22 }}>⋯</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#FF3D5A" />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={200}>
            {/* Author */}
            {post && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}
                onPress={() => { onClose(); router.push(`/(app)/profile/${post.author?.id}` as any) }}
                activeOpacity={0.7}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,61,90,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 10, overflow: 'hidden' }}>
                  {post.author?.profilePhoto
                    ? <Image source={{ uri: post.author.profilePhoto }} style={{ width: 36, height: 36 }} />
                    : <Text style={{ color: '#FF3D5A', fontWeight: 'bold' }}>{post.author?.username?.[0]?.toUpperCase() ?? '?'}</Text>
                  }
                </View>
                <View>
                  <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 14 }}>@{post.author?.username}</Text>
                  <Text style={{ color: '#A1A1AA', fontSize: 12 }}>{timeAgo(post.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Media — portrait 4:5 aspect ratio, no forced square crop */}
            {post?.type === 'video' ? (
              isVideoReady ? (
                <View style={{ width: SCREEN_WIDTH, aspectRatio: 4 / 5 }}>
                  <VideoView player={videoPlayer} style={{ width: SCREEN_WIDTH, height: '100%' }} contentFit="contain" nativeControls={false} />
                  <TouchableOpacity
                    onPress={() => setMuted(m => !m)}
                    style={{ position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, padding: 8 }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 16 }}>{muted ? '🔇' : '🔊'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ width: SCREEN_WIDTH, aspectRatio: 4 / 5, backgroundColor: '#18181B', alignItems: 'center', justifyContent: 'center' }}>
                  {post.thumbnailUrl && <Image source={{ uri: post.thumbnailUrl }} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" />}
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Text style={{ color: '#A0A0A0', fontSize: 13 }}>⏳ Processing...</Text>
                  </View>
                </View>
              )
            ) : post?.thumbnailUrl ? (
              <Image source={{ uri: post.thumbnailUrl }} style={{ width: SCREEN_WIDTH, aspectRatio: 4 / 5 }} contentFit="cover" />
            ) : null}

            {/* Actions */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 16, borderBottomWidth: 1, borderBottomColor: '#27272A' }}>
              <TouchableOpacity onPress={handleLike} activeOpacity={0.7} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 22, color: liked ? '#FF3D5A' : '#A1A1AA' }}>{liked ? '♥' : '♡'}</Text>
                <Text style={{ color: '#A1A1AA', fontSize: 14 }}>{likeCount}</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 20 }}>💬</Text>
                <Text style={{ color: '#A1A1AA', fontSize: 14 }}>{commentCount}</Text>
              </View>
            </View>

            {/* Caption */}
            {post?.caption ? (
              <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#27272A' }}>
                <Text style={{ color: '#FFF', fontSize: 14, lineHeight: 20 }}>
                  <Text style={{ fontWeight: '700' }}>@{post.author?.username} </Text>
                  {post.caption}
                </Text>
                {post.hashtags.length > 0 && (
                  <Text style={{ color: '#7B61FF', fontSize: 13, marginTop: 6 }}>
                    {post.hashtags.map(h => `#${h}`).join(' ')}
                  </Text>
                )}
              </View>
            ) : null}

            {/* Comments */}
            <View style={{ padding: 16 }}>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700', marginBottom: 12 }}>
                Comments
              </Text>
              {comments.length === 0 ? (
                <Text style={{ color: '#A1A1AA', fontSize: 13 }}>No comments yet. Be the first!</Text>
              ) : (
                comments.map(c => (
                  <View key={c.id} style={{ flexDirection: 'row', marginBottom: 14 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#27272A', alignItems: 'center', justifyContent: 'center', marginRight: 8, marginTop: 2 }}>
                      <Text style={{ color: '#A1A1AA', fontSize: 11, fontWeight: '700' }}>
                        {c.author?.username?.[0]?.toUpperCase() ?? '?'}
                      </Text>
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
              {loadingMoreComments && (
                <ActivityIndicator color="#FF3D5A" style={{ paddingVertical: 8 }} />
              )}
            </View>
          </ScrollView>
        )}

        {/* Comment input */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#27272A' }}>
          <TextInput
            style={{ flex: 1, backgroundColor: '#18181B', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, color: '#FFF', fontSize: 14, borderWidth: 1, borderColor: '#27272A', marginRight: 10 }}
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
      </KeyboardAvoidingView>
    </Modal>
  )
}
