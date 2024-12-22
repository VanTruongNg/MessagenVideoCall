import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatroomService } from './chatroom.service';
import { ChatroomController } from './chatroom.controller';
import { Chatroom, ChatroomSchema } from './entities/chatroom.entity';
import { Message, MessageSchema } from './entities/message.entity';
import { User, UserSchema } from '../user/entities/user.entity';
import { EmojiService } from './services/emoji.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chatroom.name, schema: ChatroomSchema },
      { name: Message.name, schema: MessageSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ChatroomController],
  providers: [ChatroomService, EmojiService],
  exports: [ChatroomService],
})
export class ChatroomModule {}
