const hlsInstances = new Map();

function destroyHlsForVideo(videoEl) {
    if (hlsInstances.has(videoEl)) {
        const hls = hlsInstances.get(videoEl);
        hls.destroy();
        hlsInstances.delete(videoEl);
    }
}

function loadVideo(url, videoElement) {
    if (!videoElement) return;
    destroyHlsForVideo(videoElement);
    videoElement.pause();
    videoElement.removeAttribute('src');
    videoElement.load();
    if (!url) { showToast('❌ Немає URL відео'); return; }
    const finalUrl = getProxyUrl(url);
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 90,
            startLevel: -1,
            manifestLoadPolicy: { default: { maxTimeToFirstByteMs: 8000, maxLoadTimeMs: 16000 } }
        });
        hlsInstances.set(videoElement, hls);
        hls.loadSource(finalUrl);
        hls.attachMedia(videoElement);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            videoElement.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
                    case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
                    default: destroyHlsForVideo(videoElement);
                }
            }
        });
    } else {
        videoElement.src = finalUrl;
        videoElement.play().catch(() => {});
    }
}

window.loadVideo = loadVideo;
window.destroyHlsForVideo = destroyHlsForVideo;
