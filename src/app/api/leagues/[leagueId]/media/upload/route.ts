import { NextResponse } from "next/server";
import { getServerSession, isLeagueAdminSession, isCreatorSession } from "@/lib/server-auth";
import { apiErrorResponse } from "@/modules/core/api";
import { rateLimit } from "@/modules/core/security/rate-limit";
import { storeUploadFile } from "@/modules/media/application/media-storage";

export const runtime = "nodejs";

const IMAGE_LIMIT = 10 * 1024 * 1024;
const VIDEO_LIMIT = 75 * 1024 * 1024;

export async function POST(req: Request, ctx: { params: Promise<{ leagueId: string }> }) {
  try {
    const { leagueId } = await ctx.params;
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Devi effettuare il login" }, { status: 401 });
    }
    if (!isLeagueAdminSession(session, leagueId) && !isCreatorSession(session, leagueId)) {
      return NextResponse.json({ error: "Accesso riservato ai creator del torneo" }, { status: 403 });
    }

    const limited = rateLimit({
      key: `upload:media:${leagueId}:${session.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
      message: "Troppi upload media. Riprova tra qualche minuto.",
    });
    if (limited) return limited;

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nessun file" }, { status: 400 });
    }

    const stored = await storeUploadFile({
      file,
      target: {
        scope: "media",
        leagueId,
        folder: file.type.startsWith("video/") ? "videos" : "photos",
      },
      validation: {
        allowImages: true,
        allowVideos: true,
        imageLimitBytes: IMAGE_LIMIT,
        videoLimitBytes: VIDEO_LIMIT,
      },
    });

    return NextResponse.json(stored);
  } catch (error) {
    console.error("Errore upload media:", error);
    return apiErrorResponse(error, "Errore upload media");
  }
}
