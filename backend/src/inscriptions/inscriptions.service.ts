import { Injectable, NotFoundException, BadRequestException  } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inscription, InscriptionDocument, Service, ModePaiement  } from './schemas/inscription.schema';
import { Candidat, CandidatDocument } from '../candidats/schemas/candidat.schema';
import { CreateInscriptionDto } from './dto/create-inscription.dto';
import { UpdateInscriptionDto } from './dto/update-inscription.dto';

@Injectable()
export class InscriptionsService {
  constructor(
    @InjectModel(Inscription.name) private inscriptionModel: Model<InscriptionDocument>,
    @InjectModel(Candidat.name) private candidatModel: Model<CandidatDocument>,
  ) {}

 async create(createInscriptionDto: CreateInscriptionDto) {
    // 1. Vérifier que le candidat existe
    const candidat = await this.candidatModel.findById(createInscriptionDto.candidatId);
    if (!candidat) {
      throw new NotFoundException('Candidat introuvable');
    }

    // 2. Déterminer le montant total selon le service choisi
    let montantTotal: number;
    switch (createInscriptionDto.service) {
      case Service.TCF:
        montantTotal = 65000;
        break;
      case Service.EXAMEN_BLANC:
        montantTotal = 5000;
        break;
      case Service.TCF_SPECIAL:
        montantTotal = createInscriptionDto.montantNegocie ?? 0;
        break;
    }

    // 3. La date d'inscription est toujours aujourd'hui, générée par le système
    const dateInscription = new Date();

    // 4. Vérifier régime + dateDebutTest, et calculer dateDebutTest / dateFin
    let dateDebutTest: Date;
    let dateFin: Date;

    if (createInscriptionDto.service === Service.EXAMEN_BLANC) {
      // Examen blanc : un seul jour, pas de régime, pas de dateDebutTest à fournir
      dateDebutTest = dateInscription;
      dateFin = dateInscription;
    } else {
      // TCF / TCF SPECIAL : régime et dateDebutTest obligatoires
      if (!createInscriptionDto.regime) {
        throw new BadRequestException(
          'Le régime (jour/soir) est obligatoire pour ce service',
        );
      }
      if (!createInscriptionDto.dateDebutTest) {
        throw new BadRequestException(
          'La date de début du test est obligatoire pour ce service',
        );
      }
      dateDebutTest = new Date(createInscriptionDto.dateDebutTest);
      dateFin = new Date(dateDebutTest);
      dateFin.setDate(dateFin.getDate() + 30);
    }

    // 5. Calculer le montant payé selon le mode de paiement
    let montantPaye: number;
    if (createInscriptionDto.modePaiement === ModePaiement.MOBILE_ESPECES) {
      montantPaye =
        (createInscriptionDto.montantMobile ?? 0) +
        (createInscriptionDto.montantEspeces ?? 0);
    } else {
      montantPaye = createInscriptionDto.montantPaye ?? 0;
    }

    // 6. Calculer le reste à payer
    const resteAPayer = montantTotal - montantPaye;

    // 7. Générer le numéro de reçu unique (basé sur la date d'inscription)
    const nombreInscriptions = await this.inscriptionModel.countDocuments();
    const compteur = nombreInscriptions + 1;

    const jour = String(dateInscription.getDate()).padStart(2, '0');
    const mois = String(dateInscription.getMonth() + 1).padStart(2, '0');
    const annee = dateInscription.getFullYear();
    const compteurFormate = String(compteur).padStart(4, '0');

    const numeroRecu = `${jour}${mois}${annee}${compteurFormate}`;

    // 8. Assembler et sauvegarder l'inscription
    const inscription = new this.inscriptionModel({
      candidatId: createInscriptionDto.candidatId,
      service: createInscriptionDto.service,
      regime: createInscriptionDto.regime,
      dateInscription,
      dateDebutTest,
      dateFin,
      montantTotal,
      montantPaye,
      resteAPayer,
      modePaiement: createInscriptionDto.modePaiement,
      montantMobile: createInscriptionDto.montantMobile,
      montantEspeces: createInscriptionDto.montantEspeces,
      facturePar: createInscriptionDto.facturePar,
      reference: createInscriptionDto.reference,
      numeroRecu,
    });

   return inscription.save();
  }

  async findAll(filtres: { nom?: string; service?: string; regime?: string }) {
    const filtre: Record<string, any> = {};

    if (filtres.service) {
      filtre.service = filtres.service;
    }
    if (filtres.regime) {
      filtre.regime = filtres.regime;
    }

    if (filtres.nom) {
      const candidats = await this.candidatModel.find({
        $or: [
          { nom: { $regex: filtres.nom, $options: 'i' } },
          { prenom: { $regex: filtres.nom, $options: 'i' } },
        ],
      });
      const idsCandidats = candidats.map((c) => c._id);
      filtre.candidatId = { $in: idsCandidats };
    }

    return this.inscriptionModel.find(filtre).populate('candidatId').exec();
  }

  findOne(id: string) {
    return this.inscriptionModel.findById(id).populate('candidatId').exec();
  }

  update(id: string, updateInscriptionDto: UpdateInscriptionDto) {
    return this.inscriptionModel
      .findByIdAndUpdate(id, updateInscriptionDto, { new: true })
      .exec();
  }

  remove(id: string) {
    return this.inscriptionModel.findByIdAndDelete(id).exec();
  }
}