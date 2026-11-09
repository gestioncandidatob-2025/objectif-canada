import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Candidat, CandidatDocument } from '../candidats/schemas/candidat.schema';
import { Inscription, InscriptionDocument } from '../inscriptions/schemas/inscription.schema';

// Nombre maximum de résultats par catégorie
const LIMITE = 10;

// Chaque lettre accepte aussi ses versions accentuées : "eric" trouve "Éric"
const VARIANTES: Record<string, string> = {
  a: 'aàâäá',
  c: 'cç',
  e: 'eéèêë',
  i: 'iîïí',
  o: 'oôöó',
  u: 'uùûüú',
  y: 'yÿ',
};

/** Échappe les caractères spéciaux des expressions régulières */
function echapper(texte: string) {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Retire les accents : "Éric" → "eric" */
function sansAccents(texte: string) {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Expression qui trouve le texte, sans tenir compte des accents ni des majuscules */
function regexTexte(texte: string) {
  const motif = [...sansAccents(texte)]
    .map((lettre) => (VARIANTES[lettre] ? `[${VARIANTES[lettre]}]` : echapper(lettre)))
    .join('');
  return new RegExp(motif, 'i');
}

/**
 * Expression qui trouve un numéro de téléphone quelle que soit la façon dont il
 * a été saisi : "690 00" trouve "+237 690 000 000" ou "690000000".
 */
function regexTelephone(chiffres: string) {
  // "237" au début est l'indicatif du Cameroun : on cherche sans lui
  const sansIndicatif = chiffres.length > 9 && chiffres.startsWith('237') ? chiffres.slice(3) : chiffres;
  return new RegExp([...sansIndicatif].join('\\D*'));
}

@Injectable()
export class RechercheService {
  constructor(
    @InjectModel(Candidat.name) private candidatModel: Model<CandidatDocument>,
    @InjectModel(Inscription.name) private inscriptionModel: Model<InscriptionDocument>,
  ) {}

  /**
   * Recherche globale dans le centre : candidats (nom, prénom, téléphone) et
   * factures (numéro de reçu, ou factures des candidats trouvés).
   */
  async rechercher(centreId: string, q: string) {
    const texte = q.trim();
    if (texte.length < 2) {
      return { candidats: [], factures: [] };
    }

    const chiffres = texte.replace(/\D/g, '');
    const estSurtoutDesChiffres = chiffres.length >= 3 && chiffres.length >= texte.replace(/\s/g, '').length - 1;

    // ---- Candidats ----
    const conditionsCandidat: Record<string, unknown>[] = [];
    if (estSurtoutDesChiffres) {
      conditionsCandidat.push({ telephone: regexTelephone(chiffres) });
    } else {
      // Chaque mot doit se retrouver dans le nom ou le prénom ("eric mba" trouve "MBA Éric")
      const mots = texte.split(/\s+/).filter(Boolean);
      conditionsCandidat.push({
        $and: mots.map((mot) => ({
          $or: [{ nom: regexTexte(mot) }, { prenom: regexTexte(mot) }],
        })),
      });
    }

    const candidats = await this.candidatModel
      .find({ centreId, $or: conditionsCandidat })
      .sort({ createdAt: -1 })
      .limit(LIMITE)
      .exec();

    // ---- Factures : par numéro de reçu, ou celles des candidats trouvés ----
    const conditionsFacture: Record<string, unknown>[] = [];
    if (chiffres.length >= 3) {
      conditionsFacture.push({ numeroRecu: new RegExp(echapper(chiffres)) });
    }
    if (candidats.length > 0) {
      conditionsFacture.push({ candidatId: { $in: candidats.map((c) => c._id as Types.ObjectId) } });
    }

    const factures =
      conditionsFacture.length === 0
        ? []
        : await this.inscriptionModel
            .find({ centreId, $or: conditionsFacture })
            .sort({ dateInscription: -1 })
            .limit(LIMITE)
            .populate({ path: 'candidatId', match: { centreId } })
            .exec();

    return {
      candidats: candidats.map((c) => ({
        id: String(c._id),
        nom: c.nom,
        prenom: c.prenom,
        telephone: c.telephone,
      })),
      factures: factures.map((f) => {
        const candidat = f.candidatId as unknown as CandidatDocument | null;
        return {
          id: String(f._id),
          numeroRecu: f.numeroRecu,
          candidatNom: candidat ? `${candidat.nom} ${candidat.prenom}` : '',
          service: f.service,
          dateInscription: f.dateInscription,
          montantTotal: f.montantTotal,
          resteAPayer: f.resteAPayer,
        };
      }),
    };
  }
}