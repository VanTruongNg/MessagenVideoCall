import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { ChatroomService } from '../chatroom/chatroom.service';
import { ChatroomType } from '../chatroom/entities/chatroom.entity';
import { User } from '../user/entities/user.entity';
import { MessageType } from '../chatroom/entities/message.entity';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:8080'],
    credentials: true
  },
  transports: ['websocket']
})
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private onlineUsers = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly chatroomService: ChatroomService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token?.split(' ')[1];
      if (!token) {
        throw new Error('No token provided');
      }

      const decoded = this.jwtService.verify(token);
      const user = await this.userService.findById(decoded.sub);
      if (!user) {
        throw new Error('User not found');
      }

      client.data.user = user;
      this.onlineUsers.set(client.id, user);

      await this.chatroomService.updateUserStatus(user._id.toString(), true);

      const rooms = await this.chatroomService.getRoomsByUser(user._id.toString());
      rooms.forEach(room => {
        client.join(room._id.toString());
      });

      const onlineList = await Promise.all(
        Array.from(this.onlineUsers.values()).map(async (user) => {
          const populatedUser = await this.userService.findById(user._id);
          return populatedUser;
        })
      );
      
      this.server.emit('users:online', onlineList);
      client.emit('rooms:list', rooms);

    } catch (error) {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    if (this.onlineUsers.has(client.id)) {
      const user = this.onlineUsers.get(client.id);
      await this.chatroomService.updateUserStatus(user._id.toString(), false);
      
      this.onlineUsers.delete(client.id);

      const onlineList = await Promise.all(
        Array.from(this.onlineUsers.values()).map(async (user) => {
          const populatedUser = await this.userService.findById(user._id);
          return populatedUser;
        })
      );
      
      this.server.emit('users:online', onlineList);
    }
  }

  @SubscribeMessage('room:create')
  async handleRoomCreate(client: Socket, data: { userId: string }) {
    try {
      const currentUser = client.data.user;
      
      const room = await this.chatroomService.createRoom({
        type: ChatroomType.PRIVATE,
        name: 'Private Chat',
        participants: [data.userId],
        createdBy: currentUser._id.toString()
      });
      
      const roomId = room._id.toString();
      client.join(roomId);
      
      const otherSocket = this.findSocketByUserId(data.userId);
      if (otherSocket) {
        otherSocket.join(roomId);
      }

      const populatedRoom = await this.chatroomService.getRoomById(roomId, currentUser._id.toString());
      this.server.to(roomId).emit('room:created', populatedRoom);

      const currentUserRooms = await this.chatroomService.getRoomsByUser(currentUser._id.toString());
      client.emit('rooms:list', currentUserRooms);

      if (otherSocket) {
        const otherUserRooms = await this.chatroomService.getRoomsByUser(data.userId);
        otherSocket.emit('rooms:list', otherUserRooms);
      }

    } catch (error) {
      client.emit('error', { message: 'Failed to create room' });
    }
  }

  @SubscribeMessage("message:send")
  async handleMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    data: {
      roomId: string;
      content?: string;
      type?: MessageType;
      file?: {
        url: string;
        name: string;
        size: number;
        type: string;
      };
    }
  ) {
    try {
      const userId = socket.data.user.id;

      await this.chatroomService.validateUserInRoom(userId, data.roomId);

      const result = await this.chatroomService.createMessage({
        chatroomId: data.roomId,
        sender: userId,
        content: data.content || "",
        type: data.type,
        fileUrl: data.file?.url,
        fileName: data.file?.name,
        fileSize: data.file?.size,
        fileMimeType: data.file?.type,
      });

      // Broadcast new message to room
      this.server.to(data.roomId).emit("message:new", result.message);

      // Get updated room list for each participant
      for (const participant of result.room.participants) {
        const participantId = participant._id.toString();
        const participantSocket = this.findSocketByUserId(participantId);
        if (participantSocket) {
          // Get fresh room list for this participant
          const rooms = await this.chatroomService.getRoomsByUser(participantId);
          participantSocket.emit("rooms:list", rooms);
        }
      }

      return result.message;
    } catch (error) {
      console.error("Error handling message:", error);
      throw new WsException(error.message);
    }
  }

  @SubscribeMessage('messages:get')
  async handleGetMessages(
    client: Socket,
    data: { roomId: string; page: number; limit: number }
  ) {
    try {
      const user = client.data.user;
      
      client.join(data.roomId);
      
      const messages = await this.chatroomService.getRoomMessages(
        data.roomId,
        user._id.toString(),
        { page: data.page, limit: data.limit }
      );

      client.emit('messages:list', messages);
    } catch (error) {
      console.error('Error getting messages:', error);
      client.emit('error', { message: 'Failed to get messages' });
    }
  }

  @SubscribeMessage('user:typing')
  async handleUserTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { roomId: string }
  ) {
    try {
      const userId = socket.data.user.id;
      const username = socket.data.user.username;

      await this.chatroomService.validateUserInRoom(userId, data.roomId);

      socket.to(data.roomId).emit('user:typing', {
        roomId: data.roomId,
        userId,
        username,
      });
    } catch (error) {
      console.error('Error handling typing:', error);
      throw new WsException(error.message);
    }
  }

  @SubscribeMessage('user:stop-typing')
  async handleUserStopTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { roomId: string }
  ) {
    try {
      const userId = socket.data.user.id;

      await this.chatroomService.validateUserInRoom(userId, data.roomId);

      socket.to(data.roomId).emit('user:stop-typing', {
        roomId: data.roomId,
        userId,
      });
    } catch (error) {
      console.error('Error handling stop typing:', error);
      throw new WsException(error.message);
    }
  }

  private findSocketByUserId(userId: string): Socket | null {
    for (const [socketId, user] of this.onlineUsers.entries()) {
      if (user._id.toString() === userId) {
        return this.server.sockets.sockets.get(socketId) || null;
      }
    }
    return null;
  }
}
