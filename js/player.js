const hlsInstances = new Map();

function destroyHlsForVideo(videoEl) {
    if (hlsInstances.has(videoEl)) {
        try { hlsInstances.get(videoEl).destroy(); } catch(e) {}
        hlsInstances.delete(videoEl);
    }
}

async function loadVideo(url, videoElement, options = {}) {
    if (!videoElement) return;
    destroyHlsForVideo(videoElement);
    videoElement.pause();
    videoElement.removeAttribute('src');
    videoElement.load();
    const playerLoading = document.getElementById('playerLoading');
    if (playerLoading) playerLoading.style.display = 'block';

    if (!url) { showToast('❌ Немає URL відео'); if (playerLoading) playerLoading.style.display = 'none'; return; }
    const proxyUrl = getProxyUrl(url);

    const maxRetries = options.maxRetries || 3;
    // autoplay: true тільки якщо явно передано, інакше false
    const autoplay = options.autoplay === true;
    let attempt = 0;

    function attachHls() {
        if (typeof Hls !== 'undefined' && Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 90 });
            hlsInstances.set(videoElement, hls);
            hls.loadSource(proxyUrl);
            hls.attachMedia(videoElement);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (playerLoading) playerLoading.style.display = 'none';
                if (autoplay) videoElement.play().catch(() => {});
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                if (!data) return;
                if (data.fatal) {
                    attempt++;
                    if (attempt <= maxRetries) {
                        const backoff = 800 * Math.pow(2, attempt);
                        setTimeout(() => {
                            try { hls.startLoad(); } catch (e) { attachFallback(); }
                        }, backoff);
                    } else {
                        destroyHlsForVideo(videoElement);
                        attachFallback();
                        showToast('Помилка відтворення. Спробувати ще');
                    }
                }
            });
        } else {
            attachFallback();
        }
    }

    function attachFallback() {
        if (playerLoading) playerLoading.style.display = 'none';
        videoElement.src = proxyUrl;
        if (autoplay) videoElement.play().catch(() => {});
    }

    try { attachHls(); } catch (err) { attachFallback(); }
}
