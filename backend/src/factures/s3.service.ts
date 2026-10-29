import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly bucket: string;
  private readonly prefixe: string;
  private readonly client: S3Client;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET_NAME') ?? '';
    // "" en prod, "staging/" en staging : les factures de test sont rangées à part
    this.prefixe = this.configService.get<string>('S3_KEY_PREFIX') ?? '';
    this.client = new S3Client({
      region: this.configService.get<string>('AWS_REGION') ?? 'eu-west-3',
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
      },
    });
  }

  /** Renvoie la clé S3 complète (préfixe inclus), ou null en cas d'échec */
  async televerserFacture(cleRelative: string, contenu: Buffer): Promise<string | null> {
    const cle = `${this.prefixe}${cleRelative}`;
    if (!this.bucket) {
      this.logger.warn(`AWS_S3_BUCKET_NAME manquant : facture "${cle}" non stockée`);
      return null;
    }
    try {
      await this.client.send(
        new PutObjectCommand({ Bucket: this.bucket, Key: cle, Body: contenu, ContentType: 'application/pdf' }),
      );
      return cle;
    } catch (erreur) {
      this.logger.error(`Échec de l'envoi de la facture vers S3 : ${(erreur as Error).message}`);
      return null;
    }
  }

  async urlSigneeFacture(cle: string): Promise<string | null> {
    if (!this.bucket) return null;
    try {
      return await getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: cle }), { expiresIn: 300 });
    } catch (erreur) {
      this.logger.error(`Échec de génération du lien de facture : ${(erreur as Error).message}`);
      return null;
    }
  }
}