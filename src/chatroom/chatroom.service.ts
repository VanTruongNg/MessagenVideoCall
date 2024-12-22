import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chatroom } from './entities/chatroom.entity';
import { Message, MessageType } from './entities/message.entity';
import { CreateChatroomDto } from './dto/create-chatroom.dto';
import { User } from '../user/entities/user.entity';
import { EmojiService } from './services/emoji.service';
import { ChatroomType } from './entities/chatroom.entity';

@Injectable()
export class ChatroomService {
  constructor(
    @InjectModel(Chatroom.name) private chatroomModel: Model<Chatroom>,
    @InjectModel(Message.name) private messageModel: Model<Message>,
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly emojiService: EmojiService,
  ) {}

  async createMessage(data: {
    chatroomId: string;
    sender: string;
    content: string;
    type?: MessageType;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    fileMimeType?: string;
  }) {
    if (!data.type) {
      const { type, emojis } = this.emojiService.detectMessageType(data.content);

      const message = new this.messageModel({
        chatroom: new Types.ObjectId(data.chatroomId),
        sender: new Types.ObjectId(data.sender),
        content: data.content,
        type,
        emojis,
      });

      await message.save();

      // Get sender info
      const sender = await this.userModel.findById(data.sender).select('username avatar');

      // Update room with populated participants
      const updatedRoom = await this.chatroomModel.findByIdAndUpdate(
        data.chatroomId,
        {
          lastMessage: {
            content: data.content,
            sender: sender,
            timestamp: new Date(),
            type,
          },
        },
        { new: true }
      ).populate([
        {
          path: 'participants',
          select: '_id username email avatar isOnline lastSeen'
        },
        {
          path: 'createdBy',
          select: '_id username email avatar'
        }
      ]);

      const populatedMessage = await message.populate('sender');
      return { message: populatedMessage, room: updatedRoom };
    }

    if (data.type === MessageType.FILE || data.type === MessageType.IMAGE) {
      const message = new this.messageModel({
        chatroom: new Types.ObjectId(data.chatroomId),
        sender: new Types.ObjectId(data.sender),
        content: data.content,
        type: data.type,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        fileMimeType: data.fileMimeType,
        emojis: [],
      });

      await message.save();

      const sender = await this.userModel.findById(data.sender).select('username avatar');

      const updatedRoom = await this.chatroomModel.findByIdAndUpdate(
        data.chatroomId,
        {
          lastMessage: {
            content: data.type === MessageType.IMAGE ? 'Đã gửi một ảnh' : 'Đã gửi một file',
            sender: sender,
            timestamp: new Date(),
            type: data.type,
          },
        },
        { new: true }
      ).populate([
        {
          path: 'participants',
          select: '_id username email avatar isOnline lastSeen'
        },
        {
          path: 'createdBy',
          select: '_id username email avatar'
        }
      ]);

      const populatedMessage = await message.populate('sender');
      return { message: populatedMessage, room: updatedRoom };
    }

    const message = new this.messageModel({
      ...data,
      chatroom: new Types.ObjectId(data.chatroomId),
      sender: new Types.ObjectId(data.sender),
      emojis: [],
    });

    await message.save();

    // Get sender info
    const sender = await this.userModel.findById(data.sender).select('username avatar');

    // Update room with populated participants
    const updatedRoom = await this.chatroomModel.findByIdAndUpdate(
      data.chatroomId,
      {
        lastMessage: {
          content: data.content,
          sender: sender,
          timestamp: new Date(),
          type: data.type,
        },
      },
      { new: true }
    ).populate([
      {
        path: 'participants',
        select: '_id username email avatar isOnline lastSeen'
      },
      {
        path: 'createdBy',
        select: '_id username email avatar'
      }
    ]);

    const populatedMessage = await message.populate('sender');
    return { message: populatedMessage, room: updatedRoom };
  }

  async validateUserInRoom(userId: string, chatroomId: string) {
    const chatroom = await this.chatroomModel
      .findById(chatroomId)
      .populate({
        path: 'participants',
        select: 'username email avatar isOnline lastSeen'
      })
      .exec();

    if (!chatroom) {
      throw new NotFoundException('Chatroom not found');
    }

    const userObjectId = new Types.ObjectId(userId);
    const isParticipant = chatroom.participants.some(
      (p: any) => p._id.toString() === userObjectId.toString()
    );

    if (!isParticipant) {
      throw new Error('User is not a participant of this room');
    }

    return true;
  }

  async updateUserStatus(userId: string, isOnline: boolean) {
    return this.userModel.findByIdAndUpdate(
      userId,
      {
        isOnline,
        lastSeen: isOnline ? null : new Date(),
      },
      { new: true },
    );
  }

  async createRoom(data: CreateChatroomDto & { createdBy: string }) {
    // Convert string IDs to ObjectIds
    const participantIds = data.participants.map(id => new Types.ObjectId(id));
    const createdById = new Types.ObjectId(data.createdBy);

    // Kiểm tra xem tất cả participants có tồn tại không
    const participants = await this.userModel
      .find({
        _id: { $in: [...participantIds, createdById] },
      })
      .exec();

    if (participants.length !== data.participants.length + 1) {
      throw new NotFoundException('One or more participants not found');
    }

    // Kiểm tra xem đã có room private giữa 2 user chưa
    if (data.type === ChatroomType.PRIVATE) {
      const existingRoom = await this.chatroomModel
        .findOne({
          type: ChatroomType.PRIVATE,
          participants: { 
            $all: [...participantIds, createdById],
            $size: 2
          }
        })
        .populate({
          path: 'participants',
          select: 'username email avatar isOnline lastSeen'
        })
        .populate({
          path: 'createdBy',
          select: 'username email avatar'
        })
        .exec();

      if (existingRoom) {
        return existingRoom;
      }
    }

    const chatroom = new this.chatroomModel({
      ...data,
      participants: [...participantIds, createdById],
      createdBy: createdById
    });

    const savedRoom = await chatroom.save();
    return savedRoom.populate([
      {
        path: 'participants',
        select: '_id username email avatar isOnline lastSeen'
      },
      {
        path: 'createdBy',
        select: '_id username email avatar'
      }
    ]);
  }

  async getRoomsByUser(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const rooms = await this.chatroomModel
      .find({ participants: userObjectId })
      .populate({
        path: 'participants',
        model: 'User',
        select: '_id username email avatar isOnline lastSeen'
      })
      .populate({
        path: 'createdBy',
        model: 'User', 
        select: '_id username email avatar'
      })
      .sort({ updatedAt: -1 })
      .exec();

    return rooms;
  }

  async getRoomById(roomId: string, userId: string) {
    const room = await this.chatroomModel
      .findById(roomId)
      .populate({
        path: 'participants',
        select: '_id username email avatar isOnline lastSeen'
      })
      .populate({
        path: 'createdBy',
        select: '_id username email avatar'
      })
      .exec();

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const userObjectId = new Types.ObjectId(userId);
    const isParticipant = room.participants.some(
      (p: any) => p._id.toString() === userObjectId.toString()
    );

    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this room');
    }

    return room;
  }

  async getRoomMessages(
    roomId: string,
    userId: string,
    options: { page: number; limit: number },
  ) {
    // Kiểm tra quyền truy cập
    await this.validateUserInRoom(userId, roomId);

    const skip = (options.page - 1) * options.limit;

    const [messages, total] = await Promise.all([
      this.messageModel
        .find({ chatroom: new Types.ObjectId(roomId) })
        .populate('sender')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(options.limit)
        .exec(),
      this.messageModel.countDocuments({ chatroom: new Types.ObjectId(roomId) }).exec(),
    ]);

    return {
      messages,
      total,
      page: options.page,
      totalPages: Math.ceil(total / options.limit),
    };
  }
}
