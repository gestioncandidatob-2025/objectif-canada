import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Groupe, GroupeDocument } from './schemas/groupe.schema';
import { Inscription, InscriptionDocument } from '../inscriptions/schemas/inscription.schema';
import { Tarif, TarifDocument } from '../tarifs/schemas/tarif.schema';
import { UpdateBlocGroupesDto } from './dto/update-bloc-groupes.dto';

// Comparaison des noms sans tenir compte des majuscules ("Soir 1" = "soir 1")
const COLLATION_NOM = { locale: 'fr', strength: 2 };

// Nombre maximal de passages enchaînés en une seule fois
const MAX_TOURS_DE_PASSAGE = 10;

const UN_JOUR_MS = 24 * 60 * 60 * 1000;

// Libellés des anciens services (données existantes) ; tout autre service
// est mis en forme automatiquement ("examen_blanc" → "Examen Blanc")
const LABEL_SERVICE: Record<string, string> = {
  tcf: 'TCF',
  tcf_2mois: 'TCF 2 mois',
  examen_blanc: 'Examen blanc',
  tcf_special: 'TCF SPECIAL',
};

/**
 * Groupes de candidats du centre (remplacent les classes Jour/Soir).
 *
 * Chaque service a ses groupes, et un service à régimes a des groupes par
 * régime. Exemple : le service TCF avec les régimes Jour et Soir donne les
 * blocs « TCF — Jour » (TCF Jour 1, TCF Jour 2) et « TCF — Soir »
 * (TCF Soir 1, TCF Soir 2) ; le service Examen blanc, sans régime, donne
 * le bloc « Examen blanc » (Examen blanc 1, Examen blanc 2).
 *
 * - Le groupe 1 d'un bloc existe toujours : les nouveaux inscrits y entrent
 *   automatiquement.
 * - Le groupe 2 est facultatif : l'administrateur le coche et choisit après
 *   combien de jours les candidats y passent (automatiquement, chaque nuit).
 * - La capacité de chaque groupe est facultative.
 * La secrétaire n'intervient jamais sur les groupes.
 */
@Injectable()
export class GroupesService {
  private readonly logger = new Logger(GroupesService.name);

  constructor(
    @InjectModel(Groupe.name) private groupeModel: Model<GroupeDocument>,
    @InjectModel(Inscription.name) private inscriptionModel: Model<InscriptionDocument>,
    @InjectModel(Tarif.name) private tarifModel: Model<TarifDocument>,
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

  /** "Soir ", "SOIR" → "soir" ; vide → undefined */
  private normaliserRegime(regime?: string | null): string | undefined {
    const propre = (regime ?? '').trim().toLowerCase();
    return propre || undefined;
  }

  /** "soir" → "Soir" */
  private libelleRegime(regime: string): string {
    const propre = regime.trim();
    return propre.charAt(0).toUpperCase() + propre.slice(1);
  }

  /** "tcf" → "TCF", "examen_blanc" → "Examen blanc", "Cours intensif" → "Cours intensif" */
  private libelleService(service: string): string {
    if (LABEL_SERVICE[service]) return LABEL_SERVICE[service];
    return service
      .split(/[_\s]+/)
      .filter(Boolean)
      .map((mot) => mot.charAt(0).toUpperCase() + mot.slice(1))
      .join(' ');
  }

  /** Nombre de candidats en cours dans chaque groupe du centre (une seule requête) */
  private async effectifsParGroupe(centreId: string): Promise<Map<string, number>> {
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
    return new Map(effectifs.map((e) => [String(e._id), e.total]));
  }

  /** Liste simple de tous les groupes du centre, avec leur nombre de candidats */
  async lister(centreId: string) {
    const groupes = await this.groupeModel
      .find({ centreId })
      .sort({ nom: 1 })
      .collation(COLLATION_NOM)
      .lean()
      .exec();
    const effectifParGroupe = await this.effectifsParGroupe(centreId);
    return groupes.map((groupe) => {
      const effectif = effectifParGroupe.get(String(groupe._id)) ?? 0;
      return { ...groupe, effectif, plein: groupe.capacite ? effectif >= groupe.capacite : false };
    });
  }

  // ---------------------------------------------------------------------
  // Blocs de groupes : un par service, ou par service et régime
  // ---------------------------------------------------------------------

  /**
   * Les blocs du centre, d'après ses services actifs : un bloc par service
   * sans régime, un bloc par régime pour un service à régimes.
   */
  private async blocsDuCentre(centreId: string) {
    const tarifs = await this.tarifModel
      .find({ centreId, actif: { $ne: false } })
      .sort({ createdAt: 1 })
      .exec();

    const blocs: { service: string; regime?: string; libelle: string; prefixeNom: string }[] = [];
    const dejaVus = new Set<string>();

    for (const tarif of tarifs) {
      const libelleService = this.libelleService(tarif.service);
      const regimes = tarif.regimeActif ? (tarif.regimes ?? []) : [];
      const regimesPropres = regimes
        .map((r) => ({ cle: this.normaliserRegime(r), libelle: this.libelleRegime(r) }))
        .filter((r): r is { cle: string; libelle: string } => !!r.cle);

      if (regimesPropres.length === 0) {
        const cleBloc = `${tarif.service}|`;
        if (dejaVus.has(cleBloc)) continue;
        dejaVus.add(cleBloc);
        blocs.push({ service: tarif.service, libelle: libelleService, prefixeNom: libelleService });
        continue;
      }

      for (const regime of regimesPropres) {
        const cleBloc = `${tarif.service}|${regime.cle}`;
        if (dejaVus.has(cleBloc)) continue;
        dejaVus.add(cleBloc);
        blocs.push({
          service: tarif.service,
          regime: regime.cle,
          libelle: `${libelleService} — ${regime.libelle}`,
          prefixeNom: `${libelleService} ${regime.libelle}`,
        });
      }
    }
    return blocs;
  }

  /**
   * Les deux groupes d'un bloc. Le groupe 1 (ex : « TCF Soir 1 ») est créé
   * tout seul s'il n'existe pas encore ; le groupe 2 n'est créé que quand
   * l'administrateur le coche.
   */
  private async groupesDuBloc(
    service: string,
    regime: string | undefined,
    prefixeNom: string,
    centreId: string,
  ) {
    // regimeEntree: null trouve aussi les groupes sans régime enregistré
    let groupe1 = await this.groupeModel
      .findOne({ centreId, serviceEntree: service, regimeEntree: regime ?? null })
      .sort({ actif: -1 })
      .exec();

    if (!groupe1) {
      const nom1 = `${prefixeNom} 1`;
      // Un groupe du même nom existe déjà : on le réutilise
      groupe1 = await this.groupeModel.findOne({ centreId, nom: nom1 }).collation(COLLATION_NOM).exec();
      if (groupe1) {
        groupe1.serviceEntree = service;
        groupe1.regimeEntree = regime;
        groupe1.actif = true;
        await groupe1.save();
      } else {
        groupe1 = await this.groupeModel.create({
          centreId,
          nom: nom1,
          serviceEntree: service,
          regimeEntree: regime,
        });
      }
    }

    let groupe2: GroupeDocument | null = null;
    if (groupe1.groupeSuivantId) {
      groupe2 = await this.groupeModel.findOne({ _id: groupe1.groupeSuivantId, centreId }).exec();
    }
    if (!groupe2) {
      groupe2 = await this.groupeModel
        .findOne({ centreId, nom: `${prefixeNom} 2` })
        .collation(COLLATION_NOM)
        .exec();
    }
    return { groupe1, groupe2 };
  }

  /** Ce que la page Groupes affiche : un bloc par service (et par régime) */
  async parBloc(centreId: string) {
    const blocs = await this.blocsDuCentre(centreId);
    const effectifs = await this.effectifsParGroupe(centreId);

    const resume = (groupe: GroupeDocument) => {
      const effectif = effectifs.get(String(groupe._id)) ?? 0;
      return {
        id: groupe._id,
        nom: groupe.nom,
        capacite: groupe.capacite ?? null,
        actif: groupe.actif,
        effectif,
        plein: groupe.capacite ? effectif >= groupe.capacite : false,
      };
    };

    // Type indiqué : sans lui, TypeScript croit que la liste reste toujours vide
    const resultat: Record<string, unknown>[] = [];
    for (const bloc of blocs) {
      const { groupe1, groupe2 } = await this.groupesDuBloc(
        bloc.service,
        bloc.regime,
        bloc.prefixeNom,
        centreId,
      );
      const deuxiemeGroupeActif =
        !!groupe2 &&
        groupe2.actif &&
        !!groupe1.groupeSuivantId &&
        String(groupe1.groupeSuivantId) === String(groupe2._id);

      resultat.push({
        service: bloc.service,
        regime: bloc.regime ?? null,
        libelle: bloc.libelle,
        groupe1: resume(groupe1),
        groupe2: groupe2 ? resume(groupe2) : null,
        nomGroupe2: groupe2?.nom ?? `${bloc.prefixeNom} 2`,
        deuxiemeGroupeActif,
        joursAvantPassage: deuxiemeGroupeActif ? (groupe1.joursAvantPassage ?? null) : null,
      });
    }
    return resultat;
  }

  /** Enregistre les réglages d'un bloc (bouton « Enregistrer » de la page Groupes) */
  async enregistrerBloc(dto: UpdateBlocGroupesDto, centreId: string) {
    const regime = this.normaliserRegime(dto.regime);
    const blocs = await this.blocsDuCentre(centreId);
    const bloc = blocs.find((b) => b.service === dto.service && b.regime === regime);
    if (!bloc) {
      throw new NotFoundException("Ce service (ou ce régime) n'existe pas dans les services actifs");
    }

    const { groupe1, groupe2: groupe2Existant } = await this.groupesDuBloc(
      bloc.service,
      bloc.regime,
      bloc.prefixeNom,
      centreId,
    );
    groupe1.actif = true;
    groupe1.capacite = dto.capacite1 ?? undefined;

    if (dto.deuxiemeGroupeActif) {
      if (!dto.joursAvantPassage) {
        throw new BadRequestException(
          `Indique après combien de jours les candidats passent en « ${bloc.prefixeNom} 2 »`,
        );
      }
      const groupe2 =
        groupe2Existant ??
        (await this.groupeModel.create({ centreId, nom: `${bloc.prefixeNom} 2` }));
      groupe2.actif = true;
      groupe2.capacite = dto.capacite2 ?? undefined;
      await groupe2.save();

      groupe1.groupeSuivantId = groupe2._id;
      groupe1.joursAvantPassage = dto.joursAvantPassage;
    } else {
      // Plus de deuxième groupe : plus de passage. Le groupe 2 est désactivé
      // (ses candidats actuels y restent jusqu'à la fin de leur formation).
      groupe1.groupeSuivantId = undefined;
      groupe1.joursAvantPassage = undefined;
      if (groupe2Existant && groupe2Existant.actif) {
        groupe2Existant.actif = false;
        await groupe2Existant.save();
      }
    }

    await groupe1.save();
    return this.parBloc(centreId);
  }

  /**
   * Groupe où entre automatiquement un nouvel inscrit : le groupe 1 du bloc
   * de son service (et de son régime), par exemple « TCF Soir 1 ». S'il
   * n'existe pas encore, il est créé tout de suite. Un groupe plein reçoit
   * quand même le candidat.
   */
  async groupeDEntree(service: string, regime: string | undefined, centreId: string) {
    const regimeNormalise = this.normaliserRegime(regime);
    const existant = await this.groupeModel
      .findOne({ centreId, serviceEntree: service, regimeEntree: regimeNormalise ?? null })
      .sort({ actif: -1 })
      .exec();
    if (existant) return existant;

    // Pas encore de groupe 1 pour ce bloc : on le crée
    const blocs = await this.blocsDuCentre(centreId);
    const bloc = blocs.find((b) => b.service === service && b.regime === regimeNormalise);
    if (!bloc) return null;
    const { groupe1 } = await this.groupesDuBloc(bloc.service, bloc.regime, bloc.prefixeNom, centreId);
    return groupe1;
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
   * Passage automatique au groupe suivant, pour un centre.
   *
   * Un candidat (inscription en cours) qui est depuis au moins N jours dans un
   * groupe réglé « passer dans X après N jours » passe dans le groupe X. Sa
   * date d'entrée dans X = date d'entrée dans l'ancien groupe + N jours : un
   * passage fait en retard ne décale donc pas les passages suivants.
   *
   * Lancé chaque nuit par GroupesCronService, ou à la demande par l'admin.
   * Renvoie le nombre de candidats déplacés.
   */
  async appliquerPassages(centreId: string): Promise<{ deplaces: number }> {
    const groupesAvecPassage = await this.groupeModel
      .find({
        centreId,
        groupeSuivantId: { $exists: true, $ne: null },
        joursAvantPassage: { $gt: 0 },
      })
      .exec();
    if (groupesAvecPassage.length === 0) {
      return { deplaces: 0 };
    }

    // Groupes suivants actifs : on ne fait pas entrer de candidats dans un
    // groupe désactivé (ils restent dans leur groupe actuel)
    const idsSuivants = groupesAvecPassage
      .map((g) => g.groupeSuivantId)
      .filter((id): id is Types.ObjectId => !!id);
    const suivantsActifs = await this.groupeModel
      .find({ centreId, _id: { $in: idsSuivants }, actif: true })
      .exec();
    const idsSuivantsActifs = new Set(suivantsActifs.map((g) => String(g._id)));

    let deplaces = 0;
    // Plusieurs tours : un candidat arrivé dans Soir 2 peut, s'il a assez de
    // retard, passer aussitôt dans Soir 3
    for (let tour = 0; tour < MAX_TOURS_DE_PASSAGE; tour++) {
      let deplacesCeTour = 0;

      for (const groupe of groupesAvecPassage) {
        const idSuivant = String(groupe.groupeSuivantId);
        if (!idsSuivantsActifs.has(idSuivant)) continue;

        const jours = groupe.joursAvantPassage as number;
        const seuil = new Date(Date.now() - jours * UN_JOUR_MS);

        const aDeplacer = await this.inscriptionModel
          .find({
            ...this.filtreEnCours(centreId),
            groupeId: groupe._id,
            dateEntreeGroupe: { $lte: seuil },
          })
          .select('_id dateEntreeGroupe')
          .exec();

        for (const inscription of aDeplacer) {
          const nouvelleDateEntree = new Date(
            (inscription.dateEntreeGroupe as Date).getTime() + jours * UN_JOUR_MS,
          );
          await this.inscriptionModel
            .updateOne(
              { _id: inscription._id, centreId, groupeId: groupe._id },
              { groupeId: groupe.groupeSuivantId, dateEntreeGroupe: nouvelleDateEntree },
            )
            .exec();
          deplacesCeTour++;
        }
      }

      deplaces += deplacesCeTour;
      if (deplacesCeTour === 0) break;
    }

    if (deplaces > 0) {
      this.logger.log(`Centre ${centreId} : ${deplaces} candidat(s) passé(s) au groupe suivant`);
    }
    return { deplaces };
  }
}