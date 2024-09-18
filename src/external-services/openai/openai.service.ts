import fs from 'fs';
import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async requestConvertDataIntoJSON(data: string, JSONSchema: any, key: string) {
    const completion = await this.client.beta.chat.completions.parse({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Convert the data into JSON format.' },
        {
          role: 'user',
          content: `Convert the following data into JSON format:\n\n${data}`,
        },
      ],
      max_tokens: 1000,
      response_format: zodResponseFormat(JSONSchema, key),
    });
    return completion.choices[0].message.parsed;
  }
}
