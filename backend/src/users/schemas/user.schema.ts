import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum Role {
  SECRETARIAT = 'secretariat',
  ADMIN = 'admin',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  nom!: string;

  @Prop({ required: true, unique: true })
  email!: string;

  @Prop({ required: true })
  motDePasse!: string;

  @Prop({ type: String, enum: Role, required: true, default: Role.SECRETARIAT })
  role!: Role;
}

export const UserSchema = SchemaFactory.createForClass(User);