import { Injectable } from '@nestjs/common';
import { MessageType } from '../entities/message.entity';

@Injectable()
export class EmojiService {
  private emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;

  detectMessageType(content: string): { type: MessageType; emojis: string[] } {
    const emojis = content.match(this.emojiRegex) || [];
    const textContent = content.replace(this.emojiRegex, '').trim();

    if (emojis.length === 0) {
      return { type: MessageType.TEXT, emojis: [] };
    }

    if (textContent.length === 0) {
      return { type: MessageType.EMOJI, emojis };
    }

    return { type: MessageType.TEXT_WITH_EMOJI, emojis };
  }

  isEmoji(str: string): boolean {
    return this.emojiRegex.test(str);
  }

  countEmojis(str: string): number {
    return (str.match(this.emojiRegex) || []).length;
  }
}
