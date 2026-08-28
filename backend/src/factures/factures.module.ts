import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { S3Service } from './s3.service';

@Module({
  providers: [PdfService, S3Service],
  exports: [PdfService, S3Service],
})
export class FacturesModule {}