import { Service, Regime, ModePaiement } from '../schemas/inscription.schema';

export class CreateInscriptionDto {
  candidatId!: string;
  service!: Service;
  regime?: Regime;
  dateDebutTest?: Date;
  modePaiement!: ModePaiement;
  montantNegocie?: number;
  montantPaye?: number;
  montantMobile?: number;
  montantEspeces?: number;
  facturePar!: string;
  reference?: string;
}