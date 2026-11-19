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
    // "" en prod, "staging/" en staging : les fichiers de test sont rangés à part
    this.prefixe = this.configService.get<string>('S3_KEY_PREFIX') ?? '';
    this.client = new S3Client({
      region: this.configService.get<string>('AWS_REGION') ?? 'eu-west-3',
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
      },
    });
  }

  /**
   * Envoie un fichier sur S3 (facture PDF, logo...).
   * Renvoie la clé S3 complète (préfixe inclus), ou null en cas d'échec.
   */
  async televerserFichier(
    cleRelative: string,
    contenu: Buffer,
    typeContenu: string,
  ): Promise<string | null> {
    const cle = `${this.prefixe}${cleRelative}`;
    if (!this.bucket) {
      this.logger.warn(`AWS_S3_BUCKET_NAME manquant : fichier "${cle}" non stocké`);
      return null;
    }
    try {
      await this.client.send(
        new PutObjectCommand({ Bucket: this.bucket, Key: cle, Body: contenu, ContentType: typeContenu }),
      );
      return cle;
    } catch (erreur) {
      this.logger.error(`Échec de l'envoi du fichier vers S3 : ${(erreur as Error).message}`);
      return null;
    }
  }

  /**
   * Récupère le contenu d'un fichier stocké sur S3 (ex : le logo, pour
   * l'imprimer dans le PDF du reçu). Renvoie null en cas d'échec.
   */
  async telechargerFichier(cle: string): Promise<Buffer | null> {
    if (!this.bucket) return null;
    try {
      const reponse = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: cle }));
      if (!reponse.Body) return null;
      const octets = await reponse.Body.transformToByteArray();
      return Buffer.from(octets);
    } catch (erreur) {
      this.logger.error(`Échec de la lecture du fichier S3 "${cle}" : ${(erreur as Error).message}`);
      return null;
    }
  }

  /** Lien temporaire (5 minutes) pour lire un fichier stocké sur S3 */
  async urlSignee(cle: string): Promise<string | null> {
    if (!this.bucket) return null;
    try {
      return await getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: cle }), {
        expiresIn: 300,
      });
    } catch (erreur) {
      this.logger.error(`Échec de génération du lien S3 : ${(erreur as Error).message}`);
      return null;
    }
  }

  /** Renvoie la clé S3 complète (préfixe inclus), ou null en cas d'échec */
  televerserFacture(cleRelative: string, contenu: Buffer): Promise<string | null> {
    return this.televerserFichier(cleRelative, contenu, 'application/pdf');
  }

  urlSigneeFacture(cle: string): Promise<string | null> {
    return this.urlSignee(cle);
  }
}