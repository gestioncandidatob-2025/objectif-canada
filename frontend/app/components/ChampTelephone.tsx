"use client";

/**
 * Champ de téléphone camerounais : la personne tape seulement ses 9 chiffres
 * (ex : 690000000). L'indicatif +237 est affiché devant, sauf avec
 * `sansIndicatif` (numéros des candidats).
 *
 * `value` et `onChange` travaillent avec les 9 chiffres seuls.
 */

/** "+237 690 00 00 00", "(+237) 690000000", "690 00 00 00" → "690000000" */
export function chiffresSansIndicatif(texte: string | null | undefined): string {
  let chiffres = String(texte ?? "").replace(/\D/g, "");
  if (chiffres.length > 9 && chiffres.startsWith("237")) chiffres = chiffres.slice(3);
  return chiffres.slice(0, 9);
}

/** "690000000" → "+237 690000000" (texte vide si aucun chiffre) */
export function avecIndicatif(chiffres: string): string {
  return chiffres ? `+237 ${chiffres}` : "";
}

export default function ChampTelephone({
  value,
  onChange,
  id,
  className = "",
  placeholder = "6 90 00 00 00",
  disabled,
  autoFocus,
  sansIndicatif = false,
}: {
  value: string;
  onChange: (chiffres: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  sansIndicatif?: boolean;
}) {
  return (
    <div
      className={
        "flex items-stretch overflow-hidden rounded-lg border border-ink/15 bg-white focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 " +
        (disabled ? "opacity-60 " : "") +
        className
      }
    >
      {!sansIndicatif && (
        <span className="flex select-none items-center border-r border-ink/10 bg-paper px-3 text-base font-medium text-ink-soft">
          +237
        </span>
      )}
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={value}
        onChange={(e) => onChange(chiffresSansIndicatif(e.target.value))}
        maxLength={12}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-base text-ink outline-none placeholder:text-ink-soft/60"
      />
    </div>
  );
}