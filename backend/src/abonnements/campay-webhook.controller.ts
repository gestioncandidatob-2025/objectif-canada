import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AbonnementsService } from './abonnements.service';

/**
 * Adresse appelée par CamPay quand un paiement réussit ou échoue.
 * Pas de connexion ici (c'est CamPay qui appelle, pas un utilisateur) :
 * la notification est vérifiée par sa signature, puis l'état du paiement
 * est redemandé directement à CamPay avant de prolonger un abonnement.
 *
 * Adresse à donner à CamPay : https://<backend>/subscription/webhook
 * (CamPay peut l'appeler en GET ou en POST, les deux sont acceptés)
 */
@ApiExcludeController()
@Controller('subscription/webhook')
export class CampayWebhookController {
  constructor(private readonly abonnementsService: AbonnementsService) {}

  @Get()
  recevoirGet(@Query() donnees: Record<string, unknown>) {
    return this.abonnementsService.traiterNotification(donnees);
  }

  @Post()
  @HttpCode(200)
  recevoirPost(@Body() corps: Record<string, unknown>, @Query() donnees: Record<string, unknown>) {
    return this.abonnementsService.traiterNotification({ ...donnees, ...(corps ?? {}) });
  }
}