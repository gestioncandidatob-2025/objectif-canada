import { Role } from '../schemas/user.schema';

export class CreateUserDto {
  nom!: string;
  email!: string;
  motDePasse!: string;
  role?: Role;
}