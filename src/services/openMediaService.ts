// Open Source Media & Sound Effects Service
// Live integration with Openverse API (CC0 & Creative Commons) & Wikimedia Commons Open Media

export interface OpenAudioItem {
  id: string;
  title: string;
  artist: string;
  duration: number;
  category: string;
  url: string;
  license: string;
  source: string;
  bpm?: number;
  waveform?: string;
  icon?: string;
}

export interface OpenMediaItem {
  id: string;
  title: string;
  type: 'video' | 'photo';
  url: string;
  thumbnailUrl?: string;
  duration: number;
  width: number;
  height: number;
  license: string;
  source: string;
  author?: string;
}

class OpenMediaService {
  private audioCache = new Map<string, OpenAudioItem[]>();
  private mediaCache = new Map<string, OpenMediaItem[]>();

  /**
   * Search live open-source audio tracks and sound effects from Openverse API
   */
  async searchAudio(query: string = '', category: string = 'all'): Promise<OpenAudioItem[]> {
    const trimmed = query.trim().toLowerCase();
    const cacheKey = `${category}::${trimmed}`;

    if (this.audioCache.has(cacheKey)) {
      return this.audioCache.get(cacheKey)!;
    }

    // Determine appropriate search term for Openverse
    let searchTerm = trimmed;
    if (!searchTerm) {
      if (category === 'sfx') {
        searchTerm = 'sound effects';
      } else if (category === 'music') {
        searchTerm = 'lofi beat';
      } else if (category === 'whoosh') {
        searchTerm = 'whoosh swoosh';
      } else if (category === 'impact') {
        searchTerm = 'impact boom';
      } else if (category === 'glitch') {
        searchTerm = 'glitch electronic';
      } else if (category === 'camera') {
        searchTerm = 'camera shutter';
      } else if (category === 'nature') {
        searchTerm = 'nature rain birds';
      } else if (category === 'lo-fi') {
        searchTerm = 'lofi chill beat';
      } else if (category === 'beats') {
        searchTerm = 'hip hop beats';
      } else if (category === 'cinematic') {
        searchTerm = 'cinematic orchestral trailer';
      } else {
        searchTerm = 'ambient beat';
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);

    try {
      const openverseUrl = `https://api.openverse.org/v1/audio/?q=${encodeURIComponent(
        searchTerm
      )}&page_size=25`;

      const resp = await fetch(openverseUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'FastArt-Editor/2.0',
        },
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        if (data && Array.isArray(data.results) && data.results.length > 0) {
          const items: OpenAudioItem[] = data.results
            .filter((r: any) => {
              if (!r.url || typeof r.url !== 'string') return false;
              const u = r.url.toLowerCase();
              const ft = (r.filetype || '').toLowerCase();
              return (
                u.startsWith('http') &&
                (u.includes('.mp3') ||
                  u.includes('.wav') ||
                  u.includes('.ogg') ||
                  u.includes('format=mp3') ||
                  ft.includes('mp3') ||
                  ft.includes('wav') ||
                  ft.includes('ogg'))
              );
            })
            .map((r: any) => {
              const durSec = r.duration ? Math.max(1, Math.round(r.duration / 1000)) : 10;
              const title = (r.title || 'Open Audio Track').replace(/^File:/i, '').trim();
              const creator = r.creator || r.source || 'Openverse Community';
              const license = r.license
                ? `CC ${r.license.toUpperCase()} ${r.license_version || ''}`.trim()
                : 'Creative Commons';

              return {
                id: `openverse-aud-${r.id}`,
                title: title.length > 40 ? title.substring(0, 40) + '...' : title,
                artist: creator,
                duration: durSec,
                category: category === 'all' ? (r.category || 'Soundtrack') : category,
                url: r.url,
                license,
                source: r.provider || r.source || 'Openverse Library',
                bpm: 120,
                icon: category === 'whoosh' ? 'flash' : category === 'impact' ? 'volume-high' : 'musical-notes',
              };
            });

          if (items.length > 0) {
            this.audioCache.set(cacheKey, items);
            return items;
          }
        }
      }
    } catch (err) {
      // Abort or network failure
    } finally {
      clearTimeout(timeoutId);
    }

    return [];
  }

  /**
   * Search live open-source media (videos and photos)
   * Photos via Openverse Image API
   * Videos via Wikimedia Commons Open Media API
   */
  async searchMedia(
    query: string = '',
    mediaType: 'all' | 'video' | 'photo' = 'all'
  ): Promise<OpenMediaItem[]> {
    const trimmed = query.trim().toLowerCase();
    const cacheKey = `${mediaType}::${trimmed}`;

    if (this.mediaCache.has(cacheKey)) {
      return this.mediaCache.get(cacheKey)!;
    }

    const results: OpenMediaItem[] = [];

    // Search Openverse Photos (if 'all' or 'photo')
    if (mediaType === 'all' || mediaType === 'photo') {
      const photoQuery = trimmed || 'cinematic nature';
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(
          photoQuery
        )}&page_size=20`;

        const resp = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'FastArt-Editor/2.0' },
        });
        clearTimeout(timeout);

        if (resp.ok) {
          const data = await resp.json();
          if (data && Array.isArray(data.results)) {
            data.results.forEach((r: any) => {
              if (!r.url || !r.url.startsWith('http')) return;
              const title = (r.title || 'Creative Commons Photo').replace(/^File:/i, '').trim();
              results.push({
                id: `openverse-img-${r.id}`,
                title: title.length > 36 ? title.substring(0, 36) + '...' : title,
                type: 'photo',
                url: r.url,
                thumbnailUrl: r.thumbnail || r.url,
                duration: 4.0,
                width: r.width || 1920,
                height: r.height || 1080,
                license: r.license ? `CC ${r.license.toUpperCase()}` : 'Creative Commons',
                source: r.provider || 'Openverse',
                author: r.creator || 'Community Creator',
              });
            });
          }
        }
      } catch (err) {
        // Continue
      }
    }

    // Search Wikimedia Commons Videos (if 'all' or 'video')
    if (mediaType === 'all' || mediaType === 'video') {
      const videoQuery = trimmed || 'timelapse nature';
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=filetype:video+${encodeURIComponent(
          videoQuery
        )}&gsrlimit=15&prop=imageinfo&iiprop=url|size|mime&format=json&origin=*`;

        const resp = await fetch(wikiUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'FastArt-Editor/2.0' },
        });
        clearTimeout(timeout);

        if (resp.ok) {
          const data = await resp.json();
          if (data && data.query && data.query.pages) {
            Object.values(data.query.pages).forEach((page: any) => {
              const info = page.imageinfo?.[0];
              if (!info || !info.url) return;
              const u = info.url.toLowerCase();
              if (!u.endsWith('.webm') && !u.endsWith('.mp4') && !u.endsWith('.ogv')) return;

              const cleanTitle = page.title
                .replace(/^File:/i, '')
                .replace(/\.(webm|mp4|ogv)$/i, '')
                .trim();

              const dur = info.duration ? Math.max(2, Math.round(info.duration)) : 6.0;

              results.push({
                id: `wiki-vid-${page.pageid}`,
                title: cleanTitle.length > 36 ? cleanTitle.substring(0, 36) + '...' : cleanTitle,
                type: 'video',
                url: info.url,
                thumbnailUrl: info.thumburl || undefined,
                duration: dur,
                width: info.width || 1280,
                height: info.height || 720,
                license: 'CC / Wikimedia Open Source',
                source: 'Wikimedia Commons',
                author: 'Wikimedia Open Contributor',
              });
            });
          }
        }
      } catch (err) {
        // Continue
      }
    }

    if (results.length > 0) {
      this.mediaCache.set(cacheKey, results);
    }

    return results;
  }
}

export const openMediaService = new OpenMediaService();
