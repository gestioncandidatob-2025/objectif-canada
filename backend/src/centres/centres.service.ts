import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Centre, CentreDocument, StatutCentre } from './schemas/centre.schema';

@Injectable()
export class CentresService {
  constructor(
    @InjectModel(Centre.name) private centreModel: Model<CentreDocument>,
  ) {}

  async creer(donnees: Partial<Centre>) {
    const existant = await this.centreModel.exists({ nom: donnees.nom });
    if (existant) {
      throw new ConflictException('Un centre porte déjà ce nom');
    }
    return this.centreModel.create(donnees);
  }

  async trouverParId(id: string) {
    const centre = await this.centreModel.findById(id).exec();
    if (!centre) {
      throw new NotFoundException('Centre introuvable');
    }
    return centre;
  }

  /**
   * Réserve le prochain numéro de reçu du centre (1, 2, 3…). L'opération est
   * atomique : MongoDB garantit qu'aucun autre appel n'obtient le même numéro.
   */
  async prochainNumeroRecu(centreId: string): Promise<number> {
    const centre = await this.centreModel
      .findByIdAndUpdate(centreId, { $inc: { dernierNumeroRecu: 1 } }, { new: true })
      .exec();
    if (!centre) {
      throw new NotFoundException('Centre introuvable');
    }
    return centre.dernierNumeroRecu;
  }

  /** Tous les centres, du plus récent au plus ancien (espace super admin) */
  lister() {
    return this.centreModel.find().sort({ createdAt: -1 }).exec();
  }

  /** Centres actifs : utilisé par les tâches planifiées (relances, notifications) */
  trouverActifs() {
    return this.centreModel.find({ statut: StatutCentre.ACTIF }).exec();
  }

  async changerStatut(id: string, statut: StatutCentre) {
    const centre = await this.centreModel
      .findByIdAndUpdate(id, { statut }, { new: true })
      .exec();
    if (!centre) {
      throw new NotFoundException('Centre introuvable');
    }
    return centre;
  }

  async supprimer(id: string) {
    await this.centreModel.findByIdAndDelete(id).exec();
  }
}