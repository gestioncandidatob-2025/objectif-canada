import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Se connecter avec email et mot de passe, renvoie un jeton JWT' })
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.motDePasse);
  }

  @ApiOperation({ summary: "Renvoie les infos de l'utilisateur actuellement connecté" })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) {
    return req.user;
  }

  @ApiOperation({ summary: 'Déconnexion (le front-end doit supprimer le jeton stocké)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout() {
    return { message: 'Déconnecté avec succès' };
  }

  @ApiOperation({ summary: "Vérifier l'email avec le code à 6 chiffres reçu par email" })
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifierEmail(dto.email, dto.code);
  }

  @ApiOperation({ summary: "Renvoyer un nouveau code de vérification d'email" })
  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.renvoyerCodeVerification(dto.email);
  }

  @ApiOperation({ summary: 'Demander un code de réinitialisation de mot de passe par email' })
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.demanderReinitialisationMotDePasse(dto.email);
  }

  @ApiOperation({ summary: 'Réinitialiser le mot de passe avec le code reçu par email' })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.reinitialiserMotDePasse(
      dto.email,
      dto.code,
      dto.nouveauMotDePasse,
    );
  }
}