const hlsInstances = new Map();

function destroyHlsForVideo(videoEl) {
    if (hlsInstances.has(videoEl)) {
        hlsInstances.get(videoEl).destroy();
        hlsInstances.delete(videoEl);
    }
}

function loadVideo(url, videoElement, malId, episode) {
    if (!videoElement) return;
    destroyHlsForVideo(videoElement);
    videoElement.pause();
    videoElement.removeAttribute('src');
    videoElement.load();

    if (!url) {
        showToast('❌ Немає URL відео');
        return;
    }

    const finalUrl = getProxyUrl(url);

    const saveProgress = () => {
        if (malId && episode && videoElement.currentTime > 0) {
            Storage.saveVideoProgress(malId, episode, videoElement.currentTime);
        }
    };

    const debouncedSave = debounce(saveProgress, 5000);
    videoElement.addEventListener('timeupdate', debouncedSave);
    videoElement.addEventListener('pause', saveProgress);
    videoElement.addEventListener('ended', saveProgress);

    videoElement.addEventListener('loadedmetadata', async () => {
        if (malId && episode) {
            const savedTime = await Storage.getVideoProgress(malId, episode);
            if (savedTime > 0) {
                videoElement.currentTime = savedTime;
            }
        }
    });

    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 90 });
        hlsInstances.set(videoElement, hls);
        hls.loadSource(finalUrl);
        hls.attachMedia(videoElement);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            videoElement.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        hls.recoverMediaError();
                        break;
                    default:
                        destroyHlsForVideo(videoElement);
                }
            }
        });
    } else {
        videoElement.src = finalUrl;
        videoElement.play().catch(() => {});
    }
}
