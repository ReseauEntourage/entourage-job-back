import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserAttribute } from './models/user.attribute';
import { UserCandidatInclude } from './models/user.include';
import { User } from './models/user.model';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private userModel: User
  ) {}

  async create(createUserDto: Partial<User>) {
    return User.create(createUserDto, { hooks: true });
  }

  findAll() {
    return `This action returns all users`;
  }

  async findOne(id: string) {
    return User.findByPk(id, {
      attributes: [...UserAttribute],
      include: UserCandidatInclude,
    });
  }

  async findOneByMail(email: string) {
    return User.findOne({
      where: { email: email.toLowerCase() },
      attributes: [...UserAttribute, 'salt', 'password'],
      include: UserCandidatInclude,
    });
  }

  async findOneComplete(id: string) {
    return User.findByPk(id, {
      include: UserCandidatInclude,
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const [updateCount] = await User.update(updateUserDto, {
      where: { id },
      individualHooks: true,
    });

    if (updateCount === 0) {
      return null;
    }

    return this.findOne(id);
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
