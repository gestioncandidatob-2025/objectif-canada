import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { Paiement, PaiementDocument } from '../caisse/schemas/paiement.schema';
import { Role, User, UserDocument } from '../users/schemas/user.schema';
import { MailService } from '../mail/mail.service';
import { CentresService } from '../centres/centres.service';
import {
  StatutVerification,
  VerificationCaisse,
  VerificationCaisseDocument,
} from './schemas/verification-caisse.schema';
import { ActionVerification } from './dto/verification-caisse.dto';

// Le Cameroun est à UTC+1 toute l'année : une journée de caisse va de minuit
// à minuit, heure de Douala (mêmes règles que le point de caisse).
const DECALAGE_MS = 60 * 60 * 1000;
const UN_JOUR_MS = 24 * 60 * 60 * 1000;

// Les boutons de l'email marchent pendant 7 jours. Ensuite, l'administrateur
// retrouve la journée sur son Accueil.
const DUREE_LIEN_MS = 7 * UN_JOUR_MS;

const STATUT_DE_L_ACTION: Record<ActionVerification, StatutVerification> = {
  confirmer: StatutVerification.CONFIRMEE,
  verifier: StatutVerification.A_VERIFIER,
  signaler: StatutVerification.SIGNALEE,
};

/** "2026-11-18" : le jour (à Douala) d'un instant donné */
export function jourDouala(instant: Date): string {
  return new Date(instant.getTime() + DECALAGE_MS).toISOString().slice(0, 10);
}

/** La veille (à Douala) */
export function jourDHier(maintenant = new Date()): string {
  return jourDouala(new Date(maintenant.getTime() - UN_JOUR_MS));
}

/** Début et fin d'un jour de Douala, en heure du serveur */
function bornesDuJour(jour: string) {
  const debut = new Date(new Date(`${jour}T00:00:00.000Z`).getTime() - DECALAGE_MS);
  return { debut, fin: new Date(debut.getTime() + UN_JOUR_MS) };
}

/** "mercredi 18 novembre" */
function jourLisible(jour: string) {
  return new Date(`${jour}T12:00:00.000Z`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

const montant = (valeur: number) => `${valeur.toLocaleString('fr-FR')} F`;

/** Les noms et messages tapés par les utilisateurs sont insérés dans un email : on les neutralise */
function echapper(texte: string) {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type CaisseDuJour = {
  _id: Types.ObjectId;
  nom: string;
  total: number;
  especes: number;
  mobile: number;
  nombre: number;
};

@Injectable()
export class VerificationsCaisseService {
  private readonly logger = new Logger(VerificationsCaisseService.name);

  constructor(
    @InjectModel(VerificationCaisse.name)
    private verificationModel: Model<VerificationCaisseDocument>,
    @InjectModel(Paiement.name) private paiementModel: Model<PaiementDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private mailService: MailService,
    private centresService: CentresService,
    private config: ConfigService,
  ) {}

  // ---------- Chaque matin : la caisse d'hier ----------

  /** Caisse de chaque personne pour un jour (les anciens noms sans compte ne sont pas vérifiés) */
  private async caissesDuJour(centreId: string, jour: string, encaisseParId?: Types.ObjectId) {
    const { debut, fin } = bornesDuJour(jour);
    return this.paiementModel
      .aggregate<CaisseDuJour>([
        {
          $match: {
            centreId: new Types.ObjectId(centreId),
            date: { $gte: debut, $lt: fin },
            encaisseParId: encaisseParId ?? { $ne: null },
            // L'argent reçu avec CamPay n'est dans les mains de personne : déjà confirmé par CamPay
            modePaiement: { $ne: 'campay' },
          },
        },
        {
          $group: {
            _id: '$encaisseParId',
            nom: { $last: '$encaisseParNom' },
            total: { $sum: '$montant' },
            especes: { $sum: '$especes' },
            mobile: { $sum: '$mobile' },
            nombre: { $sum: 1 },
          },
        },
        { $sort: { nom: 1 } },
      ])
      .exec();
  }

  /**
   * Crée la vérification de chaque personne qui a encaissé ce jour-là et
   * envoie un seul email aux administrateurs. Rien n'est envoyé si personne
   * n'a encaissé. Une journée déjà envoyée ne repart pas une deuxième fois.
   * Renvoie le nombre de caisses envoyées.
   */
  async envoyerLaCaisseDuJour(centreId: string, jour: string): Promise<number> {
    const caisses = (await this.caissesDuJour(centreId, jour)).filter((c) => c.total !== 0);
    if (caisses.length === 0) return 0;

    const nouvelles: VerificationCaisseDocument[] = [];
    for (const caisse of caisses) {
      const existe = await this.verificationModel
        .exists({ centreId, jour, encaisseParId: caisse._id })
        .exec();
      if (existe) continue;

      nouvelles.push(
        await this.verificationModel.create({
          centreId,
          jour,
          encaisseParId: caisse._id,
          encaisseParNom: caisse.nom,
          total: caisse.total,
          especes: caisse.especes,
          mobile: caisse.mobile,
          nombrePaiements: caisse.nombre,
          jeton: randomBytes(24).toString('hex'),
          jetonExpireLe: new Date(Date.now() + DUREE_LIEN_MS),
        }),
      );
    }
    if (nouvelles.length === 0) return 0;

    const emails = await this.emailsAdmins(centreId);
    const centre = await this.centresService.trouverParId(centreId);
    const site = this.urlDuSite();

    // Hors production : les liens sont aussi écrits dans le terminal, pour tester sans email
    if (this.config.get<string>('APP_ENV') !== 'production') {
      for (const v of nouvelles) {
        this.logger.log(`Caisse de ${v.encaisseParNom} (${jour}) : ${site}/verification-caisse?t=${v.jeton}&a=confirmer`);
      }
    }

    if (emails.length > 0) {
      await this.mailService.envoyer({
        to: emails,
        subject: `Caisse d'hier (${jourLisible(jour)}) — ${centre.nom}`,
        htmlContent: this.emailDeLaCaisse(jour, nouvelles, site),
      });
    }
    return nouvelles.length;
  }

  /** Un email court : une ligne par personne, son total et les 3 boutons */
  private emailDeLaCaisse(jour: string, verifications: VerificationCaisseDocument[], site: string) {
    const bouton = (jeton: string, action: ActionVerification, texte: string, couleur: string) =>
      `<a href="${site}/verification-caisse?t=${jeton}&a=${action}" ` +
      `style="display:inline-block;margin:4px 6px 4px 0;padding:9px 14px;border-radius:8px;` +
      `background:${couleur};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px">${texte}</a>`;

    const lignes = verifications
      .map(
        (v) => `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eeeeee">
            <p style="margin:0 0 6px;font-size:16px"><strong>${echapper(v.encaisseParNom)}</strong> : ${montant(v.total)}</p>
            ${bouton(v.jeton, 'confirmer', 'Je confirme', '#1f6f50')}
            ${bouton(v.jeton, 'verifier', 'À vérifier', '#b7791f')}
            ${bouton(v.jeton, 'signaler', 'À signaler', '#c0392b')}
          </td>
        </tr>`,
      )
      .join('');

    return `
      <div style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:560px">
        <p style="font-size:16px;margin:0 0 4px">Caisse d'hier — <strong>${jourLisible(jour)}</strong></p>
        <table style="width:100%;border-collapse:collapse">${lignes}</table>
        <p style="font-size:13px;color:#666666;margin-top:16px">
          Un clic suffit. Ces caisses sont aussi sur ton Accueil dans l'application.
        </p>
      </div>`;
  }

  // ---------- Clic sur un bouton de l'email (sans connexion) ----------

  async actionDepuisEmail(jeton: string, action: ActionVerification) {
    const verification = await this.verificationModel
      .findOne({ jeton })
      .setOptions({ sansCentre: true })
      .exec();
    if (!verification) {
      throw new NotFoundException('Ce lien ne correspond à aucune caisse.');
    }
    if (verification.jetonExpireLe < new Date()) {
      throw new BadRequestException(
        "Ce lien a expiré. Retrouve cette caisse sur ton Accueil dans l'application.",
      );
    }

    verification.statut = STATUT_DE_L_ACTION[action];
    verification.decisionLe = new Date();
    verification.decisionPar = 'Email';
    await verification.save();

    const centre = await this.centresService.trouverParId(String(verification.centreId));
    return {
      centre: centre.nom,
      personne: verification.encaisseParNom,
      jour: verification.jour,
      total: verification.total,
      statut: verification.statut,
    };
  }

  // ---------- Accueil de l'administrateur ----------

  /**
   * Les journées qui ne sont pas encore confirmées, de la plus récente à la
   * plus ancienne, avec le total actuel de la caisse pour repérer une
   * modification faite après l'email.
   */
  async aSuivre(centreId: string) {
    const verifications = await this.verificationModel
      .find({ centreId, statut: { $ne: StatutVerification.CONFIRMEE } })
      .sort({ jour: -1, encaisseParNom: 1 })
      .limit(100)
      .exec();

    return Promise.all(
      verifications.map(async (v) => {
        const [actuelle] = await this.caissesDuJour(centreId, v.jour, v.encaisseParId);
        const totalActuel = actuelle?.total ?? 0;
        const derniere = v.messages[v.messages.length - 1];
        return {
          id: String(v._id),
          jour: v.jour,
          personne: v.encaisseParNom,
          total: v.total,
          especes: v.especes,
          mobile: v.mobile,
          nombrePaiements: v.nombrePaiements,
          statut: v.statut,
          totalActuel,
          modifie: totalActuel !== v.total,
          messages: v.messages,
          // L'administrateur a posé une question et attend la réponse
          reponseAttendue: derniere?.auteur === 'admin',
        };
      }),
    );
  }

  /** Choix de l'administrateur depuis l'application */
  async changerStatut(centreId: string, id: string, action: ActionVerification, adminId: string) {
    const verification = await this.trouver(centreId, id);
    verification.statut = STATUT_DE_L_ACTION[action];
    verification.decisionLe = new Date();
    verification.decisionPar = await this.nomUtilisateur(centreId, adminId);
    await verification.save();
    return { id: String(verification._id), statut: verification.statut };
  }

  // ---------- Questions et réponses ----------

  /**
   * - L'administrateur pose une question à la personne qui a encaissé.
   * - Cette personne répond, seulement si une question attend sa réponse.
   * Chaque message part aussi par email à l'autre côté.
   */
  async envoyerMessage(
    centreId: string,
    id: string,
    utilisateur: { userId: string; role: string },
    texte: string,
  ) {
    const verification = await this.trouver(centreId, id);
    const propre = texte.trim();
    if (!propre) throw new BadRequestException('Le message est vide');

    const nom = await this.nomUtilisateur(centreId, utilisateur.userId);
    const estAdmin = utilisateur.role === Role.ADMIN;
    const site = this.urlDuSite();
    const titreJour = `${jourLisible(verification.jour)} (${montant(verification.total)})`;

    if (estAdmin) {
      verification.messages.push({
        auteur: 'admin',
        auteurId: new Types.ObjectId(utilisateur.userId),
        auteurNom: nom,
        texte: propre,
        date: new Date(),
      });
      await verification.save();

      const destinataire = await this.userModel
        .findOne({ _id: verification.encaisseParId, centreId })
        .select('email')
        .exec();
      if (destinataire?.email) {
        await this.mailService.envoyer({
          to: destinataire.email,
          subject: `Question sur ta caisse du ${jourLisible(verification.jour)}`,
          htmlContent: `
            <div style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:560px">
              <p>${echapper(nom)} a une question sur ta caisse du <strong>${titreJour}</strong> :</p>
              <blockquote style="margin:12px 0;padding:10px 14px;background:#f5f5f0;border-left:3px solid #1f6f50">${echapper(propre)}</blockquote>
              <p><a href="${site}/bienvenue">Réponds depuis ton Accueil dans l'application</a>.</p>
            </div>`,
        });
      }
    } else {
      // Seule la personne qui a encaissé peut répondre, et seulement à une question posée
      if (String(verification.encaisseParId) !== utilisateur.userId) {
        throw new ForbiddenException("Cette caisse n'est pas la tienne.");
      }
      const derniere = verification.messages[verification.messages.length - 1];
      if (derniere?.auteur !== 'admin') {
        throw new BadRequestException("Aucune question n'attend ta réponse.");
      }
      verification.messages.push({
        auteur: 'caissier',
        auteurId: new Types.ObjectId(utilisateur.userId),
        auteurNom: nom,
        texte: propre,
        date: new Date(),
      });
      await verification.save();

      const emails = await this.emailsAdmins(centreId);
      if (emails.length > 0) {
        await this.mailService.envoyer({
          to: emails,
          subject: `${nom} a répondu — caisse du ${jourLisible(verification.jour)}`,
          htmlContent: `
            <div style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:560px">
              <p><strong>${echapper(nom)}</strong> a répondu au sujet de sa caisse du <strong>${titreJour}</strong> :</p>
              <blockquote style="margin:12px 0;padding:10px 14px;background:#f5f5f0;border-left:3px solid #1f6f50">${echapper(propre)}</blockquote>
              <p><a href="${site}/bienvenue">Voir sur ton Accueil</a>.</p>
            </div>`,
        });
      }
    }

    return { id: String(verification._id), messages: verification.messages };
  }

  /**
   * Accueil de la personne qui a encaissé : seulement les questions qui
   * attendent sa réponse. Elle ne voit pas le statut choisi par l'administrateur.
   */
  async mesQuestions(centreId: string, userId: string) {
    const verifications = await this.verificationModel
      .find({ centreId, encaisseParId: new Types.ObjectId(userId), 'messages.0': { $exists: true } })
      .sort({ jour: -1 })
      .limit(50)
      .exec();

    return verifications
      .filter((v) => v.messages[v.messages.length - 1]?.auteur === 'admin')
      .map((v) => ({
        id: String(v._id),
        jour: v.jour,
        total: v.total,
        messages: v.messages,
      }));
  }

  // ---------- Outils ----------

  private async trouver(centreId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Caisse introuvable');
    const verification = await this.verificationModel.findOne({ _id: id, centreId }).exec();
    if (!verification) throw new NotFoundException('Caisse introuvable');
    return verification;
  }

  private async nomUtilisateur(centreId: string, userId: string) {
    const user = await this.userModel.findOne({ _id: userId, centreId }).select('nom').exec();
    return user?.nom ?? 'Administrateur';
  }

  private async emailsAdmins(centreId: string) {
    const admins = await this.userModel.find({ centreId, role: Role.ADMIN }).select('email').exec();
    return admins.map((u) => u.email).filter(Boolean);
  }

  /** Adresse du site, pour les liens des emails */
  private urlDuSite() {
    const configuree = this.config.get<string>('FRONTEND_URL');
    if (configuree) return configuree.replace(/\/+$/, '');
    const premiereOrigine = (this.config.get<string>('CORS_ORIGINS') ?? '').split(',')[0]?.trim();
    return (premiereOrigine || 'http://localhost:3001').replace(/\/+$/, '');
  }
}