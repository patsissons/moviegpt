import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TMDB_API_KEY } from '$env/static/private';
import sharp from 'sharp';
import satori from 'satori';
import { html } from 'satori-html';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

type CastMember = {
  id: number;
  name: string;
  character: string;
  profile_path: string;
};

export const GET: RequestHandler = async ({ params, url }) => {
  const { id } = params;
  const castParam = url.searchParams.get('cast');

  try {
    const inter400 = await fetch("https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff").then(res => res.arrayBuffer());
    const inter700 = await fetch("https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff").then(res => res.arrayBuffer());

    // Fetch movie details and cast info
    const [movieResponse, creditsResponse] = await Promise.all([
      fetch(`${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}&language=en-US`),
      fetch(`${TMDB_BASE_URL}/movie/${id}/credits?api_key=${TMDB_API_KEY}&language=en-US`)
    ]);

    if (!movieResponse.ok || !creditsResponse.ok) {
      throw error(404, 'Movie not found');
    }

    const [movieData, creditsData] = await Promise.all([
      movieResponse.json(),
      creditsResponse.json()
    ]);

    // Get selected cast names if any
    let selectedCastNames: string[] = [];
    if (castParam) {
      const castIds = castParam.split(',').map(Number);
      selectedCastNames = creditsData.cast
        .filter((member: CastMember) => castIds.includes(member.id))
        .map((member: CastMember) => member.name);
    }

    // Format runtime
    const hours = Math.floor(movieData.runtime / 60);
    const minutes = movieData.runtime % 60;
    const runtime = `${hours}h ${minutes}m`;

    const castNames = selectedCastNames.length > 0 ? selectedCastNames.join(', ') : '';

    // Create the overlay HTML
    const markup = html`
      <div style="display: flex; flex-direction: column; width: 1200px; height: 630px; background: linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.6) 100%);">
        <div style="display: flex; flex-direction: column; padding: 60px; flex: 1;">
          <h1 style="color: white; font-size: 64px; font-weight: bold; margin: 0; line-height: 1.2;">
            ${movieData.title}
          </h1>
          <div style="display: flex; gap: 16px; margin-top: 16px;">
            <span style="color: white; font-size: 24px;">
              ${new Date(movieData.release_date).getFullYear()}
            </span>
            <span style="color: #FCD34D; font-size: 24px;">
              ${movieData.vote_average.toFixed(1)}/10
            </span>
            <span style="color: white; font-size: 24px;">
              ${runtime}
            </span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 16px; padding: 20px 60px; background: linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.6) 100%);">
          <div style="display: flex;">
            <span style="color: white; font-size: 32px; font-weight: bold;">MovieGPT</span>
          </div>
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex: 1;">
            <p style="color: #9CA3AF; font-size: 20px; text-align: center;">${castNames ? 'movies with' : 'find related movies'}</p>
            <p style="color: white; font-size: 24px;">
              ${castNames}
            </p>
          </div>
        </div>
      </div>
    `;

    // Generate SVG using satori
    const svg = await satori(markup, {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Inter',
          data: inter400,
          weight: 400,
          style: 'normal',
        },
        {
          name: 'Inter',
          data: inter700,
          weight: 700,
          style: 'normal',
        },
      ],
    });

    // Convert SVG to PNG
    const overlay = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();

    // Download and process the backdrop image
    const backdropUrl = `https://image.tmdb.org/t/p/original${movieData.backdrop_path}`;
    const backdrop = await fetch(backdropUrl).then(res => res.arrayBuffer());

    // Composite the images
    const final = await sharp(Buffer.from(backdrop))
      .resize(1200, 630, { fit: 'cover' })
      .composite([{ input: overlay, blend: 'over' }])
      .png()
      .toBuffer();

    return new Response(final, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch (err) {
    console.error('Failed to generate OG image:', err);
    throw error(500, 'Failed to generate image');
  }
};
