import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../user/entities/user.entity';
import { Chatroom } from './chatroom.entity';

export enum MessageType {
  TEXT = 'text',           // Tin nhắn text thường
  EMOJI = 'emoji',         // Chỉ chứa emoji
  TEXT_WITH_EMOJI = 'text_with_emoji', // Text có emoji
  IMAGE = 'image',         // File ảnh
  FILE = 'file',          // Các loại file khác
}

@Schema({ timestamps: true })
export class Message extends Document {
  @Prop({ required: true })
  content: string;

  @Prop({ type: String, enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  // Trường cho emoji
  @Prop({ type: [String], default: [] })
  emojis: string[];

  // Các trường cho file
  @Prop()
  fileUrl?: string;

  @Prop()
  fileName?: string;

  @Prop()
  fileSize?: number;

  @Prop()
  fileMimeType?: string;

  // References
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: User;

  @Prop({ type: Types.ObjectId, ref: 'Chatroom', required: true })
  chatroom: Chatroom;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
