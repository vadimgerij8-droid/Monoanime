async function fetchUA(url) {
    if (!url) throw new Error('empty url');
    const proxyUrl = getProxyUrl(url);
    const resp = await fetch(proxyUrl);
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    const html = await resp.text();
    return new DOMParser().parseFromString(html, 'text/html');
}

function parseCards(doc) {
    const cards = safeQueryAll('.poster', doc);
    if (cards.length) {
        return cards.map(card => {
            const linkEl = card.tagName === 'A' ? card : safeQuery('a', card);
            const href = linkEl?.getAttribute('href') || '';
            const img = safeQuery('img', card);
            const posterSrc = img?.getAttribute('data-src') || img?.getAttribute('src') || '';
            const titleEl = safeQuery('.poster__title', card) || safeQuery('h3', card);
            const title = (titleEl?.textContent || '').trim() || 'Без назви';
            return {
                mal_id: href.hashCode(),
                title,
                url: href.startsWith('http') ? href : ANIMEUA_BASE + href,
                images: { jpg: { large_image_url: posterSrc.startsWith('http') ? posterSrc : (posterSrc ? ANIMEUA_BASE + posterSrc : '') } },
                score: null, year: null, from: 'animeua'
            };
        });
    }
    const links = safeQueryAll('a[href*="/anime/"]', doc);
    const unique = new Map();
    links.forEach(a => { if (!unique.has(a.href)) unique.set(a.href, a); });
    return Array.from(unique.values()).map(a => {
        const img = safeQuery('img', a);
        const src = img?.getAttribute('data-src') || img?.getAttribute('src') || '';
        const title = (safeQuery('.poster__title', a)?.textContent || a.textContent || '').trim();
        return {
            mal_id: a.href.hashCode(),
            title: title || 'Без назви',
            url: a.href,
            images: { jpg: { large_image_url: src.startsWith('http') ? src : ANIMEUA_BASE + src } },
            score: null, year: null, from: 'animeua'
        };
    });
}

async function fetchMainPage(page = 1) {
    const doc = await fetchUA(`${ANIMEUA_BASE}/page/${page}/`);
    return parseCards(doc);
}

async function searchAnimeUA(query, page = 1) {
    const doc = await fetchUA(`${ANIMEUA_BASE}/index.php?do=search&subaction=search&story=${encodeURIComponent(query)}&page=${page}`);
    return parseCards(doc);
}

async function fetchByGenre(genreSlug, page = 1) {
    const doc = await fetchUA(`${ANIMEUA_BASE}/genre/${genreSlug}/page/${page}/`);
    return parseCards(doc);
}

async function fetchTop100() {
    const doc = await fetchUA(`${ANIMEUA_BASE}/top.html`);
    return parseCards(doc);
}

function fetchGenres() {
    return Object.entries(GENRE_MAP)
        .map(([name, slug]) => ({ slug, name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'uk'));
}

// ---------- Парсинг джерел ----------

function extractSourcesFromText(text, providerName = '') {
    const sources = [];
    const jsonMatch = text.match(/file\s*:\s*(\[[\s\S]+?\]|\'[\s\S]+?\'|\"[\s\S]+?\"|\{[\s\S]+?\})/i) ||
        text.match(/playlist\s*:\s*(\[[\s\S]+?\])/i);

    if (jsonMatch) {
        try {
            let rawData = jsonMatch[1].trim();
            if ((rawData.startsWith("'") && rawData.endsWith("'")) || (rawData.startsWith('"') && rawData.endsWith('"'))) {
                rawData = rawData.slice(1, -1);
            }
            if (rawData.startsWith('{') && rawData.endsWith('}')) rawData = `[${rawData}]`;
            const cleanJson = rawData.replace(/,\s*\]/g, ']').replace(/,\s*\}/g, '}');
            const arr = JSON.parse(cleanJson);

            const walk = (items, currentDub = '', currentSeason = '1') => {
                items.forEach(item => {
                    if (item.folder || item.playlist) {
                        let nextDub = currentDub, nextSeason = currentSeason;
                        const folderTitle = item.title || '';
                        const seasonMatch = folderTitle.match(/[Сс]езон\s*(\d+)/);
                        if (seasonMatch) {
                            nextSeason = seasonMatch[1];
                            if (folderTitle.trim().toLowerCase() !== `сезон ${nextSeason}`.toLowerCase()) {
                                nextDub = folderTitle.replace(/[Сс]езон\s*\d+/g, '').replace(/\//g, '').trim() || currentDub;
                            }
                        } else if (folderTitle) {
                            nextDub = folderTitle;
                        }
                        walk(item.folder || item.playlist, nextDub, nextSeason);
                    } else if (item.file) {
                        const episodeTitle = item.title || 'Серія';
                        let finalDub = currentDub || providerName || 'UA';
                        let finalSeason = currentSeason;
                        const epSeasonMatch = episodeTitle.match(/[Сс]езон\s*(\d+)/);
                        if (epSeasonMatch) finalSeason = epSeasonMatch[1];
                        const epNumMatch = episodeTitle.match(/(\d+)\s*[Сс]ері[яіяа]|[Сс]ері[яіяа]\s*(\d+)|[Ее]п\.?\s*(\d+)/);
                        const episodeNumber = epNumMatch ? (epNumMatch[1] || epNumMatch[2] || epNumMatch[3]) : '1';
                        sources.push({ label: episodeTitle, file: item.file, provider: providerName, dub: finalDub.trim(), season: finalSeason, episode: episodeNumber });
                    }
                });
            };

            if (Array.isArray(arr)) walk(arr);
            else if (arr.file) sources.push({ label: arr.title || 'Озвучка', file: arr.file, provider: providerName, dub: providerName || 'UA', season: '1', episode: '1' });
        } catch (e) { console.warn('Помилка парсингу JSON озвучок', e); }
    }

    if (sources.length === 0) {
        const urlMatches = [...text.matchAll(/https?:\/\/[^\s\'"<>]+\.m3u8[^\s\'"<>]*/g)];
        urlMatches.forEach((m, idx) => {
            if (!sources.some(s => s.file === m[0])) {
                sources.push({ label: `Потік ${idx + 1}`, file: m[0], provider: providerName, dub: providerName || 'UA', season: '1', episode: String(idx + 1) });
            }
        });
    }
    return sources;
}

function extractPlayerIframeUrls(doc) {
    const selectors = ['.video-responsive iframe', '.player-responsive iframe', '#player iframe', '.pmovie__player iframe', 'iframe[src]', 'iframe[data-src]'];
    const urls = [];
    for (const sel of selectors) {
        safeQueryAll(sel, doc).forEach(el => {
            let src = el.getAttribute('src') || el.getAttribute('data-src');
            if (!src || src === 'about:blank') return;
            if (src.startsWith('//')) src = 'https:' + src;
            if (!src.startsWith('http')) src = ANIMEUA_BASE + src;
            urls.push(src);
        });
    }
    const scripts = safeQueryAll('script:not([src])', doc);
    for (const s of scripts) {
        const matches = s.textContent.matchAll(/(?:playerUrl|iframeUrl|src)\s*[:=]\s*['"]([^'"]+)['"]/g);
        for (const match of matches) {
            let url = match[1];
            if (url.includes('ashdi.vip') || url.includes('vidmoly') || url.includes('player')) {
                if (url.startsWith('//')) url = 'https:' + url;
                if (!url.startsWith('http')) url = ANIMEUA_BASE + url;
                urls.push(url);
            }
        }
    }
    return [...new Set(urls)];
}

async function loadAnimeDetails(animeUrl) {
    const doc = await fetchUA(animeUrl);
    let title = '';
    for (const sel of ['.page__subcol-main h1', '.pmovie__title', 'h1.title', 'h1']) {
        const el = safeQuery(sel, doc);
        if (el?.textContent.trim()) { title = el.textContent.trim(); break; }
    }
    let poster = '';
    for (const sel of ['div.page__subcol-side .img-fit-cover img', '.pmovie__poster img', '.anime__poster img']) {
        const el = safeQuery(sel, doc);
        if (el) {
            const src = el.getAttribute('data-src') || el.getAttribute('src') || '';
            if (src) { poster = src.startsWith('http') ? src : ANIMEUA_BASE + src; break; }
        }
    }
    const genres = safeQueryAll('.pmovie__genres a, .genres a', doc).map(a => a.textContent.trim()).filter(Boolean);
    const yearEl = safeQuery('.pmovie__year, .release-year', doc);
    const yearMatch = (yearEl?.textContent || '').match(/\d{4}/);
    const year = yearMatch ? parseInt(yearMatch[0]) : null;
    let synopsis = '';
    for (const sel of ['.full-text', '.pmovie__description', '.anime__description']) {
        const el = safeQuery(sel, doc);
        if (el?.textContent.trim()) { synopsis = el.textContent.trim(); break; }
    }
    let rating = '';
    const ratingEl = doc.querySelector('.pmovie__age p, .pmovie__age');
    if (ratingEl) rating = ratingEl.textContent.replace('Рейтинг:', '').trim();

    const playerUrls = extractPlayerIframeUrls(doc);
    const allRawSources = [];
    for (const playerUrl of playerUrls) {
        try {
            let provider = 'Джерело';
            if (playerUrl.includes('ashdi')) provider = 'Ashdi';
            else if (playerUrl.includes('vidmoly')) provider = 'Vidmoly';
            else if (playerUrl.includes('player')) provider = 'Player';
            const playerHtml = await fetchUA(playerUrl);
            const text = playerHtml.body?.innerHTML || '';
            allRawSources.push(...extractSourcesFromText(text, provider));
            const nestedIframes = safeQueryAll('iframe', playerHtml);
            for (const nested of nestedIframes) {
                let nestedUrl = nested.getAttribute('src') || nested.getAttribute('data-src');
                if (nestedUrl && nestedUrl !== 'about:blank') {
                    if (nestedUrl.startsWith('//')) nestedUrl = 'https:' + nestedUrl;
                    if (!nestedUrl.startsWith('http')) nestedUrl = ANIMEUA_BASE + nestedUrl;
                    const nestedHtml = await fetchUA(nestedUrl);
                    allRawSources.push(...extractSourcesFromText(nestedHtml.body?.innerHTML || '', provider));
                }
            }
        } catch (e) { console.warn('Player fetch failed', playerUrl, e); }
    }

    const seasons = {};
    const seenKeys = new Set();
    allRawSources.forEach(s => {
        const seasonNum = s.season || '1';
        const dubName = s.dub || 'UA';
        const episodeNum = s.episode || '1';
        const uniqueKey = `${seasonNum}-${dubName}-${episodeNum}-${s.file}`;
        if (!seenKeys.has(uniqueKey)) {
            seenKeys.add(uniqueKey);
            if (!seasons[seasonNum]) seasons[seasonNum] = {};
            if (!seasons[seasonNum][dubName]) seasons[seasonNum][dubName] = [];
            seasons[seasonNum][dubName].push({ title: s.label, season: seasonNum, episode: episodeNum, file: s.file, dub: dubName, provider: s.provider });
        }
    });
    for (const s in seasons) {
        for (const d in seasons[s]) {
            seasons[s][d].sort((a, b) => parseInt(a.episode) - parseInt(b.episode));
        }
    }

    return {
        mal_id: animeUrl.hashCode(),
        title,
        images: { jpg: { large_image_url: poster, image_url: poster } },
        genres, year, synopsis, seasons,
        url: animeUrl, from: 'animeua', rating,
        score: null
    };
}

// Глобальні посилання
window.fetchUA = fetchUA;
window.parseCards = parseCards;
window.fetchMainPage = fetchMainPage;
window.searchAnimeUA = searchAnimeUA;
window.fetchByGenre = fetchByGenre;
window.fetchTop100 = fetchTop100;
window.fetchGenres = fetchGenres;
window.extractSourcesFromText = extractSourcesFromText;
window.extractPlayerIframeUrls = extractPlayerIframeUrls;
window.loadAnimeDetails = loadAnimeDetails;
