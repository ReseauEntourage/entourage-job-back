import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './models/user.model';
import { InjectModel } from '@nestjs/sequelize';
import { UserAttribute } from './models/user.attribute';
import { UserCandidatInclude } from './models/user.include';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private userModel: User,
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
