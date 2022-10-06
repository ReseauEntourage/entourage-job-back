import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Cache } from 'cache-manager';
import { Sequelize } from 'sequelize';
import { UsersService } from 'src/users/users.service';
import { UserRoles } from 'src/users/users.types';
import { RedisKeys } from 'src/utils/types';
import { Share } from './models';

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
        ...candidatShares.toJSON(),
        [type]: candidatShares[type] + 1,
      };
      return candidatShares.update(updatedCandidatShares);
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
      const shares: Share[] = await Share.findAll({
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

      const shareCounts: { [K in ShareType]: string } = shares[0].toJSON();

      const shareCountValues = Object.values(shareCounts);
      if (
        shareCountValues.every((shareCount) => {
          return !!shareCount;
        })
      ) {
        totalShares += Object.keys(shareCounts).reduce((previous, key) => {
          return previous + parseInt(shareCounts[key as ShareType]);
        }, 0);
      }

      await this.cacheManager.set(redisKey, totalShares, { ttl: 60 });
    }
    return totalShares;
  }
}
