import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Inscription, InscriptionDocument, ModePaiement } from './schemas/inscription.schema';
import { Candidat, CandidatDocument } from '../candidats/schemas/candidat.schema';
import { CreateInscriptionDto } from './dto/create-inscription.dto';
import { UpdateInscriptionDto } from './dto/update-inscription.dto';
import { TarifsService } from '../tarifs/tarifs.service';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class InscriptionsService {
  constructor(
    @InjectModel(Inscription.name) private inscriptionModel: Model<InscriptionDocument>,
    @InjectModel(Candidat.name) private candidatModel: Model<CandidatDocument>,
    private tarifsService: TarifsService,
    private mailService: MailService,
    private usersService: UsersService,
  ) {}

  async create(createInscriptionDto: CreateInscriptionDto) {
    // 1. Vérifier que le candidat existe
    const candidat = await this.candidatModel.findById(createInscriptionDto.candidatId);
    if (!candidat) {
      throw new NotFoundException('Candidat introuvable');
    }

    // 2. Charger l'offre active du service (définie dans /tarifs). Il n'y a
    //    désormais qu'une seule offre par service, qui porte elle-même la
    //    liste de ses régimes possibles.
    const offre = await this.tarifsService.findActifParService(
      createInscriptionDto.service,
    );

    if (!offre) {
      throw new BadRequestException(
        "Aucune offre active n'est configurée pour ce service. Va dans la page Tarifs pour créer ou activer cette offre.",
      );
    }

    // 3. Vérifier le régime, si ce service en a besoin.
    if (offre.regimeActif) {
      if (!createInscriptionDto.regime) {
        throw new BadRequestException('Le régime est obligatoire pour ce service');
      }
      if (!offre.regimes?.includes(createInscriptionDto.regime)) {
        throw new BadRequestException(
          `Le régime "${createInscriptionDto.regime}" n'existe pas pour ce service.`,
        );
      }
    }

    // 4. Déterminer le montant total : prix fixe de l'offre, ou montant
    //    négocié librement si le service l'autorise.
    let montantTotal: number;
    if (offre.montantNegociable) {
      if (createInscriptionDto.montantNegocie === undefined) {
        throw new BadRequestException('Le montant négocié est obligatoire pour ce service');
      }
      montantTotal = createInscriptionDto.montantNegocie;
    } else {
      montantTotal = offre.prix ?? 0;
    }

    // 4.5 Appliquer une remise, uniquement si le service l'autorise.
    const remise = offre.remiseActive ? (createInscriptionDto.remise ?? 0) : 0;

    if (remise < 0) {
      throw new BadRequestException('La remise ne peut pas être négative');
    }
    if (remise > montantTotal) {
      throw new BadRequestException('La remise ne peut pas dépasser le montant total');
    }

    montantTotal = montantTotal - remise;

    // 5. La date d'inscription est toujours aujourd'hui, générée par le système
    const dateInscription = new Date();

    // 6. Calculer dateDebutTest / dateFin selon la configuration du service
    const dateDebutTest = createInscriptionDto.dateDebutTest
      ? new Date(createInscriptionDto.dateDebutTest)
      : dateInscription;

    let dateFin: Date;
    if (offre.dateFinNecessaire) {
      if (!createInscriptionDto.dateFin) {
        throw new BadRequestException('La date de fin est obligatoire pour ce service');
      }
      dateFin = new Date(createInscriptionDto.dateFin);
    } else {
      dateFin = new Date(dateDebutTest);
      dateFin.setDate(dateFin.getDate() + (offre.dureeJours ?? 0));
    }


    // 7. Calculer le montant payé selon le mode de paiement
    let montantPaye: number;
    if (createInscriptionDto.modePaiement === ModePaiement.MOBILE_ESPECES) {
      montantPaye =
        (createInscriptionDto.montantMobile ?? 0) +
        (createInscriptionDto.montantEspeces ?? 0);
    } else {
      montantPaye = createInscriptionDto.montantPaye ?? 0;
    }

    // 7.5 Vérifier que le montant payé est cohérent
    if (montantPaye < 0) {
      throw new BadRequestException('Le montant payé ne peut pas être négatif');
    }
    if (montantPaye > montantTotal) {
      throw new BadRequestException('Le montant payé ne peut pas dépasser le montant total');
    }

    // 8. Calculer le reste à payer
    const resteAPayer = montantTotal - montantPaye;

    // 9. Générer un numéro de reçu unique (vérifié pour éviter tout conflit)
    const jour = String(dateInscription.getDate()).padStart(2, '0');
    const mois = String(dateInscription.getMonth() + 1).padStart(2, '0');
    const annee = dateInscription.getFullYear();

    let compteur = (await this.inscriptionModel.countDocuments()) + 1;
    let numeroRecu = `${jour}${mois}${annee}${String(compteur).padStart(4, '0')}`;

    while (await this.inscriptionModel.exists({ numeroRecu })) {
      compteur += 1;
      numeroRecu = `${jour}${mois}${annee}${String(compteur).padStart(4, '0')}`;
    }

    // 10. Assembler et sauvegarder l'inscription
    const inscription = new this.inscriptionModel({
      candidatId: new Types.ObjectId(createInscriptionDto.candidatId),
      service: createInscriptionDto.service,
      regime: offre.regimeActif ? createInscriptionDto.regime : undefined,
      dateInscription,
      dateDebutTest,
      dateFin,
      montantTotal,
      remise,
      montantPaye,
      resteAPayer,
      modePaiement: createInscriptionDto.modePaiement,
      montantMobile: createInscriptionDto.montantMobile,
      montantEspeces: createInscriptionDto.montantEspeces,
      facturePar: createInscriptionDto.facturePar,
      reference: createInscriptionDto.reference,
      numeroRecu,
    });

    await inscription.save();

    // Notifier les administrateurs de cette nouvelle inscription (sans bloquer la réponse si l'email échoue)
    this.notifierAdminsNouvelleInscription(inscription, candidat).catch(() => undefined);

    return inscription;
  }

  private async notifierAdminsNouvelleInscription(
    inscription: InscriptionDocument,
    candidat: CandidatDocument,
  ) {
    const emailsAdmins = await this.usersService.emailsAdmins();
    if (emailsAdmins.length === 0) return;

    await this.mailService.envoyer({
      to: emailsAdmins,
      subject: `Nouvelle inscription — ${candidat.nom} ${candidat.prenom}`,
      htmlContent: `
        <p>Une nouvelle inscription vient d'être enregistrée :</p>
        <ul>
          <li><strong>Candidat :</strong> ${candidat.nom} ${candidat.prenom}</li>
          <li><strong>Téléphone :</strong> ${candidat.telephone}</li>
          <li><strong>Service :</strong> ${inscription.service}${inscription.regime ? ' — ' + inscription.regime : ''}</li>
          <li><strong>Montant total :</strong> ${inscription.montantTotal.toLocaleString('fr-FR')} FCFA</li>
          <li><strong>Montant payé :</strong> ${inscription.montantPaye.toLocaleString('fr-FR')} FCFA</li>
          <li><strong>Reste à payer :</strong> ${inscription.resteAPayer.toLocaleString('fr-FR')} FCFA</li>
          <li><strong>Mode de paiement :</strong> ${inscription.modePaiement}</li>
          <li><strong>Facturé par :</strong> ${inscription.facturePar}</li>
          <li><strong>Reçu N° :</strong> ${inscription.numeroRecu}</li>
        </ul>
      `,
    });
  }

  /** Inscriptions dont la date de fin est aujourd'hui ou déjà passée, pas encore notifiées */
  async trouverFormationsTermineesNonNotifiees() {
    const finDeJournee = new Date();
    finDeJournee.setHours(23, 59, 59, 999);

    return this.inscriptionModel
      .find({
        dateFin: { $lte: finDeJournee },
        formationTermineeNotifiee: { $ne: true },
      })
      .populate('candidatId')
      .exec();
  }

  async marquerFormationNotifiee(id: string) {
    await this.inscriptionModel
      .findByIdAndUpdate(id, { formationTermineeNotifiee: true })
      .exec();
  }

  /** Inscriptions avec un reste à payer, enregistrées depuis au moins `joursMin` jours */
  async trouverEnRetardDePaiement(joursMin: number) {
    const seuil = new Date();
    seuil.setDate(seuil.getDate() - joursMin);
    seuil.setHours(23, 59, 59, 999);

    return this.inscriptionModel
      .find({
        resteAPayer: { $gt: 0 },
        dateInscription: { $lte: seuil },
      })
      .populate('candidatId')
      .exec();
  }

  async verifierDette(telephone: string) {
    const candidat = await this.candidatModel.findOne({ telephone }).exec();
    if (!candidat) {
      return { existe: false };
    }

    const inscriptionAvecDette = await this.inscriptionModel
      .findOne({ candidatId: candidat._id, resteAPayer: { $gt: 0 } })
      .sort({ createdAt: -1 })
      .exec();

    if (!inscriptionAvecDette) {
      return { existe: true, aUneDette: false, candidat };
    }

    return {
      existe: true,
      aUneDette: true,
      candidat,
      inscription: inscriptionAvecDette,
    };
  }

  async findAll(filtres: {
    nom?: string;
    service?: string;
    regime?: string;
    candidatId?: string;
    statut?: string;
    dateInscriptionDebut?: string;
    dateInscriptionFin?: string;
    paiement?: string;
  }) {
    const filtre: Record<string, any> = {};

    if (filtres.service) {
      filtre.service = filtres.service;
    }
    if (filtres.regime) {
      filtre.regime = filtres.regime;
    }
    if (filtres.candidatId && Types.ObjectId.isValid(filtres.candidatId)) {
      filtre.candidatId = new Types.ObjectId(filtres.candidatId);
    }

    // Statut : "en cours" si la date de fin de formation n'est pas encore passée,
    // "terminé" si elle est déjà passée.
    if (filtres.statut === 'en_cours') {
      filtre.dateFin = { $gte: new Date() };
    } else if (filtres.statut === 'termine') {
      filtre.dateFin = { $lt: new Date() };
    }

    // Date d'inscription : filtre par plage (début et/ou fin)
    if (filtres.dateInscriptionDebut || filtres.dateInscriptionFin) {
      filtre.dateInscription = {};
      if (filtres.dateInscriptionDebut) {
        filtre.dateInscription.$gte = new Date(filtres.dateInscriptionDebut);
      }
      if (filtres.dateInscriptionFin) {
        const fin = new Date(filtres.dateInscriptionFin);
        fin.setHours(23, 59, 59, 999);
        filtre.dateInscription.$lte = fin;
      }
    }

    // Montant restant : avec dette en cours, ou entièrement soldé
    if (filtres.paiement === 'avec_reste') {
      filtre.resteAPayer = { $gt: 0 };
    } else if (filtres.paiement === 'solde') {
      filtre.resteAPayer = 0;
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

  async remove(id: string) {
    const inscription = await this.inscriptionModel.findByIdAndDelete(id).exec();
    if (!inscription) {
      throw new NotFoundException('Inscription introuvable');
    }

    const inscriptionsRestantes = await this.inscriptionModel.countDocuments({
      candidatId: inscription.candidatId,
    });

    if (inscriptionsRestantes === 0) {
      await this.candidatModel.findByIdAndDelete(inscription.candidatId).exec();
    }

    return inscription;
  }

  async ajouterPaiement(id: string, montant: number) {
    const inscription = await this.inscriptionModel.findById(id);
    if (!inscription) {
      throw new NotFoundException('Inscription introuvable');
    }
    if (montant <= 0) {
      throw new BadRequestException('Le montant du paiement doit être positif');
    }
    const nouveauMontantPaye = inscription.montantPaye + montant;
    if (nouveauMontantPaye > inscription.montantTotal) {
      throw new BadRequestException('Ce paiement dépasserait le montant total dû');
    }
    inscription.montantPaye = nouveauMontantPaye;
    inscription.resteAPayer = inscription.montantTotal - inscription.montantPaye;
    return inscription.save();
  }
}