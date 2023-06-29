import { Injectable } from '@nestjs/common';
import { CreateMessageDto } from 'src/messages/dto';
import { Message } from 'src/messages/models';

@Injectable()
export class MessagesHelper {
  mapMessageProps(message: Message): CreateMessageDto {
    return {
      UserId: message.UserId,
      firstName: message.firstName,
      lastName: message.lastName,
      email: message.email,
      phone: message.phone,
      subject: message.subject,
      message: message.message,
      type: message.type,
    };
  }
}
