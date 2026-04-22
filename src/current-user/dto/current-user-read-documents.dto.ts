import { User } from 'src/users/models';

export interface CurrentUserReadDocumentDto {
  documentName: string;
  createdAt: Date;
}

export interface CurrentUserReadDocumentsDto {
  readDocuments: CurrentUserReadDocumentDto[];
}

export const generateCurrentUserReadDocumentsDto = (
  user: User
): CurrentUserReadDocumentsDto => ({
  readDocuments: (user.readDocuments || []).map((doc) => ({
    documentName: doc.documentName,
    createdAt: doc.createdAt,
  })),
});
