import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { v4 as uuid } from 'uuid';
import { HelpGroup } from 'src/help-groups/models';
import { Factory } from 'src/utils/types';

@Injectable()
export class HelpGroupFactory implements Factory<HelpGroup> {
  constructor(
    @InjectModel(HelpGroup)
    private helpGroupModel: typeof HelpGroup
  ) {}

  generateHelpGroup(props: Partial<HelpGroup>): Partial<HelpGroup> {
    const id = uuid();
    const fakeData: Partial<HelpGroup> = {
      id,
      name: faker.lorem.words(3).slice(0, 80),
      slug: `groupe-${id}`,
      description: faker.lorem.sentence(),
      charter: faker.lorem.paragraphs(2),
      // Published by default, as most read tests need a visible group
      publishedAt: new Date(),
      pinnedAt: null,
    };
    return { ...fakeData, ...props };
  }

  async create(props: Partial<HelpGroup> = {}): Promise<HelpGroup> {
    const data = this.generateHelpGroup(props);
    const { deletedAt, ...values } = data;
    await this.helpGroupModel.create(values);
    if (deletedAt) {
      await this.helpGroupModel.update(
        { deletedAt },
        { where: { id: data.id } }
      );
    }
    const group = await this.helpGroupModel.findByPk(data.id, {
      paranoid: false,
    });
    return group.toJSON();
  }
}
