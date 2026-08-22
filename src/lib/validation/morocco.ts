export function normalizeMoroccanPhone(value: string): string {
  const compact = value.replace(/[\s().-]/g, "");
  let local = compact;

  if (local.startsWith("00212")) {
    local = local.slice(5);
  } else if (local.startsWith("+212")) {
    local = local.slice(4);
  } else if (local.startsWith("0")) {
    local = local.slice(1);
  }

  if (!/^[5-7]\d{8}$/.test(local)) {
    throw new Error("Invalid Moroccan phone number");
  }

  return `+212${local}`;
}

export function normalizeCin(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s+/g, "").toUpperCase();
  return normalized ? normalized : null;
}

export function optionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
