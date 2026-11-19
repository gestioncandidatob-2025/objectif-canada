import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Les trois choix de l'administrateur */
export const ACTIONS_VERIFICATION = ['confirmer', 'verifier', 'signaler'] as const;
export type ActionVerification = (typeof ACTIONS_VERIFICATION)[number];

/** Clic sur un bouton de l'email (sans connexion, grâce au lien secret) */
export class ActionEmailDto {
  @ApiProperty({ description: "Lien secret reçu dans l'email" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  token!: string;

  @ApiProperty({ enum: ACTIONS_VERIFICATION })
  @IsIn(ACTIONS_VERIFICATION, { message: 'Choix invalide' })
  action!: ActionVerification;
}

/** Choix fait depuis l'application (Accueil de l'administrateur) */
export class ChangerStatutDto {
  @ApiProperty({ enum: ACTIONS_VERIFICATION })
  @IsIn(ACTIONS_VERIFICATION, { message: 'Choix invalide' })
  action!: ActionVerification;
}

/** Question de l'administrateur, ou réponse de la personne concernée */
export class EnvoyerMessageDto {
  @ApiProperty({ example: 'Pourquoi le paiement de Kamga est en espèces ?' })
  @IsString()
  @IsNotEmpty({ message: 'Le message est vide' })
  @MaxLength(1000, { message: 'Le message est trop long (1000 caractères maximum)' })
  texte!: string;
}