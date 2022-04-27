import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserAttributes } from './models/user.attributes';
import { UserCandidatInclude } from './models/user.include';
import { User } from './models/user.model';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User
  ) {}

  async create(createUserDto: Partial<User>) {
    return this.userModel.create(createUserDto, { hooks: true });
  }

  findAll() {
    return `This action returns all users`;
  }

  async findOne(id: string) {
    return this.userModel.findByPk(id, {
      attributes: [...UserAttributes],
      include: UserCandidatInclude,
    });
  }

  async findOneByMail(email: string) {
    return this.userModel.findOne({
      where: { email: email.toLowerCase() },
      attributes: [...UserAttributes, 'salt', 'password'],
      include: UserCandidatInclude,
    });
  }

  async findOneComplete(id: string) {
    return this.userModel.findByPk(id, {
      include: UserCandidatInclude,
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const [updateCount] = await this.userModel.update(updateUserDto, {
      where: { id },
      individualHooks: true,
    });

    if (updateCount === 0) {
      return null;
    }

    const updatedUser = await this.findOne(id);

    return updatedUser.toJSON();
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
