import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SocketGateway } from './socket.gateway';
import { ChatroomModule } from '../chatroom/chatroom.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret',
    }),
    ChatroomModule,
    UserModule,
  ],
  providers: [SocketGateway],
  exports: [SocketGateway],
})
export class SocketModule {} 