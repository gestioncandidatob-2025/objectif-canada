import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Centre, CentreDocument } from './schemas/centre.schema';
import { Tarif, TarifDocument } from '../tarifs/schemas/tarif.schema';
import { User, UserDocument, Role } from '../users/schemas/user.schema';

/** Une ligne du bandeau de rappel */
export interface ElementConfiguration {
  cle: string;
  libelle: string;
  fait: boolean;
  // Page où l'administrateur peut le faire (absente si la page n'existe pas encore)
  lien?: string;
}

/**
 * Informations sur le centre de l'utilisateur connecté.
 * Le centre est toujours celui du jeton de connexion (jamais envoyé par le navigateur).
 */
@Injectable()
export class MonCentreService {
  constructor(
    @InjectModel(Centre.name) private centreModel: Model<CentreDocument>,
    @InjectModel(Tarif.name) private tarifModel: Model<TarifDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /** Ce qui est déjà configuré et ce qui manque encore (pour le bandeau de rappel) */
  async etatConfiguration(centreId: string) {
    const [centre, nombreServices, nombreSecretaires] = await Promise.all([
      this.centreModel.findById(centreId).exec(),
      this.tarifModel.countDocuments({ centreId, actif: { $ne: false } }),
      this.userModel.countDocuments({ centreId, role: Role.SECRETARIAT }),
    ]);
    if (!centre) {
      throw new NotFoundException('Centre introuvable');
    }

    const elements: ElementConfiguration[] = [
      // Logo et adresse : la page Paramètres arrivera avec mc/parametres
      { cle: 'logo', libelle: 'Ajouter le logo du centre', fait: !!centre.logoKey },
      { cle: 'adresse', libelle: "Renseigner l'adresse du centre", fait: !!centre.adresse?.trim() },
      {
        cle: 'service',
        libelle: 'Créer au moins un service',
        fait: nombreServices > 0,
        lien: '/tarifs',
      },
      // Les modes de paiement ne sont pas encore configurables : ils le seront
      // avec mc/parametres. En attendant, ils sont tous disponibles.
      { cle: 'paiement', libelle: 'Choisir au moins un mode de paiement', fait: true },
      {
        cle: 'secretaire',
        libelle: 'Créer un compte secrétaire',
        fait: nombreSecretaires > 0,
        lien: '/utilisateurs',
      },
    ];

    return {
      complet: elements.every((element) => element.fait),
      elements,
    };
  }
}