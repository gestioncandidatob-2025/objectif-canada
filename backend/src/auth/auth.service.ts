import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { CentresService } from '../centres/centres.service';
import { StatutCentre } from '../centres/schemas/centre.schema';
import { Role } from '../users/schemas/user.schema';
import { RegisterCenterDto } from './dto/register-center.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private centresService: CentresService,
  ) {}

  async login(email: string, motDePasse: string) {
    // 1. Chercher l'utilisateur par email
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // 2. Comparer le mot de passe fourni avec le hash stocké
    const motDePasseValide = await bcrypt.compare(motDePasse, user.motDePasse);
    if (!motDePasseValide) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // 3. Un centre suspendu ne peut plus se connecter (le super admin, lui,
    //    n'appartient à aucun centre)
    let nomCentre: string | undefined;
    if (user.centreId) {
      const centre = await this.centresService.trouverParId(String(user.centreId));
      if (centre.statut === StatutCentre.SUSPENDU) {
        throw new UnauthorizedException(
          'Ce centre est suspendu. Contacte HREFF pour le réactiver.',
        );
      }
      nomCentre = centre.nom;
    }

    // 4. Générer le jeton JWT
    // Le centre est inscrit dans le jeton : toutes les requêtes suivantes
    // seront limitées à ce centre (absent pour le super administrateur).
    const payload = {
      sub: user._id,
      email: user.email,
      role: user.role,
      centreId: user.centreId ? String(user.centreId) : undefined,
    };
    const token = await this.jwtService.signAsync(payload);

    return {
      token,
      user: {
        id: user._id,
        nom: user.nom,
        email: user.email,
        role: user.role,
        centreId: user.centreId,
        nomCentre,
        emailVerifie: user.emailVerifie,
      },
    };
  }

  /**
   * Inscription publique d'un centre : crée le centre et son premier
   * administrateur, envoie le code de vérification par email, puis connecte
   * directement la personne (même réponse que /auth/login).
   */
  async inscrireCentre(dto: RegisterCenterDto) {
    // 1. L'email ne doit appartenir à aucun compte, dans aucun centre
    if (await this.usersService.findByEmail(dto.email)) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }

    // 2. Créer le centre (refusé si le nom existe déjà)
    const centre = await this.centresService.creer({
      nom: dto.nomCentre,
      telephone: dto.telephone,
    });

    // 3. Créer l'administrateur du centre. Le code de vérification part par
    //    email automatiquement. Si ça échoue, on supprime le centre pour ne
    //    pas laisser un centre sans personne pour s'y connecter.
    try {
      await this.usersService.create(
        { nom: dto.nom, email: dto.email, motDePasse: dto.motDePasse, role: Role.ADMIN },
        String(centre._id),
      );
    } catch (erreur) {
      await this.centresService.supprimer(String(centre._id));
      throw erreur;
    }

    // 4. Connecter directement la personne
    return this.login(dto.email, dto.motDePasse);
  }

  verifierEmail(email: string, code: string) {
    return this.usersService.verifierEmail(email, code);
  }

  renvoyerCodeVerification(email: string) {
    return this.usersService.renvoyerCodeVerification(email);
  }

  demanderReinitialisationMotDePasse(email: string) {
    return this.usersService.demanderReinitialisationMotDePasse(email);
  }

  reinitialiserMotDePasse(email: string, code: string, nouveauMotDePasse: string) {
    return this.usersService.reinitialiserMotDePasse(email, code, nouveauMotDePasse);
  }
}