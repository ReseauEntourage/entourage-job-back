// eslint-disable-next-line import/no-unresolved
import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CompanyUser } from 'src/companies/models/company-user.model';
import { Company } from 'src/companies/models/company.model';
import { Factory } from 'src/utils/types';

@Injectable()
export class CompanyFactory implements Factory<Company> {
  constructor(
    @InjectModel(Company)
    private companyModel: typeof Company,
    @InjectModel(CompanyUser)
    private companyUserModel: typeof CompanyUser
  ) {}

  generateCompany(props: Partial<Company>): Partial<Company> {
    const fakeData: Partial<Company> = {
      id: faker.datatype.uuid(),
      name: faker.company.name(),
      description: faker.company.catchPhrase(),
      ...props,
    };

    return {
      ...fakeData,
      ...props,
    };
  }

  async create(
    props: Partial<Company> = {},
    insertInDB = true
  ): Promise<Company> {
    const companyData = this.generateCompany(props);
    const companyId = faker.datatype.uuid();
    if (insertInDB) {
      await this.companyModel.create(
        { ...companyData, id: companyId },
        { hooks: true }
      );
    }

    const dbCompany = await this.companyModel.findOne({
      where: { id: companyId },
    });

    if (dbCompany) {
      return dbCompany.toJSON();
    }

    const builtCompany = await this.companyModel.build(companyData);

    if (dbCompany) {
      return dbCompany.toJSON();
    }

    const { id, ...builtCompanyWithoutId } = builtCompany.toJSON();

    return {
      ...builtCompanyWithoutId,
    } as Company;
  }

  async linkAdminToCompany(
    company: Company,
    userId: string,
    userCompanyProps: Partial<CompanyUser>
  ): Promise<void> {
    await this.companyUserModel.create({
      companyId: company.id,
      userId,
      ...userCompanyProps,
    });
  }
}
