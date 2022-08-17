import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Cache } from 'cache-manager';
import { Sequelize } from 'sequelize';
import { RedisKeys } from 'src/utils/types';
import { Share } from './models';
import { UsersService } from 'src/users/users.service';
import { UserRoles } from 'src/users/users.types';

export type ShareType =
  | 'facebook'
  | 'linkedin'
  | 'twitter'
  | 'whatsapp'
  | 'other';

const DEFAULT_SHARE_COUNT = 120000 + 64000;

@Injectable()
export class SharesService {
  constructor(
    @InjectModel(Share)
    private shareModel: typeof Share,
    private usersService: UsersService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  async updateByCandidateId(candidateId: string, type: ShareType) {
    const candidate = await this.usersService.findOne(candidateId);
    if (!candidate || candidate.role !== UserRoles.CANDIDAT) {
      return null;
    }
    const candidatShares = await this.shareModel.findOne({
      where: { CandidatId: candidateId },
    });
    if (candidatShares) {
      const updatedCandidatShares = {
        ...candidatShares,
        [type]: candidatShares[type] + 1,
      };
      return candidatShares.update(updatedCandidatShares, {
        where: { CandidatId: candidateId },
      });
    }

    return Share.create({
      CandidatId: candidateId,
      [type]: 1,
    });
  }

  async countTotal() {
    let totalShares = DEFAULT_SHARE_COUNT;
    const redisKey = RedisKeys.CVS_TOTAL_SHARES;
    const redisShares: number = await this.cacheManager.get(redisKey);
    if (redisShares) {
      totalShares = redisShares;
    } else {
      const shares: { [K in ShareType]: number }[] = await Share.findAll({
        attributes: [
          /*
              [Sequelize.fn('sum', Sequelize.col('facebook')), 'facebook'],
              [Sequelize.fn('sum', Sequelize.col('linkedin')), 'linkedin'],
              [Sequelize.fn('sum', Sequelize.col('twitter')), 'twitter'],
              [Sequelize.fn('sum', Sequelize.col('whatsapp')), 'whatsapp'],
            */
          [Sequelize.fn('sum', Sequelize.col('other')), 'other'],
        ],
      });
      const shareCounts = Object.values(shares[0]);
      if (
        shareCounts.every((shareCount) => {
          return !!shareCount;
        })
      ) {
        totalShares += Object.keys(shares[0]).reduce((previous, key) => {
          return previous + shares[0][key as ShareType];
        }, 0);
      }

      await this.cacheManager.set(redisKey, totalShares, 60);
    }
    return totalShares;
  }
}
