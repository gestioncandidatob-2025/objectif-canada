import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument, Role } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MailService } from '../mail/mail.service';

function genererCode6Chiffres(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private mailService: MailService,
  ) {}

  /**
   * Vérifie qu'un mot de passe en clair ne correspond à aucun des mots de passe
   * déjà utilisés par cet utilisateur (mot de passe actuel + historique).
   */
  private async motDePasseDejaUtilise(
    motDePasseClair: string,
    user: UserDocument,
  ): Promise<boolean> {
    const hachesAVerifier = [user.motDePasse, ...(user.historiqueMotsDePasse || [])];
    for (const hache of hachesAVerifier) {
      if (hache && (await bcrypt.compare(motDePasseClair, hache))) {
        return true;
      }
    }
    return false;
  }

  /** Nombre de mots de passe précédents conservés dans l'historique */
  private readonly TAILLE_HISTORIQUE_MOT_DE_PASSE = 5;

  async create(createUserDto: CreateUserDto) {
    const existant = await this.userModel.findOne({ email: createUserDto.email });
    if (existant) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
    }

    const motDePasseHache = await bcrypt.hash(createUserDto.motDePasse, 10);

    const user = new this.userModel({
      ...createUserDto,
      motDePasse: motDePasseHache,
    });

    await user.save();

    // Envoie automatiquement un code de vérification d'email au nouvel opérateur
    await this.genererEtEnvoyerCodeVerification(user);

    return user;
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

  /** Liste des emails de tous les utilisateurs (admins + secrétariat confondus) */
  async emailsTousLesUtilisateurs(): Promise<string[]> {
    const users = await this.userModel.find().select('email').exec();
    return users.map((u) => u.email);
  }

  /** Liste des emails des seuls administrateurs */
  async emailsAdmins(): Promise<string[]> {
    const users = await this.userModel
      .find({ role: Role.ADMIN })
      .select('email')
      .exec();
    return users.map((u) => u.email);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const { motDePasse, ...autresChamps } = updateUserDto;

    if (motDePasse) {
      const user = await this.userModel.findById(id);
      if (!user) {
        throw new NotFoundException('Utilisateur introuvable');
      }
      if (await this.motDePasseDejaUtilise(motDePasse, user)) {
        throw new ConflictException(
          'Ce mot de passe a déjà été utilisé. Choisis-en un différent.',
        );
      }
      user.historiqueMotsDePasse = [
        user.motDePasse,
        ...(user.historiqueMotsDePasse || []),
      ].slice(0, this.TAILLE_HISTORIQUE_MOT_DE_PASSE);
      user.motDePasse = await bcrypt.hash(motDePasse, 10);
      Object.assign(user, autresChamps);
      await user.save();
      const { motDePasse: _omis, ...userSansMotDePasse } = user.toObject();
      return userSansMotDePasse;
    }

    const user = await this.userModel
      .findByIdAndUpdate(id, autresChamps, { new: true })
      .select('-motDePasse')
      .exec();
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  async remove(id: string) {
    const user = await this.userModel.findByIdAndDelete(id).exec();
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return user;
  }

  // ---- Vérification d'email ----

  async genererEtEnvoyerCodeVerification(user: UserDocument) {
    const code = genererCode6Chiffres();
    user.codeVerificationEmail = await bcrypt.hash(code, 10);
    user.codeVerificationExpiration = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await user.save();

    await this.mailService.envoyer({
      to: user.email,
      subject: 'Vérifie ton adresse email — Objectif Canada',
      htmlContent: `
        <p>Bonjour ${user.nom},</p>
        <p>Ton compte opérateur vient d'être créé. Voici ton code de vérification d'email :</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p>Ce code est valable 24 heures.</p>
      `,
    });
  }

  async renvoyerCodeVerification(email: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (user.emailVerifie) {
      throw new BadRequestException('Cet email est déjà vérifié');
    }
    await this.genererEtEnvoyerCodeVerification(user);
    return { message: 'Un nouveau code de vérification a été envoyé' };
  }

  async verifierEmail(email: string, code: string) {
    const user = await this.userModel.findOne({ email });
    if (!user || !user.codeVerificationEmail || !user.codeVerificationExpiration) {
      throw new BadRequestException('Code de vérification invalide');
    }
    if (user.codeVerificationExpiration < new Date()) {
      throw new BadRequestException('Ce code a expiré, demande-en un nouveau');
    }
    const valide = await bcrypt.compare(code, user.codeVerificationEmail);
    if (!valide) {
      throw new BadRequestException('Code de vérification invalide');
    }

    user.emailVerifie = true;
    user.codeVerificationEmail = undefined;
    user.codeVerificationExpiration = undefined;
    await user.save();

    return { message: 'Email vérifié avec succès' };
  }

  // ---- Réinitialisation de mot de passe ----

  async demanderReinitialisationMotDePasse(email: string) {
    const user = await this.userModel.findOne({ email });
    // On ne révèle jamais si l'email existe ou non (sécurité)
    if (!user) {
      return {
        message: 'Si cet email existe, un code de réinitialisation a été envoyé',
      };
    }

    const code = genererCode6Chiffres();
    user.codeReinitialisation = await bcrypt.hash(code, 10);
    user.codeReinitialisationExpiration = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await user.save();

    await this.mailService.envoyer({
      to: user.email,
      subject: 'Réinitialisation de ton mot de passe — Objectif Canada',
      htmlContent: `
        <p>Bonjour ${user.nom},</p>
        <p>Voici ton code de réinitialisation de mot de passe :</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p>Ce code est valable 1 heure. Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>
      `,
    });

    return {
      message: 'Si cet email existe, un code de réinitialisation a été envoyé',
    };
  }

  async reinitialiserMotDePasse(
    email: string,
    code: string,
    nouveauMotDePasse: string,
  ) {
    const user = await this.userModel.findOne({ email });
    if (!user || !user.codeReinitialisation || !user.codeReinitialisationExpiration) {
      throw new BadRequestException('Code de réinitialisation invalide');
    }
    if (user.codeReinitialisationExpiration < new Date()) {
      throw new BadRequestException('Ce code a expiré, refais une demande');
    }
    const valide = await bcrypt.compare(code, user.codeReinitialisation);
    if (!valide) {
      throw new BadRequestException('Code de réinitialisation invalide');
    }

    if (await this.motDePasseDejaUtilise(nouveauMotDePasse, user)) {
      throw new ConflictException(
        'Ce mot de passe a déjà été utilisé. Choisis-en un différent.',
      );
    }

    user.historiqueMotsDePasse = [
      user.motDePasse,
      ...(user.historiqueMotsDePasse || []),
    ].slice(0, this.TAILLE_HISTORIQUE_MOT_DE_PASSE);
    user.motDePasse = await bcrypt.hash(nouveauMotDePasse, 10);
    user.codeReinitialisation = undefined;
    user.codeReinitialisationExpiration = undefined;
    await user.save();

    return { message: 'Mot de passe réinitialisé avec succès' };
  }
}