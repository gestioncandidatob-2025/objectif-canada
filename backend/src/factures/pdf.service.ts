import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';

interface CandidatPourFacture {
  nom: string;
  prenom: string;
  telephone: string;
}

interface InscriptionPourFacture {
  numeroRecu: string;
  dateInscription: Date;
  dateDebutTest?: Date;
  dateFin?: Date;
  service: string;
  regime?: string;
  montantTotal: number;
  montantPaye: number;
  resteAPayer: number;
  modePaiement: string;
  facturePar: string;
  reference?: string;
}

/** En-tête et bas du reçu : viennent des Paramètres du centre */
export interface CentrePourFacture {
  nom: string;
  niu?: string;
  rccm?: string;
  telephone?: string;
  adresse?: string;
  ville?: string;
  piedDePageRecu?: string;
  // Contenu de l'image du logo (PNG ou JPG), si le centre en a un
  logo?: Buffer;
}

// Libellés des anciens services (données existantes) ; tout autre service
// est affiché tel qu'il a été saisi dans la page Services
const LABEL_SERVICE: Record<string, string> = {
  tcf: 'TCF',
  tcf_2mois: 'TCF 2 mois',
  examen_blanc: 'Examen blanc',
  tcf_special: 'TCF SPECIAL',
};

const LABEL_PAIEMENT: Record<string, string> = {
  especes: 'Espèces',
  orange_money: 'Orange Money',
  mobile_money: 'MTN Mobile Money',
  mobile_especes: 'Mixte (Mobile + Espèces)',
};

// Montant avec des espaces normales entre les milliers ("65 000").
// toLocaleString('fr-FR') utilise une espace spéciale que la police du PDF
// ne sait pas dessiner (elle apparaissait comme "65 /000").
function formaterMontant(montant: number): string {
  return montant.toLocaleString('fr-FR').replace(/\s/g, ' ');
}

// Largeur du ticket (en points PDF) et taille maximale du logo
const LARGEUR_TICKET = 227;
const LARGEUR_LOGO = 120;
const HAUTEUR_LOGO = 50;

/**
 * Génère le PDF de la facture/reçu, au même format "ticket" que la page
 * /recu, pour archivage sur AWS S3.
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  genererFacturePdf(
    inscription: InscriptionPourFacture,
    candidat: CandidatPourFacture,
    centreFacture: CentrePourFacture,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: [LARGEUR_TICKET, 700], margin: 16 });
      const morceaux: Buffer[] = [];
      doc.on('data', (m) => morceaux.push(m));
      doc.on('end', () => resolve(Buffer.concat(morceaux)));
      doc.on('error', reject);

      const centre = (texte: string, taille = 9, gras = false) => {
        doc
          .font(gras ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(taille)
          .text(texte, { align: 'center' });
      };
      const ligne = (label: string, valeur: string) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(`${label} `, { continued: true })
          .font('Helvetica')
          .text(valeur);
      };
      const separateur = () => {
        doc.moveDown(0.2);
        centre('------------------------------------', 9);
        doc.moveDown(0.2);
      };

      // ---- En-tête : les informations du centre ----
      if (centreFacture.logo) {
        const margeGauche = doc.page.margins.left;
        const yLogo = doc.y;
        try {
          // Logo centré dans un cadre de LARGEUR_LOGO x HAUTEUR_LOGO
          doc.image(centreFacture.logo, (LARGEUR_TICKET - LARGEUR_LOGO) / 2, yLogo, {
            fit: [LARGEUR_LOGO, HAUTEUR_LOGO],
            align: 'center',
            valign: 'center',
          });
          // On place nous-mêmes le texte suivant SOUS le logo, et on remet la
          // position horizontale à la marge (sinon le texte se superpose au logo)
          doc.x = margeGauche;
          doc.y = yLogo + HAUTEUR_LOGO + 6;
        } catch (erreur) {
          // Image illisible : le reçu sort quand même, sans logo
          doc.x = margeGauche;
          doc.y = yLogo;
          this.logger.warn(`Logo illisible dans le PDF : ${(erreur as Error).message}`);
        }
      }

      centre(centreFacture.nom, 10, true);
      if (centreFacture.niu) centre(`NIU : ${centreFacture.niu}`, 8);
      if (centreFacture.rccm) centre(`RCCM : ${centreFacture.rccm}`, 8);
      if (centreFacture.telephone) centre(`Contact : ${centreFacture.telephone}`, 8);
      const adresseComplete = [centreFacture.adresse, centreFacture.ville].filter(Boolean).join(', ');
      if (adresseComplete) centre(adresseComplete, 8);

      separateur();
      centre('REÇU DE PAIEMENT', 11, true);
      separateur();

      // ---- Le reçu ----
      ligne('N° reçu :', inscription.numeroRecu);
      ligne('Date :', new Date(inscription.dateInscription).toLocaleDateString('fr-FR'));
      ligne(
        'Heure :',
        new Date(inscription.dateInscription).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      );
      separateur();

      doc.font('Helvetica-Bold').fontSize(9).text('Nom et Prénom :');
      doc.font('Helvetica').fontSize(9).text(`${candidat.prenom} ${candidat.nom}`);
      ligne('Téléphone :', candidat.telephone);
      if (inscription.regime) ligne('Régime :', inscription.regime);
      ligne('Service :', LABEL_SERVICE[inscription.service] ?? inscription.service);
      if (inscription.dateDebutTest) {
        ligne('Début :', new Date(inscription.dateDebutTest).toLocaleDateString('fr-FR'));
      }
      if (inscription.dateFin) {
        ligne('Fin :', new Date(inscription.dateFin).toLocaleDateString('fr-FR'));
      }
      separateur();

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(`Montant : ${formaterMontant(inscription.montantTotal)} FCFA`);
      doc.font('Helvetica').fontSize(9).text(`Payé : ${formaterMontant(inscription.montantPaye)} FCFA`);
      doc.text(`Reste : ${formaterMontant(inscription.resteAPayer)} FCFA`);
      ligne('Mode de paiement :', LABEL_PAIEMENT[inscription.modePaiement] ?? inscription.modePaiement);
      doc.text(`Facture établie par : ${inscription.facturePar}`);
      if (inscription.reference) {
        ligne('Référence :', inscription.reference);
      }

      // ---- Bas du reçu : texte libre du centre ----
      if (centreFacture.piedDePageRecu) {
        separateur();
        centre(centreFacture.piedDePageRecu, 9);
      }

      doc.end();
    });
  }
}