import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Historique, HistoriqueDocument } from './schemas/historique.schema';

export interface EnregistrerActionParams {
  utilisateurEmail: string;
  utilisateurNom?: string;
  role?: string;
  action: string;
  module: string;
  route?: string;
  statut?: 'succès' | 'échec';
  details?: string;
}

export interface FiltresHistorique {
  utilisateur?: string;
  module?: string;
  dateDebut?: string;
  dateFin?: string;
  page?: number;
  limite?: number;
}

@Injectable()
export class HistoriqueService {
  private readonly logger = new Logger(HistoriqueService.name);

  constructor(
    @InjectModel(Historique.name)
    private historiqueModel: Model<HistoriqueDocument>,
  ) {}

  /**
   * Enregistre une action dans le journal. Ne doit jamais faire échouer
   * l'action principale : toute erreur est simplement loguée côté serveur.
   */
  async enregistrer(params: EnregistrerActionParams) {
    try {
      await this.historiqueModel.create({
        ...params,
        statut: params.statut ?? 'succès',
        date: new Date(),
      });
    } catch (erreur) {
      this.logger.warn(`Échec de l'enregistrement de l'historique : ${erreur}`);
    }
  }

  async findAll(filtres: FiltresHistorique) {
    const { utilisateur, module, dateDebut, dateFin } = filtres;
    const page = filtres.page && filtres.page > 0 ? filtres.page : 1;
    const limite = filtres.limite && filtres.limite > 0 ? filtres.limite : 50;

    const requete: Record<string, any> = {};

    if (utilisateur) {
      requete.$or = [
        { utilisateurEmail: { $regex: utilisateur, $options: 'i' } },
        { utilisateurNom: { $regex: utilisateur, $options: 'i' } },
      ];
    }
    if (module) {
      requete.module = module;
    }
    if (dateDebut || dateFin) {
      requete.date = {};
      if (dateDebut) requete.date.$gte = new Date(dateDebut);
      if (dateFin) requete.date.$lte = new Date(dateFin);
    }

    const [donnees, total] = await Promise.all([
      this.historiqueModel
        .find(requete)
        .sort({ date: -1 })
        .skip((page - 1) * limite)
        .limit(limite)
        .exec(),
      this.historiqueModel.countDocuments(requete).exec(),
    ]);

    return { donnees, total, page, limite };
  }
}