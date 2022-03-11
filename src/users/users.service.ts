import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './models/user.model';
import { InjectModel } from '@nestjs/sequelize';
import { UserAttributes } from './models/user.attributes';
import { INCLUDE_USER_CANDIDAT } from './models/user.includes';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
  ) {}

  create(createUserDto: CreateUserDto) {
    return 'This action adds a new user';
  }

  findAll() {
    return `This action returns all users`;
  }

  async findOne(id: string) {
    return User.findByPk(id, {
      attributes: [...UserAttributes],
      include: INCLUDE_USER_CANDIDAT,
    });
  }

  async findOneByMail(email: string) {
    return User.findOne({
      where: { email: email.toLowerCase() },
      attributes: [...UserAttributes, 'salt', 'password'],
      include: INCLUDE_USER_CANDIDAT,
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

    const user: User = await this.findOne(id);

    return user.toJSON();
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
