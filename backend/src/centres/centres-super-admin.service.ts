import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Centre, CentreDocument } from './schemas/centre.schema';
import { User, UserDocument, Role } from '../users/schemas/user.schema';
import { Inscription, InscriptionDocument } from '../inscriptions/schemas/inscription.schema';
import { Candidat, CandidatDocument } from '../candidats/schemas/candidat.schema';
import { Tarif, TarifDocument } from '../tarifs/schemas/tarif.schema';
import { Historique, HistoriqueDocument } from '../historique/schemas/historique.schema';
import { UsersService } from '../users/users.service';
import { S3Service } from '../factures/s3.service';
import { UpdateCentreDto } from './dto/update-centre.dto';

/**
 * Opérations du super admin qui touchent à plusieurs collections :
 * liste enrichie, modification (dont l'email de l'admin), suppression.
 * Le super admin ne lit jamais le contenu des factures : seulement leur nombre.
 */
@Injectable()
export class CentresSuperAdminService {
  constructor(
    @InjectModel(Centre.name) private centreModel: Model<CentreDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Inscription.name) private inscriptionModel: Model<InscriptionDocument>,
    @InjectModel(Candidat.name) private candidatModel: Model<CandidatDocument>,
    @InjectModel(Tarif.name) private tarifModel: Model<TarifDocument>,
    @InjectModel(Historique.name) private historiqueModel: Model<HistoriqueDocument>,
    private usersService: UsersService,
    private s3Service: S3Service,
  ) {}

  /** Premier administrateur créé pour ce centre (celui créé avec le centre) */
  private adminPrincipal(centreId: string) {
    return this.userModel
      .findOne({ centreId, role: Role.ADMIN })
      .sort({ createdAt: 1 })
      .exec();
  }

  /** Liste des centres avec leur administrateur principal et leur nombre de factures */
  async lister() {
    const centres = await this.centreModel.find().sort({ createdAt: -1 }).lean().exec();
    return Promise.all(
      centres.map(async (centre) => {
        const centreId = String(centre._id);
        const [admin, nombreFactures, nombreUtilisateurs, logoUrl] = await Promise.all([
          this.adminPrincipal(centreId),
          this.inscriptionModel.countDocuments({ centreId }),
          this.userModel.countDocuments({ centreId }),
          // Logo du centre : lien temporaire vers S3 (null si pas de logo)
          centre.logoKey ? this.s3Service.urlSignee(centre.logoKey) : Promise.resolve(null),
        ]);
        return {
          ...centre,
          nombreFactures,
          nombreUtilisateurs,
          logoUrl,
          admin: admin
            ? { id: admin._id, nom: admin.nom, email: admin.email, emailVerifie: admin.emailVerifie }
            : null,
        };
      }),
    );
  }

  async modifier(id: string, dto: UpdateCentreDto) {
    const centre = await this.centreModel.findById(id).exec();
    if (!centre) {
      throw new NotFoundException('Centre introuvable');
    }

    if (dto.nom && dto.nom !== centre.nom) {
      if (await this.centreModel.exists({ nom: dto.nom, _id: { $ne: id } })) {
        throw new ConflictException('Un centre porte déjà ce nom');
      }
      centre.nom = dto.nom;
    }
    if (dto.ville !== undefined) centre.ville = dto.ville;
    if (dto.telephone !== undefined) centre.telephone = dto.telephone;
    await centre.save();

    // Correction de l'email de l'administrateur principal : il devra le
    // vérifier à nouveau avec le code reçu sur la nouvelle adresse.
    if (dto.adminEmail) {
      const email = dto.adminEmail.trim().toLowerCase();
      const admin = await this.adminPrincipal(id);
      if (!admin) {
        throw new NotFoundException("Ce centre n'a pas d'administrateur");
      }
      if (email !== admin.email) {
        if (await this.usersService.findByEmail(email)) {
          throw new ConflictException('Un utilisateur avec cet email existe déjà');
        }
        admin.email = email;
        admin.emailVerifie = false;
        await admin.save();
        await this.usersService.genererEtEnvoyerCodeVerification(admin);
      }
    }

    return centre;
  }

  /**
   * Supprime un centre et tout ce qui lui appartient. Refusé dès que le
   * centre a émis au moins une facture : les factures ne sont jamais
   * supprimées (dans ce cas, on suspend le centre).
   */
  async supprimer(id: string) {
    const centre = await this.centreModel.findById(id).exec();
    if (!centre) {
      throw new NotFoundException('Centre introuvable');
    }
    const nombreFactures = await this.inscriptionModel.countDocuments({ centreId: id });
    if (nombreFactures > 0) {
      throw new BadRequestException(
        `Ce centre a déjà ${nombreFactures} facture(s) : il ne peut pas être supprimé. Suspends-le à la place.`,
      );
    }

    await Promise.all([
      this.userModel.deleteMany({ centreId: id }),
      this.candidatModel.deleteMany({ centreId: id }),
      this.tarifModel.deleteMany({ centreId: id }),
      this.historiqueModel.deleteMany({ centreId: id }),
    ]);
    await this.centreModel.findByIdAndDelete(id).exec();
    return { message: `Centre « ${centre.nom} » supprimé` };
  }
}