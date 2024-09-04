import fs from 'fs';
import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { MessageCreateParams } from 'openai/resources/beta/threads/messages';
import { ThreadCreateParams } from 'openai/resources/beta/threads/threads';

@Injectable()
export class OpenAiService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env['OPENAI_API_KEY'],
    });
  }

  async createThread(messages: Array<ThreadCreateParams.Message>) {
    return await this.client.beta.threads.create({ messages: messages });
  }

  async addMessageToThread(threadId: string, message: MessageCreateParams) {
    return await this.client.beta.threads.messages.create(threadId, message);
  }

  async createFile(path: string) {
    return await this.client.files.create({
      file: fs.createReadStream(path),
      purpose: 'assistants',
    });
  }

  async runThread(threadId: string, assistantId: string) {
    return await this.client.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: assistantId,
      model: 'gpt-4o-mini',
    });
  }

  async listMessages(threadId: string) {
    return await this.client.beta.threads.messages.list(threadId);
  }
}
