import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inscription, InscriptionDocument } from '../inscriptions/schemas/inscription.schema';
import { Candidat, CandidatDocument } from '../candidats/schemas/candidat.schema';

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(Inscription.name) private inscriptionModel: Model<InscriptionDocument>,
    @InjectModel(Candidat.name) private candidatModel: Model<CandidatDocument>,
  ) {}

  private debutAujourdhui() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private debutSemaine() {
    const d = new Date();
    const jour = d.getDay();
    const decalage = jour === 0 ? 6 : jour - 1;
    d.setDate(d.getDate() - decalage);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private debutMois() {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private async agregerDepuis(dateDebut: Date) {
    const inscriptions = await this.inscriptionModel.find({
      dateInscription: { $gte: dateDebut },
    });
    const nombreInscriptions = inscriptions.length;
    const montantEncaisse = inscriptions.reduce((total, i) => total + i.montantPaye, 0);
    return { nombreInscriptions, montantEncaisse };
  }

  async journalieres() {
    const nombreCandidatsTotal = await this.candidatModel.countDocuments();
    const { nombreInscriptions, montantEncaisse } = await this.agregerDepuis(this.debutAujourdhui());
    return {
      nombreCandidatsTotal,
      nombreInscriptionsJour: nombreInscriptions,
      montantEncaisseJour: montantEncaisse,
    };
  }

  async hebdomadaires() {
    const { nombreInscriptions, montantEncaisse } = await this.agregerDepuis(this.debutSemaine());
    return {
      nombreInscriptionsSemaine: nombreInscriptions,
      montantEncaisseSemaine: montantEncaisse,
    };
  }

  async mensuelles() {
    const { nombreInscriptions, montantEncaisse } = await this.agregerDepuis(this.debutMois());
    return {
      nombreInscriptionsMois: nombreInscriptions,
      montantEncaisseMois: montantEncaisse,
    };
  }

 async graphiques() {
    const debut = this.debutMois();
    const inscriptions = await this.inscriptionModel.find({
      dateInscription: { $gte: debut },
    });

    const parJour: Record<string, { inscriptions: number; montant: number }> = {};
    for (const insc of inscriptions) {
      const jour = insc.dateInscription.toISOString().slice(0, 10);
      if (!parJour[jour]) {
        parJour[jour] = { inscriptions: 0, montant: 0 };
      }
      parJour[jour].inscriptions += 1;
      parJour[jour].montant += insc.montantPaye;
    }

    return parJour;
  }
}