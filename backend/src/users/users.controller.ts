import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CentreId } from '../common/centre-id.decorator';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: "Créer un utilisateur (secrétariat ou admin) — réservé à l'administrateur" })
  @Post()
  create(@Body() createUserDto: CreateUserDto, @CentreId() centreId: string) {
    return this.usersService.create(createUserDto, centreId);
  }

  @ApiOperation({ summary: "Lister les utilisateurs du centre — réservé à l'administrateur" })
  @Get()
  findAll(@CentreId() centreId: string) {
    return this.usersService.findAll(centreId);
  }

  @ApiOperation({ summary: "Voir le détail d'un utilisateur — réservé à l'administrateur" })
  @Get(':id')
  findOne(@Param('id') id: string, @CentreId() centreId: string) {
    return this.usersService.findOne(id, centreId);
  }

  @ApiOperation({ summary: "Modifier un utilisateur — réservé à l'administrateur" })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CentreId() centreId: string,
  ) {
    return this.usersService.update(id, updateUserDto, centreId);
  }

  @ApiOperation({ summary: "Supprimer un utilisateur — réservé à l'administrateur" })
  @Delete(':id')
  remove(@Param('id') id: string, @CentreId() centreId: string) {
    return this.usersService.remove(id, centreId);
  }
}