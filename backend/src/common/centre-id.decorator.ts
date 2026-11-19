import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Renvoie l'identifiant du centre de l'utilisateur connecté, lu dans son
 * jeton de connexion (jamais dans ce qu'envoie le navigateur).
 *
 * Utilisation dans un contrôleur :
 *   findAll(@CentreId() centreId: string) { ... }
 */
export const CentreId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  const centreId = req.user?.centreId;
  if (!centreId) {
    throw new ForbiddenException("Cette action nécessite d'être rattaché à un centre");
  }
  return String(centreId);
});