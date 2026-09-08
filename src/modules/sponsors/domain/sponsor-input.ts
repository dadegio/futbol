export type SponsorInputError = { error: string };

export type SponsorCreateData = {
  name: string;
  category: string | null;
  description: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  contactName: string | null;
  sortOrder: number;
  active: boolean;
};

export type SponsorPatchData = Partial<SponsorCreateData>;

export function normalizeUrl(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("/")) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(raw)) return `https://${raw}`;
  return undefined;
}

export function normalizeInstagram(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw
    .replace(/^@/, "")
    .replace(/^instagram\.com\//i, "")
    .replace(/^www\.instagram\.com\//i, "")
    .split(/[/?#]/)[0];
  if (/^[a-zA-Z0-9._]{1,30}$/.test(handle)) return `https://instagram.com/${handle}`;
  return undefined;
}

export function normalizeText(value: unknown, max = 300) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

export function parseSponsorCreateInput(
  body: Record<string, unknown>
): { data: SponsorCreateData } | SponsorInputError {
  const name = String(body?.name ?? "").trim();
  if (!name) return { error: "Nome sponsor obbligatorio" };

  const websiteUrl = normalizeUrl(body.websiteUrl);
  if (websiteUrl === undefined) return { error: "Link sito non valido" };

  const instagramUrl = normalizeInstagram(body.instagramUrl);
  if (instagramUrl === undefined) return { error: "Link Instagram non valido" };

  const logoUrl = normalizeUrl(body.logoUrl);
  if (logoUrl === undefined) return { error: "URL logo non valido" };

  const sortOrder = Number(body.sortOrder ?? 0);
  if (!Number.isFinite(sortOrder)) return { error: "Ordine non valido" };

  const email = normalizeText(body.email, 180);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "Email non valida" };

  return {
    data: {
      name: name.slice(0, 120),
      category: normalizeText(body.category, 80),
      description: normalizeText(body.description, 600),
      logoUrl,
      websiteUrl,
      instagramUrl,
      phone: normalizeText(body.phone, 80),
      email,
      address: normalizeText(body.address, 240),
      contactName: normalizeText(body.contactName, 120),
      sortOrder: Math.max(0, Math.min(999, Math.round(sortOrder))),
      active: body.active !== false,
    },
  };
}

export function parseSponsorPatchInput(
  body: Record<string, unknown>
): { data: SponsorPatchData } | SponsorInputError {
  const data: SponsorPatchData = {};

  if (body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (!name) return { error: "Nome sponsor obbligatorio" };
    data.name = name.slice(0, 120);
  }

  for (const key of ["category", "description", "phone", "address", "contactName"] as const) {
    if (body[key] !== undefined) {
      const max = key === "description" ? 600 : key === "category" ? 80 : key === "phone" ? 80 : key === "contactName" ? 120 : 240;
      data[key] = normalizeText(body[key], max);
    }
  }

  if (body.logoUrl !== undefined) {
    const logoUrl = normalizeUrl(body.logoUrl);
    if (logoUrl === undefined) return { error: "URL logo non valido" };
    data.logoUrl = logoUrl;
  }

  if (body.websiteUrl !== undefined) {
    const websiteUrl = normalizeUrl(body.websiteUrl);
    if (websiteUrl === undefined) return { error: "Link sito non valido" };
    data.websiteUrl = websiteUrl;
  }

  if (body.instagramUrl !== undefined) {
    const instagramUrl = normalizeInstagram(body.instagramUrl);
    if (instagramUrl === undefined) return { error: "Link Instagram non valido" };
    data.instagramUrl = instagramUrl;
  }

  if (body.email !== undefined) {
    const email = normalizeText(body.email, 180);
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "Email non valida" };
    data.email = email;
  }

  if (body.sortOrder !== undefined) {
    const sortOrder = Number(body.sortOrder);
    if (!Number.isFinite(sortOrder)) return { error: "Ordine non valido" };
    data.sortOrder = Math.max(0, Math.min(999, Math.round(sortOrder)));
  }

  if (body.active !== undefined) data.active = body.active === true;

  return { data };
}
