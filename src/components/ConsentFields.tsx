import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/lib/i18n";
import { OPTIONAL_CONSENTS, REQUIRED_CONSENTS, type ConsentPurpose } from "@/lib/validation";

export function ConsentFields({ value, onChange, showRequired = true }: {
  value: Partial<Record<ConsentPurpose, boolean>>;
  onChange: (p: ConsentPurpose, v: boolean) => void;
  showRequired?: boolean;
}) {
  const { t } = useI18n();
  const list: ConsentPurpose[] = showRequired ? [...REQUIRED_CONSENTS, ...OPTIONAL_CONSENTS] : [...OPTIONAL_CONSENTS];
  return (
    <div className="space-y-3">
      {list.map((p) => (
        <label key={p} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm">
          <Checkbox checked={!!value[p]} onCheckedChange={(c) => onChange(p, c === true)} className="mt-0.5" />
          <span>{t(`consent.${p}` as const)}</span>
        </label>
      ))}
    </div>
  );
}
