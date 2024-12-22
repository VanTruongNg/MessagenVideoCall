import { IsString, IsArray, IsEnum, ArrayMinSize } from 'class-validator';
import { ChatroomType } from '../entities/chatroom.entity';

export class CreateChatroomDto {
  @IsString()
  name: string;

  @IsEnum(ChatroomType)
  type: ChatroomType;

  @IsArray()
  @ArrayMinSize(1)
  participants: string[];
}
