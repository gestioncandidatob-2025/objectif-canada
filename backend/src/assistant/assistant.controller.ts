import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CentreId } from '../common/centre-id.decorator';
import { AssistantService } from './assistant.service';
import { DiscussionDto } from './dto/discussion.dto';

// Assistant IA : réservé à l'administrateur du centre
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @ApiOperation({ summary: "L'assistant est-il configuré, et combien de questions reste-t-il aujourd'hui ?" })
  @Get('status')
  statut(@CentreId() centreId: string) {
    return this.assistantService.quota(centreId);
  }

  @ApiOperation({ summary: "Pose une question à l'assistant (lecture seule des données du centre)" })
  @Post('chat')
  @HttpCode(200)
  discuter(@CentreId() centreId: string, @Body() dto: DiscussionDto) {
    return this.assistantService.discuter(centreId, dto.messages, dto.langue ?? 'fr');
  }
}