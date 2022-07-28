import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CustomMailParams, MailsService } from 'src/mails';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserAttributes } from './models/user.attributes';
import { UserCandidatInclude } from './models/user.include';
import { getRelatedUser, User } from './models/user.model';
import { AuthService } from 'src/auth';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private mailsService: MailsService
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

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
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

  /* encryptPassword(password: string) {
    return this.authService.encryptPassword(password);
  }

  generateRandomPasswordInJWT(expiration: string | number = '1d') {
    return this.authService.generateRandomPasswordInJWT(expiration);
  }*/
}
