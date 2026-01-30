import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  ChatCompletionContentPart,
  ChatCompletionMessage,
} from 'openai/resources/chat';
import { cvSchema, CvSchemaType } from './openai.schemas';

@Injectable()
export class OpenAiService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(OpenAiService.name);

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Extrait directement des données structurées à partir d'images de CV en utilisant l'API OpenAI
   * Cette méthode fait un seul appel à l'API en envoyant toutes les images et en demandant directement une réponse JSON structurée
   *
   * @param image Tableau de réponses ToBase64Response de pdf2pic
   * @returns Les données extraites selon le schéma fourni
   */
  async extractCVFromImages(base64ImageArray: string[]): Promise<CvSchemaType> {
    const content: ChatCompletionContentPart[] = [
      {
        type: 'text',
        text: 'Analyse ce CV et extrait toutes les informations pertinentes selon le schéma JSON spécifié. Le document peut être sur plusieurs pages.',
      },
    ];
    for (const base64Image of base64ImageArray) {
      content.push({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${base64Image}`,
        },
      });
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'o4-mini-2025-04-16',
        max_completion_tokens: Number(
          process.env.OPENAI_MAX_COMPLETION_TOKENS ?? 4096
        ),
        messages: [
          {
            role: 'system',
            content:
              "Tu es un expert en analyse de CV. Tu dois extraire toutes les informations pertinentes d'un CV à partir d'images et les structurer selon le schéma JSON demandé. Le document peut être sur plusieurs pages, analyse toutes les pages. Pour la description, rédige un court résumé du CV à la première personne en mettant en avant les compétences clés, l'expérience et la formation de la personne.",
          },
          {
            role: 'user',
            content: content,
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_cv_data',
              description: "Extraire les données structurées d'un CV",
              parameters: cvSchema,
            },
          },
        ],
        tool_choice: {
          type: 'function',
          function: { name: 'extract_cv_data' },
        },
      });

      const choice = response.choices?.[0];
      const toolCalls = (choice?.message as ChatCompletionMessage)?.tool_calls;
      const functionArgs = toolCalls?.[0]?.function?.arguments;

      if (!functionArgs) {
        const finishReason = choice?.finish_reason;
        const usage = response.usage;
        this.logger.error(
          `OpenAI: aucun tool_call retourné (finish_reason=${String(
            finishReason
          )}). usage=${JSON.stringify(usage)}`
        );

        if (finishReason === 'length') {
          throw new Error(
            `OpenAI a coupé la réponse par limite de tokens (finish_reason=length). ` +
              `Essaie de réduire le nombre/poids des images, ou augmente OPENAI_MAX_COMPLETION_TOKENS. ` +
              `usage=${JSON.stringify(usage)}`
          );
        }

        throw new Error(
          `Aucun tool_call n'a été retourné par l'API OpenAI (finish_reason=${String(
            finishReason
          )}).`
        );
      }

      // Analyser les arguments JSON
      const extractedData = JSON.parse(functionArgs) as CvSchemaType;

      return extractedData;
    } catch (error) {
      throw new Error(
        `Impossible d'extraire les données du CV à partir d'images: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
