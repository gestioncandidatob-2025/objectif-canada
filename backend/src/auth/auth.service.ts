import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { CentresService } from '../centres/centres.service';
import { StatutCentre } from '../centres/schemas/centre.schema';

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