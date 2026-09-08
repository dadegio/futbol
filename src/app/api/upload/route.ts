import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-auth";
import { apiErrorResponse } from "@/modules/core/api";
import { rateLimit } from "@/modules/core/security/rate-limit";
import { storeUploadFile } from "@/modules/media/application/media-storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json(
        { error: "Devi effettuare il login" },
        { status: 401 }
      );
    }

    const limited = rateLimit({
      key: `upload:image:${session.userId}`,
      limit: 80,
      windowMs: 60 * 60 * 1000,
      message: "Troppi upload. Riprova tra qualche minuto.",
    });
    if (limited) return limited;

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Nessun file" },
        { status: 400 }
      );
    }

    const stored = await storeUploadFile({
      file,
      target: { scope: "generic", folder: "uploads" },
      validation: {
        allowImages: true,
        allowVideos: false,
        imageLimitBytes: 5 * 1024 * 1024,
      },
    });

    return NextResponse.json({ url: stored.url, storageProvider: stored.storageProvider });
  } catch (error) {
    console.error("Errore upload:", error);
    return apiErrorResponse(error, "Errore upload");
  }
}
