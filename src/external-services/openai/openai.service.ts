import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ToBase64Response } from 'pdf2pic/dist/types/convertResponse';
import { cvSchema, CvSchemaType } from './openai.schemas';

@Injectable()
export class OpenAiService {
  private readonly openai: OpenAI;

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
  async extractCVFromImages(image: ToBase64Response): Promise<CvSchemaType> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'o4-mini-2025-04-16',
        max_completion_tokens: 4096,
        messages: [
          {
            role: 'system',
            content:
              "Tu es un expert en analyse de CV. Tu dois extraire toutes les informations pertinentes d'un CV à partir d'images et les structurer selon le schéma JSON demandé. Le document peut être sur plusieurs pages, analyse toutes les pages. Pour l'introduction, rédige un court résumé du CV en mettant en avant les compétences clés, l'expérience et la formation de la personne.",
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyse ce CV et extrait toutes les informations pertinentes selon le schéma JSON spécifié. Le document peut être sur plusieurs pages.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${image.base64}`,
                },
              },
            ],
          },
        ],
        functions: [
          {
            name: 'extract_cv_data',
            description: "Extraire les données structurées d'un CV",
            parameters: cvSchema,
          },
        ],
        function_call: { name: 'extract_cv_data' },
      });

      // Récupérer le résultat
      const functionCall = response.choices[0].message.function_call;

      if (!functionCall) {
        throw new Error();
      }

      // Analyser les arguments JSON
      const extractedData = JSON.parse(functionCall.arguments) as CvSchemaType;

      return extractedData;
    } catch (error) {
      throw new Error(
        `Impossible d'extraire les données du CV à partir d'images: ${error.toString()}`
      );
    }
  }
}
