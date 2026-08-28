import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Stockage des factures PDF sur AWS S3. Nécessite les variables
 * d'environnement AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
 * et AWS_S3_BUCKET_NAME.
 */
@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET_NAME') ?? '';
    this.client = new S3Client({
      region: this.configService.get<string>('AWS_REGION') ?? 'eu-west-3',
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
      },
    });
  }

  async televerserFacture(cle: string, contenu: Buffer): Promise<boolean> {
    if (!this.bucket) {
      this.logger.warn(
        `AWS_S3_BUCKET_NAME manquant dans le .env : facture "${cle}" non stockée sur AWS`,
      );
      return false;
    }
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: cle,
          Body: contenu,
          ContentType: 'application/pdf',
        }),
      );
      return true;
    } catch (erreur) {
      this.logger.error(`Échec de l'envoi de la facture vers S3 : ${(erreur as Error).message}`);
      return false;
    }
  }

  /** Génère un lien temporaire (5 minutes) pour consulter/télécharger une facture privée sur S3 */
  async urlSigneeFacture(cle: string): Promise<string | null> {
    if (!this.bucket) return null;
    try {
      const commande = new GetObjectCommand({ Bucket: this.bucket, Key: cle });
      return await getSignedUrl(this.client, commande, { expiresIn: 300 });
    } catch (erreur) {
      this.logger.error(`Échec de génération du lien de facture : ${(erreur as Error).message}`);
      return null;
    }
  }
}