const PROXY_URL = 'https://monoanime.animegran8.workers.dev';
const ANIMEUA_BASE = 'https://animeua.club';

const GENRE_MAP = {
    "Бойові мистецтва": "boivie",
    "Бойовики": "boyovik",
    "Воєнні": "voenne",
    "Гарем": "garems",
    "Драми": "drama",
    "Детектив": "detektiv",
    "Демони": "demons",
    "Комедії": "komik",
    "Роботи": "meha",
    "Повсякденність": "posyardnevnist",
    "Пригоди": "adventures",
    "Психологічні": "psih",
    "Романтика": "romantik",
    "Надприродні": "weird",
    "Фантастика": "fantastika",
    "Фентезі": "fentezi",
    "Школа": "classes",
    "Еччі": "echhi"
};

function getProxyUrl(url) {
    if (!url) { console.warn('getProxyUrl empty'); return null; }
    return PROXY_URL + '?url=' + encodeURIComponent(url);
}

window.ANIMEUA_BASE = ANIMEUA_BASE;
