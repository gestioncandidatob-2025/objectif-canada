import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Centre, CentreDocument, StatutCentre } from './schemas/centre.schema';

@Injectable()
export class CentresService {
  constructor(
    @InjectModel(Centre.name) private centreModel: Model<CentreDocument>,
  ) {}

  creer(donnees: Partial<Centre>) {
    return this.centreModel.create(donnees);
  }

  async trouverParId(id: string) {
    const centre = await this.centreModel.findById(id).exec();
    if (!centre) {
      throw new NotFoundException('Centre introuvable');
    }
    return centre;
  }

  /** Centres actifs : utilisé par les tâches planifiées (relances, notifications) */
  trouverActifs() {
    return this.centreModel.find({ statut: StatutCentre.ACTIF }).exec();
  }
}