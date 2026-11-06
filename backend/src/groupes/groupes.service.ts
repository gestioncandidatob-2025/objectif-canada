import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Groupe, GroupeDocument } from './schemas/groupe.schema';
import { Inscription, InscriptionDocument } from '../inscriptions/schemas/inscription.schema';
import { CreateGroupeDto } from './dto/create-groupe.dto';
import { UpdateGroupeDto } from './dto/update-groupe.dto';

// Comparaison des noms sans tenir compte des majuscules ("Soir 1" = "soir 1")
const COLLATION_NOM = { locale: 'fr', strength: 2 };

@Injectable()
export class GroupesService {
  constructor(
    @InjectModel(Groupe.name) private groupeModel: Model<GroupeDocument>,
    @InjectModel(Inscription.name) private inscriptionModel: Model<InscriptionDocument>,
  ) {}

  /** Inscriptions "en cours" : la date de fin de formation n'est pas encore passée */
  private filtreEnCours(centreId: string) {
    return { centreId, dateFin: { $gte: new Date() } };
  }

  private async trouverGroupe(id: string, centreId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Groupe introuvable');
    }
    const groupe = await this.groupeModel.findOne({ _id: id, centreId }).exec();
    if (!groupe) {
      throw new NotFoundException('Groupe introuvable');
    }
    return groupe;
  }

  private async verifierNomLibre(nom: string, centreId: string, idExclu?: string) {
    const filtre: Record<string, unknown> = { centreId, nom };
    if (idExclu) filtre._id = { $ne: idExclu };
    const existant = await this.groupeModel.findOne(filtre).collation(COLLATION_NOM).exec();
    if (existant) {
      throw new ConflictException('Un groupe porte déjà ce nom dans ton centre');
    }
  }

  /** "Soir ", "SOIR" → "soir" ; vide → undefined */
  private normaliserRegime(regime?: string | null): string | undefined {
    const propre = (regime ?? '').trim().toLowerCase();
    return propre || undefined;
  }

  /** Un seul groupe actif peut être le premier groupe d'un régime */
  private async verifierRegimeLibre(regime: string, centreId: string, idExclu?: string) {
    const filtre: Record<string, unknown> = { centreId, regimeEntree: regime, actif: true };
    if (idExclu) filtre._id = { $ne: idExclu };
    const existant = await this.groupeModel.findOne(filtre).exec();
    if (existant) {
      throw new ConflictException(
        `« ${existant.nom} » est déjà le premier groupe du régime « ${regime} »`,
      );
    }
  }

  /**
   * Vérifie le passage automatique : groupe suivant et nombre de jours vont
   * ensemble, le groupe suivant appartient au centre, et on ne crée pas de
   * boucle (A → B → A).
   */
  private async verifierPassage(
    centreId: string,
    groupeSuivantId: string | undefined,
    joursAvantPassage: number | undefined,
    idGroupe?: string,
  ) {
    if (!groupeSuivantId && !joursAvantPassage) return;
    if (!groupeSuivantId || !joursAvantPassage) {
      throw new BadRequestException(
        'Pour le passage automatique, indique à la fois le groupe suivant et le nombre de jours',
      );
    }
    if (idGroupe && groupeSuivantId === idGroupe) {
      throw new BadRequestException('Un groupe ne peut pas passer dans lui-même');
    }

    // On suit la chaîne des groupes suivants pour repérer une boucle
    let courant: string | undefined = groupeSuivantId;
    for (let etape = 0; etape < 50 && courant; etape++) {
      const suivant = await this.trouverGroupe(courant, centreId);
      const prochain = suivant.groupeSuivantId ? String(suivant.groupeSuivantId) : undefined;
      if (idGroupe && prochain === idGroupe) {
        throw new BadRequestException(
          'Ce passage créerait une boucle entre les groupes (ex : A → B → A)',
        );
      }
      courant = prochain;
    }
  }

  /** Liste des groupes avec leur nombre de candidats en cours */
  async lister(centreId: string, seulementActifs = false) {
    const filtre: Record<string, unknown> = { centreId };
    if (seulementActifs) filtre.actif = true;
    const groupes = await this.groupeModel
      .find(filtre)
      .sort({ nom: 1 })
      .collation(COLLATION_NOM)
      .lean()
      .exec();

    // Nombre de candidats en cours par groupe, en une seule requête
    const effectifs = await this.inscriptionModel.aggregate<{ _id: Types.ObjectId; total: number }>([
      {
        $match: {
          // centreId en premier : exigé par le garde-fou multi-centres
          centreId: new Types.ObjectId(centreId),
          dateFin: { $gte: new Date() },
          groupeId: { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$groupeId', total: { $sum: 1 } } },
    ]);
    const effectifParGroupe = new Map(effectifs.map((e) => [String(e._id), e.total]));

    return groupes.map((groupe) => {
      const effectif = effectifParGroupe.get(String(groupe._id)) ?? 0;
      return {
        ...groupe,
        effectif,
        plein: groupe.capacite ? effectif >= groupe.capacite : false,
      };
    });
  }

  async creer(dto: CreateGroupeDto, centreId: string) {
    await this.verifierNomLibre(dto.nom, centreId);
    const regimeEntree = this.normaliserRegime(dto.regimeEntree);
    if (regimeEntree) {
      await this.verifierRegimeLibre(regimeEntree, centreId);
    }
    await this.verifierPassage(
      centreId,
      dto.groupeSuivantId ?? undefined,
      dto.joursAvantPassage ?? undefined,
    );

    return this.groupeModel.create({
      centreId,
      nom: dto.nom,
      horaire: dto.horaire,
      capacite: dto.capacite ?? undefined,
      regimeEntree,
      groupeSuivantId: dto.groupeSuivantId ?? undefined,
      joursAvantPassage: dto.joursAvantPassage ?? undefined,
    });
  }

  /** null dans un champ = l'effacer ; champ absent = ne pas y toucher */
  async modifier(id: string, dto: UpdateGroupeDto, centreId: string) {
    const groupe = await this.trouverGroupe(id, centreId);

    if (dto.nom !== undefined && dto.nom !== groupe.nom) {
      await this.verifierNomLibre(dto.nom, centreId, id);
      groupe.nom = dto.nom;
    }
    if (dto.horaire !== undefined) groupe.horaire = dto.horaire;
    if (dto.capacite !== undefined) groupe.capacite = dto.capacite ?? undefined;
    if (dto.actif !== undefined) groupe.actif = dto.actif;
    if (dto.regimeEntree !== undefined) {
      groupe.regimeEntree = this.normaliserRegime(dto.regimeEntree);
    }
    // Un groupe actif qui est premier groupe d'un régime doit être le seul
    if (groupe.actif && groupe.regimeEntree) {
      await this.verifierRegimeLibre(groupe.regimeEntree, centreId, id);
    }

    // Passage automatique : on vérifie la combinaison finale
    const groupeSuivantId =
      dto.groupeSuivantId !== undefined
        ? (dto.groupeSuivantId ?? undefined)
        : groupe.groupeSuivantId
          ? String(groupe.groupeSuivantId)
          : undefined;
    const joursAvantPassage =
      dto.joursAvantPassage !== undefined
        ? (dto.joursAvantPassage ?? undefined)
        : groupe.joursAvantPassage;
    await this.verifierPassage(centreId, groupeSuivantId, joursAvantPassage, id);
    groupe.groupeSuivantId = groupeSuivantId ? new Types.ObjectId(groupeSuivantId) : undefined;
    groupe.joursAvantPassage = joursAvantPassage;

    await groupe.save();
    return groupe;
  }

  /** Candidats en cours d'un groupe, avec ce qu'ils doivent encore */
  async candidats(id: string, centreId: string) {
    const groupe = await this.trouverGroupe(id, centreId);

    const inscriptions = await this.inscriptionModel
      .find({ ...this.filtreEnCours(centreId), groupeId: groupe._id })
      .sort({ dateEntreeGroupe: 1 })
      .populate({ path: 'candidatId', match: { centreId } })
      .lean()
      .exec();

    const lignes = inscriptions.map((inscription) => {
      const candidat = inscription.candidatId as unknown as
        | { _id: Types.ObjectId; nom: string; prenom: string; telephone: string }
        | null;
      return {
        inscriptionId: inscription._id,
        candidatId: candidat?._id,
        nom: candidat?.nom ?? '',
        prenom: candidat?.prenom ?? '',
        telephone: candidat?.telephone ?? '',
        numeroRecu: inscription.numeroRecu,
        service: inscription.service,
        dateEntreeGroupe: inscription.dateEntreeGroupe,
        dateFin: inscription.dateFin,
        montantTotal: inscription.montantTotal,
        montantPaye: inscription.montantPaye,
        resteAPayer: inscription.resteAPayer,
      };
    });

    return {
      groupe,
      effectif: lignes.length,
      totalResteAPayer: lignes.reduce((total, ligne) => total + (ligne.resteAPayer ?? 0), 0),
      candidats: lignes,
    };
  }

  /**
   * Premier groupe d'un régime : c'est là qu'entre automatiquement un nouvel
   * inscrit. Renvoie null si le régime n'a pas de premier groupe actif
   * (le candidat n'est alors dans aucun groupe). Un groupe plein reçoit
   * quand même le candidat : la page Groupes affiche un avertissement.
   */
  async groupeDEntree(regime: string | undefined, centreId: string) {
    const regimeNormalise = this.normaliserRegime(regime);
    if (!regimeNormalise) return null;
    return this.groupeModel
      .findOne({ centreId, regimeEntree: regimeNormalise, actif: true })
      .exec();
  }
}