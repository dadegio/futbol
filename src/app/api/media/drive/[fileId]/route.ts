import { apiErrorResponse } from "@/modules/core/api";
import { fetchGoogleDriveMedia } from "@/modules/media/application/google-drive-storage";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await ctx.params;
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) {
      return new Response("File non valido", { status: 400 });
    }

    const upstream = await fetchGoogleDriveMedia(fileId, req.headers.get("range"));
    const headers = new Headers();
    for (const name of [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified",
    ]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    headers.set("Content-Disposition", "inline");

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    return apiErrorResponse(error, "Errore lettura media Drive");
  }
}
