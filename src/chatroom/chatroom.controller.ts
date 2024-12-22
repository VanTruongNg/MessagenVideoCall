import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
  Param,
} from '@nestjs/common';
import { ChatroomService } from './chatroom.service';
import { CreateChatroomDto } from './dto/create-chatroom.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('chatroom')
@UseGuards(JwtAuthGuard)
export class ChatroomController {
  constructor(private readonly chatroomService: ChatroomService) {}

  @Post()
  async createRoom(
    @CurrentUser() user: any,
    @Body() createChatroomDto: CreateChatroomDto,
  ) {
    return this.chatroomService.createRoom({
      ...createChatroomDto,
      createdBy: user.userId,
    });
  }

  @Get()
  async getRooms(@CurrentUser() user: any) {
    return this.chatroomService.getRoomsByUser(user.userId);
  }

  @Get(':id')
  async getRoom(@CurrentUser() user: any, @Param('id') roomId: string) {
    return this.chatroomService.getRoomById(roomId, user.userId);
  }

  @Get(':id/messages')
  async getRoomMessages(
    @CurrentUser() user: any,
    @Param('id') roomId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.chatroomService.getRoomMessages(roomId, user.userId, {
      page,
      limit,
    });
  }
}
