import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.motDePasse);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) {
    return req.user;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout() {
    return { message: 'Déconnecté avec succès' };
  }
}