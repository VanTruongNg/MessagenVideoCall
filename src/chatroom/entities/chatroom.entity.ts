import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../user/entities/user.entity';

export enum ChatroomType {
  PRIVATE = 'private',
  GROUP = 'group',
}

@Schema({ _id: false })
class LastMessage {
  @Prop({ default: '' })
  content: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  sender: Types.ObjectId;

  @Prop({ default: Date.now })
  timestamp: Date;

  @Prop({ default: '' })
  type: string;
}

@Schema({ timestamps: true })
export class Chatroom extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ type: String, enum: ChatroomType, default: ChatroomType.PRIVATE })
  type: ChatroomType;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  participants: User[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: User;

  @Prop({ type: LastMessage })
  lastMessage?: LastMessage;
}

export const ChatroomSchema = SchemaFactory.createForClass(Chatroom);
