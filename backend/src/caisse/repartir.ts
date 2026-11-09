/**
 * Sépare un montant en espèces et en mobile, selon le mode de paiement.
 * Pour le mode mixte, on prend les montants saisis ; un éventuel écart va
 * dans les espèces.
 */
export function repartir(
  mode: string | undefined,
  montant: number,
  montantMobile?: number,
  montantEspeces?: number,
): { especes: number; mobile: number } {
  if (mode === 'orange_money' || mode === 'mobile_money') {
    return { especes: 0, mobile: montant };
  }
  if (mode === 'mobile_especes') {
    const mobile = Math.min(montantMobile ?? 0, montant);
    return { especes: montant - mobile, mobile };
  }
  return { especes: montant, mobile: 0 };
}