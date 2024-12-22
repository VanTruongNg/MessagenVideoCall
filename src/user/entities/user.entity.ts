import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop()
  avatar: string;

  @Prop({ default: false })
  isOnline: boolean;

  @Prop({ default: null })
  lastSeen: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
