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

  // Vérification d'email (code à 6 chiffres envoyé à la création du compte)
  @Prop({ default: false })
  emailVerifie!: boolean;

  @Prop()
  codeVerificationEmail?: string;

  @Prop()
  codeVerificationExpiration?: Date;

  // Réinitialisation de mot de passe (code à 6 chiffres, valable 1h)
  @Prop()
  codeReinitialisation?: string;

  @Prop()
  codeReinitialisationExpiration?: Date;

  // Historique des mots de passe déjà utilisés (empêche la réutilisation)
  @Prop({ type: [String], default: [] })
  historiqueMotsDePasse!: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);