import { Schema, model, type Document, type Types } from 'mongoose'

export interface IComment extends Document {
  _id: Types.ObjectId
  postId: Types.ObjectId
  userId: Types.ObjectId
  text: string
  createdAt: Date
  updatedAt: Date
}

const CommentSchema = new Schema<IComment>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, maxlength: 1000, trim: true },
  },
  { timestamps: true },
)

CommentSchema.index({ postId: 1, createdAt: -1 })

export const Comment = model<IComment>('Comment', CommentSchema)
