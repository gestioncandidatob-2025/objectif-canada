import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(createUserDto: CreateUserDto) {
    // Chiffrer le mot de passe avant de le stocker
    const motDePasseHache = await bcrypt.hash(createUserDto.motDePasse, 10);

    const user = new this.userModel({
      ...createUserDto,
      motDePasse: motDePasseHache,
    });

    return user.save();
  }

  findAll() {
    return this.userModel.find().select('-motDePasse').exec();
  }

  findOne(id: string) {
    return this.userModel.findById(id).select('-motDePasse').exec();
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email }).exec();
  }

  update(id: string, updateUserDto: UpdateUserDto) {
    return this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .select('-motDePasse')
      .exec();
  }

  remove(id: string) {
    return this.userModel.findByIdAndDelete(id).exec();
  }
}