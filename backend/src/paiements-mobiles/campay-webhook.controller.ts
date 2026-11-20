import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AbonnementsService } from '../abonnements/abonnements.service';
import { PaiementsMobilesService } from './paiements-mobiles.service';

/**
 * Adresse appelée par CamPay quand une transaction réussit ou échoue.
 * Pas de connexion ici (c'est CamPay qui appelle, pas un utilisateur) :
 * la notification est vérifiée par sa signature, puis l'état de la
 * transaction est redemandé directement à CamPay.
 *
 * Une seule adresse pour tout le compte CamPay de HREFF :
 * - les abonnements des centres,
 * - les paiements des candidats et les retraits des centres.
 *
 * Adresse à donner à CamPay : https://<backend>/subscription/webhook
 * (CamPay peut l'appeler en GET ou en POST, les deux sont acceptés)
 */
@ApiExcludeController()
@Controller('subscription/webhook')
export class CampayWebhookController {
  constructor(
    private readonly abonnementsService: AbonnementsService,
    private readonly paiementsMobilesService: PaiementsMobilesService,
  ) {}

  @Get()
  recevoirGet(@Query() donnees: Record<string, unknown>) {
    return this.traiter(donnees);
  }

  @Post()
  @HttpCode(200)
  recevoirPost(@Body() corps: Record<string, unknown>, @Query() donnees: Record<string, unknown>) {
    return this.traiter({ ...donnees, ...(corps ?? {}) });
  }

  private async traiter(donnees: Record<string, unknown>) {
    // La signature est vérifiée par le service des abonnements
    const abonnement = await this.abonnementsService.traiterNotification(donnees);
    if (abonnement.recu) return abonnement;

    // Pas un abonnement : paiement d'un candidat ou retrait d'un centre
    const signature = typeof donnees.signature === 'string' ? donnees.signature : undefined;
    if (!this.paiementsMobilesService.signatureValide(signature)) return { recu: false };
    const recu = await this.paiementsMobilesService.traiterNotification(donnees);
    return { recu };
  }
}