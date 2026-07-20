import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InscriptionsService } from './inscriptions.service';
import { CreateInscriptionDto } from './dto/create-inscription.dto';
import { UpdateInscriptionDto } from './dto/update-inscription.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inscriptions')
export class InscriptionsController {
  constructor(private readonly inscriptionsService: InscriptionsService) {}

  @Post()
  create(@Body() createInscriptionDto: CreateInscriptionDto) {
    return this.inscriptionsService.create(createInscriptionDto);
  }

  @ApiQuery({ name: 'nom', required: false })
  @ApiQuery({ name: 'service', required: false })
  @ApiQuery({ name: 'regime', required: false })
  @Get()
  findAll(
    @Query('nom') nom?: string,
    @Query('service') service?: string,
    @Query('regime') regime?: string,
  ) {
    return this.inscriptionsService.findAll({ nom, service, regime });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inscriptionsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateInscriptionDto: UpdateInscriptionDto) {
    return this.inscriptionsService.update(id, updateInscriptionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.inscriptionsService.remove(id);
  }
}