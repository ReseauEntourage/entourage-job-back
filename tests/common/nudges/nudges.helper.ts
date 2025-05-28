import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Nudge } from 'src/common/nudge/models';
import { NudgeFactory } from './nudge.factory';

@Injectable()
export class NudgesHelper {
  constructor(
    @InjectModel(Nudge)
    private nudgeModel: typeof Nudge,
    private nudgeFactory: NudgeFactory
  ) {}

  async findOne({ value }: { value: string }) {
    return this.nudgeModel.findOne({
      where: { value },
    });
  }

  async deleteAllNudges() {
    try {
      await this.nudgeModel.destroy({
        where: {},
        force: true,
      });
    } catch (err) {
      console.error('Error deleting nudges:', err);
    }
  }

  async seedNudges() {
    const nudges = [
      {
        value: 'tips',
      },
      {
        value: 'network',
      },
      {
        value: 'interview',
      },
      {
        value: 'cv',
      },
    ];

    try {
      for (const nudge of nudges) {
        await this.nudgeFactory.create({
          value: nudge.value,
        });
      }
    } catch (err) {
      console.error('Error seeding nudges:', err);
    }
  }
}
