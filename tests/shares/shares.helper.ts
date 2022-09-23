import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Skill } from 'src/common/skills/models';
import { Share } from 'src/shares/models';
import { SharesService } from 'src/shares/shares.service';

@Injectable()
export class SharesHelper {
  constructor(
    @InjectModel(Share)
    private shareModel: typeof Skill,
    private sharesService: SharesService
  ) {}

  async countTotalSharesByCandidateId(candidateId: string) {
    const shares = (
      await this.shareModel.findOne({
        where: { CandidatId: candidateId },
      })
    ).toJSON();
    return Object.keys(shares).reduce((previous, key) => {
      return previous + parseInt(shares[key]);
    }, 0);
  }

  async countTotalShares() {
    return this.sharesService.countTotal();
  }
}
