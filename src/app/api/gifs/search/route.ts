import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!q.trim()) {
      const trending = await fetchTrending();
      return NextResponse.json({ gifs: trending, total: trending.length });
    }

    const apiKey = process.env.GIPHY_API_KEY;
    if (!apiKey) {
      // Tentativo con GIPHY SDK free (senza chiave, alcune richieste sono limitate)
      return NextResponse.json(
        { error: "GIPHY_API_KEY non configurata. Aggiungila nel file .env" },
        { status: 500 }
      );
    }

    const url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=24&offset=${offset}&rating=g&lang=it`;

    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      console.error("GIPHY API error:", res.statusText);
      return NextResponse.json({ error: "Errore nella ricerca GIF" }, { status: 502 });
    }

    const data = await res.json();

    const gifs = (data.data || []).map((gif: any) => ({
      id: gif.id,
      url: gif.images.fixed_height.url,
      preview: gif.images.fixed_height_small.url,
      title: gif.title || "GIF",
      width: parseInt(gif.images.fixed_height.width),
      height: parseInt(gif.images.fixed_height.height),
      original: gif.images.original.url,
    }));

    return NextResponse.json({ gifs, total: data.pagination?.total_count || 0 });
  } catch (error) {
    console.error("GIF search error:", error);
    return NextResponse.json({ error: "Errore nella ricerca GIF" }, { status: 500 });
  }
}

async function fetchTrending() {
  try {
    const apiKey = process.env.GIPHY_API_KEY;
    if (!apiKey) return [];

    const url = `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=24&rating=g`;
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return [];

    const data = await res.json();
    return (data.data || []).map((gif: any) => ({
      id: gif.id,
      url: gif.images.fixed_height.url,
      preview: gif.images.fixed_height_small.url,
      title: gif.title || "GIF",
      width: parseInt(gif.images.fixed_height.width),
      height: parseInt(gif.images.fixed_height.height),
      original: gif.images.original.url,
    }));
  } catch {
    return [];
  }
}
