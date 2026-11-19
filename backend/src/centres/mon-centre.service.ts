import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Centre, CentreDocument } from './schemas/centre.schema';
import { Tarif, TarifDocument } from '../tarifs/schemas/tarif.schema';
import { User, UserDocument, Role } from '../users/schemas/user.schema';
import { ModePaiement } from '../inscriptions/schemas/inscription.schema';
import { S3Service } from '../factures/s3.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

/** Une ligne du bandeau de rappel */
export interface ElementConfiguration {
  cle: string;
  libelle: string;
  fait: boolean;
  // Page où l'administrateur peut le faire
  lien?: string;
}

/** Fichier reçu par la route d'envoi du logo */
export interface FichierEnvoye {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

const TYPES_LOGO_ACCEPTES = ['image/png', 'image/jpeg'];
const TAILLE_MAX_LOGO = 1024 * 1024; // 1 Mo

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
    private s3Service: S3Service,
  ) {}

  private async trouverCentre(centreId: string) {
    const centre = await this.centreModel.findById(centreId).exec();
    if (!centre) {
      throw new NotFoundException('Centre introuvable');
    }
    return centre;
  }

  // ---- Paramètres du centre ----

  /** Paramètres du centre, avec un lien temporaire vers le logo */
  async obtenirParametres(centreId: string) {
    const centre = await this.trouverCentre(centreId);
    const logoUrl = centre.logoKey ? await this.s3Service.urlSignee(centre.logoKey) : null;

    return {
      id: centre._id,
      nom: centre.nom,
      ville: centre.ville ?? '',
      telephone: centre.telephone ?? '',
      adresse: centre.adresse ?? '',
      niu: centre.niu ?? '',
      rccm: centre.rccm ?? '',
      piedDePageRecu: centre.piedDePageRecu ?? '',
      // Ancien centre sans liste enregistrée : tous les modes sont acceptés
      modesPaiement:
        centre.modesPaiement && centre.modesPaiement.length > 0
          ? centre.modesPaiement
          : Object.values(ModePaiement),
      logoUrl,
      plan: centre.plan,
    };
  }

  /** Modification des paramètres par l'administrateur */
  async modifierParametres(centreId: string, dto: UpdateSettingsDto) {
    const centre = await this.trouverCentre(centreId);

    // Le nom reste unique sur la plateforme (sans tenir compte des majuscules)
    if (dto.nom !== undefined && dto.nom !== centre.nom) {
      const existant = await this.centreModel
        .exists({ nom: dto.nom, _id: { $ne: centre._id } })
        .collation({ locale: 'fr', strength: 2 });
      if (existant) {
        throw new ConflictException('Un centre porte déjà ce nom');
      }
      centre.nom = dto.nom;
    }

    if (dto.ville !== undefined) centre.ville = dto.ville;
    if (dto.telephone !== undefined) centre.telephone = dto.telephone;
    if (dto.adresse !== undefined) centre.adresse = dto.adresse;
    if (dto.niu !== undefined) centre.niu = dto.niu;
    if (dto.rccm !== undefined) centre.rccm = dto.rccm;
    if (dto.piedDePageRecu !== undefined) centre.piedDePageRecu = dto.piedDePageRecu;
    if (dto.modesPaiement !== undefined) centre.modesPaiement = dto.modesPaiement;

    await centre.save();
    return this.obtenirParametres(centreId);
  }

  /** Envoi du logo : PNG ou JPG, 1 Mo maximum */
  async televerserLogo(centreId: string, fichier: FichierEnvoye | undefined) {
    if (!fichier) {
      throw new BadRequestException('Aucun fichier reçu');
    }
    if (!TYPES_LOGO_ACCEPTES.includes(fichier.mimetype)) {
      throw new BadRequestException('Le logo doit être une image PNG ou JPG');
    }
    if (fichier.size > TAILLE_MAX_LOGO) {
      throw new BadRequestException('Le logo ne doit pas dépasser 1 Mo');
    }

    const extension = fichier.mimetype === 'image/png' ? 'png' : 'jpg';
    // Un nom différent à chaque envoi : le navigateur n'affiche jamais l'ancien logo
    const cle = await this.s3Service.televerserFichier(
      `logos/${centreId}/logo-${Date.now()}.${extension}`,
      fichier.buffer,
      fichier.mimetype,
    );
    if (!cle) {
      throw new InternalServerErrorException(
        "Le logo n'a pas pu être enregistré. Réessaie dans un instant.",
      );
    }

    await this.centreModel.findByIdAndUpdate(centreId, { logoKey: cle }).exec();
    return this.obtenirParametres(centreId);
  }

  // ---- Bandeau de rappel ----

  /** Ce qui est déjà configuré et ce qui manque encore (pour le bandeau de rappel) */
  async etatConfiguration(centreId: string) {
    const [centre, nombreServices, nombreSecretaires] = await Promise.all([
      this.trouverCentre(centreId),
      this.tarifModel.countDocuments({ centreId, actif: { $ne: false } }),
      this.userModel.countDocuments({ centreId, role: Role.SECRETARIAT }),
    ]);

    const elements: ElementConfiguration[] = [
      {
        cle: 'logo',
        libelle: 'Ajouter le logo du centre',
        fait: !!centre.logoKey,
        lien: '/parametres',
      },
      {
        cle: 'adresse',
        libelle: "Renseigner l'adresse du centre",
        fait: !!centre.adresse?.trim(),
        lien: '/parametres',
      },
      {
        cle: 'service',
        libelle: 'Créer au moins un service',
        fait: nombreServices > 0,
        lien: '/tarifs',
      },
      {
        cle: 'paiement',
        libelle: 'Choisir au moins un mode de paiement',
        // Un ancien centre sans liste enregistrée accepte tous les modes
        fait: !centre.modesPaiement || centre.modesPaiement.length > 0,
        lien: '/parametres',
      },
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