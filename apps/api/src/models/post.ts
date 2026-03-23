import { Schema, model, type Document, type Types } from 'mongoose'

export interface IPost extends Document {
  _id: Types.ObjectId
  userId: Types.ObjectId
  type: 'photo' | 'video'
  mediaUrls: string[]
  thumbnailUrl: string | null
  caption: string
  hashtags: string[]
  taggedUsers: Types.ObjectId[]
  likes: Types.ObjectId[]
  commentCount: number
  viewCount: number
  hlsUrl: string | null
  duration: number | null
  processingStatus: 'pending' | 'processing' | 'ready' | 'failed' | null
  createdAt: Date
  updatedAt: Date
}

const PostSchema = new Schema<IPost>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['photo', 'video'], required: true },
    mediaUrls: [{ type: String }],
    thumbnailUrl: { type: String, default: null },
    caption: { type: String, default: '', maxlength: 2200 },
    hashtags: [{ type: String, lowercase: true, trim: true }],
    taggedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    commentCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    hlsUrl: { type: String, default: null },
    duration: { type: Number, default: null },
    processingStatus: {
      type: String,
      enum: ['pending', 'processing', 'ready', 'failed', null],
      default: null,
    },
  },
  { timestamps: true },
)

PostSchema.index({ createdAt: -1 })
PostSchema.index({ userId: 1, createdAt: -1 })
PostSchema.index({ hashtags: 1 })

export const Post = model<IPost>('Post', PostSchema)
