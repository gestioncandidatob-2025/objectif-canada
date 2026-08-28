import { Injectable } from '@nestjs/common';
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

const LABEL_SERVICE: Record<string, string> = {
  tcf: 'TCF',
  tcf_2mois: 'TCF 2 mois',
  examen_blanc: 'Examen blanc',
  tcf_special: 'TCF SPECIAL',
};

const LABEL_PAIEMENT: Record<string, string> = {
  especes: 'Espèces',
  orange_money: 'Orange Money',
  mobile_money: 'Mobile Money',
  mobile_especes: 'Mobile + Espèces',
};

/**
 * Génère le PDF de la facture/reçu, au même format "ticket" que la page
 * /recu déjà existante, pour archivage sur AWS S3.
 */
@Injectable()
export class PdfService {
  genererFacturePdf(
    inscription: InscriptionPourFacture,
    candidat: CandidatPourFacture,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: [227, 620], margin: 16 });
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

      centre('Centre de formation TCF/TEF', 10);
      centre('NIU:M022517596119U', 8);
      centre('contact : (+237) 686 876 873', 8);
      centre('DLA-Bonamoussadi ancien impôt', 8);
      separateur();
      centre('REÇU DE PAIEMENT', 11, true);
      separateur();

      ligne('N° reçu:', inscription.numeroRecu);
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
      ligne('Test :', LABEL_SERVICE[inscription.service] ?? inscription.service);
      if (inscription.dateDebutTest) {
        ligne('Début du test :', new Date(inscription.dateDebutTest).toLocaleDateString('fr-FR'));
      }
      if (inscription.dateFin) {
        ligne('Fin du test :', new Date(inscription.dateFin).toLocaleDateString('fr-FR'));
      }
      separateur();

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(`Montant : ${inscription.montantTotal.toLocaleString('fr-FR')} FCFA`);
      doc.font('Helvetica').fontSize(9).text(`Payé : ${inscription.montantPaye.toLocaleString('fr-FR')} FCFA`);
      doc.text(`Reste : ${inscription.resteAPayer.toLocaleString('fr-FR')} FCFA`);
      ligne('Mode de paiement :', LABEL_PAIEMENT[inscription.modePaiement] ?? inscription.modePaiement);
      doc.text(`Facture établie par : ${inscription.facturePar}`);
      if (inscription.reference) {
        ligne('Référence :', inscription.reference);
      }
      separateur();

      centre("le goût des C2 c'est chez nous", 9);

      doc.end();
    });
  }
}