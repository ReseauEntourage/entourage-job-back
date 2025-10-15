import { Injectable, NotFoundException } from '@nestjs/common';
import { UserProfilesService } from 'src/user-profiles/user-profiles.service';
import { UsersService } from 'src/users/users.service';
import { UserRoles } from 'src/users/users.types';
import { generatePublicCVDto, PublicCVDto } from './dto/public-cv.dto';

const MIN_PROFILE_COMPLETION_RATE = 70;

@Injectable()
export class PublicCVsService {
  constructor(
    private usersService: UsersService,
    private userProfilesService: UserProfilesService
  ) {}

  async getPublicCVs(query: { limit: number; offset: number; search: string }) {
    const { limit = 10, offset = 0 } = query;
    // Utiliser une taille de lot fixe au lieu de la baser sur la limite
    const batchSize = 50; // Taille de lot fixe
    const finalResults = [];
    let currentOffset = offset;

    // Boucle jusqu'à obtenir suffisamment de résultats ou épuiser les données disponibles
    while (finalResults.length < limit) {
      // Récupération d'un lot de profils publics
      const { search, ...queryWithoutSearch } = query;
      const batchQuery = {
        ...queryWithoutSearch,
        limit: batchSize,
        offset: currentOffset,
      };
      const batch = await this.usersService.findAllPublicCVs(batchQuery);

      // Si aucun résultat, on a épuisé tous les profils disponibles
      if (batch.length === 0) {
        break;
      }

      // Filtrage des profils qui ont une photo et un taux de complétion d'au moins 70%
      for (const user of batch) {
        // Vérification de la présence d'une photo
        const userProfile = user.userProfile;
        if (!userProfile || !userProfile.hasPicture) {
          continue; // Ignorer les profils sans photo
        }

        // Calcul du taux de complétion
        const completionRate =
          await this.userProfilesService.calculateProfileCompletion(user.id);

        // Ne conserver que les profils avec au moins 70% de complétion
        if (completionRate >= MIN_PROFILE_COMPLETION_RATE) {
          finalResults.push(user);

          // Arrêt si on a atteint la limite demandée
          if (finalResults.length >= limit) {
            break;
          }
        }
      }

      // Mise à jour de l'offset pour le prochain lot
      currentOffset += batchSize;
    }

    // Ne retourne que le nombre de résultats demandé
    const results = finalResults.slice(0, limit);
    return results;
  }

  async getPublicCVByUserId(userId: string): Promise<PublicCVDto> {
    // Fetch the user by ID
    const user = await this.findOneUser(userId);
    if (user.role !== UserRoles.CANDIDATE) {
      throw new NotFoundException(
        "Can't fetch public CV for non-candidate user"
      );
    }

    // Fetch the complete user profile
    const userProfile = await this.userProfilesService.findOneByUserId(
      user.id,
      true
    );

    // Return the public CV DTO
    return generatePublicCVDto(user, userProfile);
  }

  /**
   * Private methods
   */
  private async findOneUser(userId: string) {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
