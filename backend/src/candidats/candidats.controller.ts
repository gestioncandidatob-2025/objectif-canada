import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CandidatsService } from './candidats.service';
import { CreateCandidatDto } from './dto/create-candidat.dto';
import { UpdateCandidatDto } from './dto/update-candidat.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('candidats')
export class CandidatsController {
  constructor(private readonly candidatsService: CandidatsService) {}

  @Post()
  create(@Body() createCandidatDto: CreateCandidatDto) {
    return this.candidatsService.create(createCandidatDto);
  }

  @Get()
  findAll() {
    return this.candidatsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.candidatsService.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCandidatDto: UpdateCandidatDto) {
    return this.candidatsService.update(id, updateCandidatDto);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.candidatsService.remove(id);
  }
}