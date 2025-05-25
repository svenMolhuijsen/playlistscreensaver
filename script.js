// YouTube Playlist Background Player with Typing Effect
// Default playlist ID
const DEFAULT_PLAYLIST_ID = 'PLGc7GQUGUD5shfN9PzT7ejV9vK8HAoIKA';

// Fallback playlist IDs if default doesn't work
const FALLBACK_PLAYLISTS = [
    'PLrAXtmRdnEQy5dJncPMXU-uMCrJzP8Xjz', // Nature videos
    'PLHFlHpPjgk714eTUwYyqkbdV5YzSH1e9w', // Lofi music
    'PLyqf8ctz0O0tRUBl9zJx4nCjMsLkqq9E5'  // Ambient music
];

// Default video ID as last resort
const FALLBACK_VIDEO_ID = 'dQw4w9WgXcQ';

// Global variables
let player;
let currentPlaylist = [];
let currentVideoIndex = 0;
let isVideoMode = false;
let typingSpeed = 50;
let showOverlay = true;
let textPosition = 'bottom';
let fillMode = 'contain';
let volume = 30;
let randomStart = true;
let currentVideoId = '';
let hideControlsTimer;
let isTyping = false;

// Settings object to track changes
let settings = {
    playlistId: DEFAULT_PLAYLIST_ID,
    videoId: '',
    videoMode: false,
    randomStart: true,
    typingSpeed: 50,
    volume: 30,
    showOverlay: true,
    textPosition: 'bottom',
    fillMode: 'contain'
};

let originalSettings = { ...settings };

// YouTube API ready callback
function onYouTubeIframeAPIReady() {
    initializeFromURL();
    initializePlayer();
    setupControls();
    setupControlsVisibility();
}

// Initialize settings from URL parameters
function initializeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.has('playlist')) {
        settings.playlistId = urlParams.get('playlist');
    }
    
    if (urlParams.has('video')) {
        settings.videoId = urlParams.get('video');
        settings.videoMode = true;
    }
    
    if (urlParams.has('mode')) {
        settings.videoMode = urlParams.get('mode') === 'video';
    }
    
    if (urlParams.has('random')) {
        settings.randomStart = urlParams.get('random') === 'true';
    }
    
    if (urlParams.has('speed')) {
        settings.typingSpeed = parseInt(urlParams.get('speed')) || 50;
    }
    
    if (urlParams.has('volume')) {
        settings.volume = parseInt(urlParams.get('volume')) || 30;
    }
    
    if (urlParams.has('overlay')) {
        settings.showOverlay = urlParams.get('overlay') === 'true';
    }
    
    if (urlParams.has('position')) {
        settings.textPosition = urlParams.get('position');
    }
    
    if (urlParams.has('fill')) {
        settings.fillMode = urlParams.get('fill');
    }

    // Apply settings
    isVideoMode = settings.videoMode;
    randomStart = settings.randomStart;
    typingSpeed = settings.typingSpeed;
    volume = settings.volume;
    showOverlay = settings.showOverlay;
    textPosition = settings.textPosition;
    fillMode = settings.fillMode;
    
    originalSettings = { ...settings };
}

// Initialize YouTube player
function initializePlayer() {
    // Add user interaction detection
    let userInteracted = false;
    
    function detectUserInteraction() {
        userInteracted = true;
        document.removeEventListener('click', detectUserInteraction);
        document.removeEventListener('keydown', detectUserInteraction);
        document.removeEventListener('touchstart', detectUserInteraction);
    }
    
    document.addEventListener('click', detectUserInteraction);
    document.addEventListener('keydown', detectUserInteraction);
    document.addEventListener('touchstart', detectUserInteraction);
    
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        playerVars: {
            autoplay: userInteracted ? 1 : 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            showinfo: 0,
            cc_load_policy: 0,
            enablejsapi: 1,
            origin: window.location.origin,
            mute: 0,
            loop: 1,
            widget_referrer: window.location.origin
        },
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
        }
    });
}

// Player ready event
function onPlayerReady(event) {
    console.log('YouTube Player Ready');
    applyFillMode();
    
    // Set volume first
    if (player && typeof player.setVolume === 'function') {
        player.setVolume(volume);
    }
    
    // Start playing content
    if (isVideoMode && settings.videoId) {
        console.log('Loading video:', settings.videoId);
        playVideo(settings.videoId);
    } else {
        console.log('Loading playlist:', settings.playlistId);
        loadPlaylist(settings.playlistId);
    }
    
    updateOverlayVisibility();
    updateTextPosition();
    
    // Try to start playback if autoplay failed
    setTimeout(() => {
        if (player && typeof player.getPlayerState === 'function') {
            const state = player.getPlayerState();
            if (state === YT.PlayerState.UNSTARTED || state === YT.PlayerState.PAUSED) {
                console.log('Attempting manual playback start');
                try {
                    player.playVideo();
                } catch (error) {
                    console.log('Manual playback failed:', error);
                    showPlayPrompt();
                }
            }
        }
    }, 1000);
}

// Player state change event
function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        const videoData = player.getVideoData();
        if (videoData && videoData.title) {
            if (showOverlay) {
                typeTitle(videoData.title);
            }
        }
    } else if (event.data === YT.PlayerState.ENDED) {
        if (!isVideoMode) {
            playNextVideo();
        }
    }
}

// Player error event
function onPlayerError(event) {
    console.error('YouTube Player Error:', event.data);
    
    // Error codes: 2=invalid parameter, 5=HTML5 player issue, 100=video not found, 101/150=not allowed in embedded players
    let errorMessage = 'Er is een onbekende fout opgetreden.';
    
    switch(event.data) {
        case 2:
            errorMessage = 'Ongeldige video/playlist parameter.';
            break;
        case 5:
            errorMessage = 'HTML5 speler fout.';
            break;
        case 100:
            errorMessage = 'Video niet gevonden.';
            break;
        case 101:
            errorMessage = 'Video niet beschikbaar voor ingebed afspelen.';
            break;
        case 150:
            errorMessage = 'Video niet beschikbaar voor ingebed afspelen.';
            break;
    }
    
    showErrorMessage(errorMessage);
    
    if (!isVideoMode) {
        // Try next video in playlist after error
        setTimeout(() => playNextVideo(), 3000);
    }
}

// Show error message to user
function showErrorMessage(message) {
    const existing = document.getElementById('errorMessage');
    if (existing) existing.remove();
    
    const errorDiv = document.createElement('div');
    errorDiv.id = 'errorMessage';
    errorDiv.innerHTML = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                    background: rgba(200,0,0,0.9); color: white; padding: 20px; border-radius: 10px; 
                    text-align: center; z-index: 1000; font-family: Arial, sans-serif; max-width: 400px;">
            <h3>⚠️ Fout</h3>
            <p>${message}</p>
            <button onclick="document.getElementById('errorMessage').remove()" 
                    style="background: #fff; color: #000; border: none; padding: 10px 20px; 
                           border-radius: 5px; cursor: pointer; font-size: 14px; margin-top: 10px;">
                OK
            </button>
        </div>
    `;
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (document.getElementById('errorMessage')) {
            document.getElementById('errorMessage').remove();
        }
    }, 5000);
}

// Load playlist
async function loadPlaylist(playlistId) {
    try {
        console.log('Attempting to load playlist:', playlistId);
        // Since we can't directly access YouTube API without key, 
        // we'll use the player's playlist functionality
        player.loadPlaylist({
            list: playlistId,
            listType: 'playlist',
            index: randomStart ? Math.floor(Math.random() * 50) : 0
        });
    } catch (error) {
        console.error('Error loading playlist:', error);
        // Try fallback playlists
        tryFallbackPlaylists();
    }
}

// Try fallback playlists if main playlist fails
function tryFallbackPlaylists() {
    let fallbackIndex = 0;
    
    function tryNextFallback() {
        if (fallbackIndex < FALLBACK_PLAYLISTS.length) {
            const fallbackId = FALLBACK_PLAYLISTS[fallbackIndex];
            console.log('Trying fallback playlist:', fallbackId);
            
            try {
                player.loadPlaylist({
                    list: fallbackId,
                    listType: 'playlist',
                    index: randomStart ? Math.floor(Math.random() * 50) : 0
                });
                fallbackIndex++;
            } catch (error) {
                console.error('Fallback playlist failed:', error);
                fallbackIndex++;
                setTimeout(tryNextFallback, 2000);
            }
        } else {
            // All playlists failed, try single video as last resort
            console.log('All playlists failed, loading fallback video:', FALLBACK_VIDEO_ID);
            playVideo(FALLBACK_VIDEO_ID);
        }
    }
    
    setTimeout(tryNextFallback, 2000);
}

// Play specific video
function playVideo(videoId) {
    if (videoId) {
        player.loadVideoById(videoId);
        currentVideoId = videoId;
    }
}

// Play next video in playlist
function playNextVideo() {
    if (!isVideoMode && player && typeof player.nextVideo === 'function') {
        try {
            player.nextVideo();
        } catch (error) {
            console.error('Error playing next video:', error);
            // Fallback: reload current playlist
            if (settings.playlistId) {
                loadPlaylist(settings.playlistId);
            }
        }
    }
}

// Typing effect for title
function typeTitle(title) {
    if (isTyping) return;
    
    const overlay = document.getElementById('overlay');
    overlay.textContent = '';
    
    if (!showOverlay) {
        overlay.style.display = 'none';
        return;
    }
    
    overlay.style.display = 'block';
    isTyping = true;
    
    let i = 0;
    const typeInterval = setInterval(() => {
        if (i < title.length) {
            overlay.textContent += title.charAt(i);
            i++;
        } else {
            clearInterval(typeInterval);
            isTyping = false;
        }
    }, typingSpeed);
}

// Setup control panel functionality
function setupControls() {
    const controlToggle = document.getElementById('controlToggle');
    const controlPanel = document.getElementById('controlPanel');
    const playlistInput = document.getElementById('playlistInput');
    const videoIdInput = document.getElementById('videoIdInput');
    const videoModeToggle = document.getElementById('videoModeToggle');
    const randomStartToggle = document.getElementById('randomStartToggle');
    const speedInput = document.getElementById('speedInput');
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeValue = document.getElementById('volumeValue');
    const overlayToggle = document.getElementById('overlayToggle');
    const textPositionSelect = document.getElementById('textPositionSelect');
    const fillModeSelect = document.getElementById('fillModeSelect');
    const applyButton = document.getElementById('applySettings');
    const nextButton = document.getElementById('nextVideo');
    const shareUrl = document.getElementById('shareUrl');
    const copyUrlButton = document.getElementById('copyUrl');
    const playlistControls = document.getElementById('playlistControls');
    const videoControls = document.getElementById('videoControls');
    const unsavedMsg = document.getElementById('unsavedChangesMsg');

    // Initialize form values
    playlistInput.value = settings.playlistId;
    videoIdInput.value = settings.videoId;
    videoModeToggle.checked = settings.videoMode;
    randomStartToggle.checked = settings.randomStart;
    speedInput.value = settings.typingSpeed;
    volumeSlider.value = settings.volume;
    volumeValue.textContent = settings.volume;
    overlayToggle.checked = settings.showOverlay;
    textPositionSelect.value = settings.textPosition;
    fillModeSelect.value = settings.fillMode;

    // Toggle control panel
    controlToggle.addEventListener('click', () => {
        controlPanel.classList.toggle('hidden');
        if (window.resetHideTimer) {
            window.resetHideTimer();
        }
    });

    // Video mode toggle
    videoModeToggle.addEventListener('change', () => {
        settings.videoMode = videoModeToggle.checked;
        if (settings.videoMode) {
            playlistControls.style.display = 'none';
            videoControls.style.display = 'block';
        } else {
            playlistControls.style.display = 'block';
            videoControls.style.display = 'none';
        }
        checkForChanges();
    });

    // Input change handlers
    playlistInput.addEventListener('input', () => {
        settings.playlistId = playlistInput.value;
        checkForChanges();
    });

    videoIdInput.addEventListener('input', () => {
        settings.videoId = videoIdInput.value;
        checkForChanges();
    });

    randomStartToggle.addEventListener('change', () => {
        settings.randomStart = randomStartToggle.checked;
        checkForChanges();
    });

    speedInput.addEventListener('input', () => {
        settings.typingSpeed = parseInt(speedInput.value) || 50;
        checkForChanges();
    });

    volumeSlider.addEventListener('input', () => {
        settings.volume = parseInt(volumeSlider.value);
        volumeValue.textContent = settings.volume;
        if (player && player.setVolume) {
            player.setVolume(settings.volume);
        }
        checkForChanges();
    });

    overlayToggle.addEventListener('change', () => {
        settings.showOverlay = overlayToggle.checked;
        updateOverlayVisibility();
        checkForChanges();
    });

    textPositionSelect.addEventListener('change', () => {
        settings.textPosition = textPositionSelect.value;
        updateTextPosition();
        checkForChanges();
    });

    fillModeSelect.addEventListener('change', () => {
        settings.fillMode = fillModeSelect.value;
        applyFillMode();
        checkForChanges();
    });

    // Apply settings button
    applyButton.addEventListener('click', () => {
        applySettings();
    });

    // Next video button
    nextButton.addEventListener('click', () => {
        if (isVideoMode) {
            // In video mode, just reload the current video
            if (settings.videoId) {
                playVideo(settings.videoId);
            }
        } else {
            playNextVideo();
        }
    });

    // Copy URL button
    copyUrlButton.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(shareUrl.value);
            copyUrlButton.textContent = 'Copied!';
            setTimeout(() => {
                copyUrlButton.textContent = 'Copy URL';
            }, 2000);
        } catch (err) {
            // Fallback for older browsers
            shareUrl.select();
            document.execCommand('copy');
            copyUrlButton.textContent = 'Copied!';
            setTimeout(() => {
                copyUrlButton.textContent = 'Copy URL';
            }, 2000);
        }
    });

    // Initialize UI state
    if (settings.videoMode) {
        playlistControls.style.display = 'none';
        videoControls.style.display = 'block';
    }

    updateShareUrl();
}

// Check for unsaved changes
function checkForChanges() {
    const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    const unsavedMsg = document.getElementById('unsavedChangesMsg');
    
    if (hasChanges) {
        unsavedMsg.style.display = 'block';
    } else {
        unsavedMsg.style.display = 'none';
    }
    
    updateShareUrl();
}

// Apply settings
function applySettings() {
    isVideoMode = settings.videoMode;
    randomStart = settings.randomStart;
    typingSpeed = settings.typingSpeed;
    volume = settings.volume;
    showOverlay = settings.showOverlay;
    textPosition = settings.textPosition;
    fillMode = settings.fillMode;

    if (player && typeof player.setVolume === 'function') {
        player.setVolume(volume);
        
        if (isVideoMode && settings.videoId) {
            playVideo(settings.videoId);
        } else if (!isVideoMode && settings.playlistId) {
            loadPlaylist(settings.playlistId);
        }
    }

    updateOverlayVisibility();
    updateTextPosition();
    applyFillMode();
    
    originalSettings = { ...settings };
    checkForChanges();
    
    // Update URL
    const url = new URL(window.location);
    url.search = '';
    
    if (isVideoMode && settings.videoId) {
        url.searchParams.set('video', settings.videoId);
        url.searchParams.set('mode', 'video');
    } else {
        url.searchParams.set('playlist', settings.playlistId);
        url.searchParams.set('mode', 'playlist');
    }
    
    if (!randomStart) url.searchParams.set('random', 'false');
    if (typingSpeed !== 50) url.searchParams.set('speed', typingSpeed);
    if (volume !== 30) url.searchParams.set('volume', volume);
    if (!showOverlay) url.searchParams.set('overlay', 'false');
    if (textPosition !== 'bottom') url.searchParams.set('position', textPosition);
    if (fillMode !== 'contain') url.searchParams.set('fill', fillMode);
    
    window.history.replaceState({}, '', url);
}

// Update share URL
function updateShareUrl() {
    const url = new URL(window.location.origin + window.location.pathname);
    
    if (settings.videoMode && settings.videoId) {
        url.searchParams.set('video', settings.videoId);
        url.searchParams.set('mode', 'video');
    } else {
        url.searchParams.set('playlist', settings.playlistId);
        url.searchParams.set('mode', 'playlist');
    }
    
    if (!settings.randomStart) url.searchParams.set('random', 'false');
    if (settings.typingSpeed !== 50) url.searchParams.set('speed', settings.typingSpeed);
    if (settings.volume !== 30) url.searchParams.set('volume', settings.volume);
    if (!settings.showOverlay) url.searchParams.set('overlay', 'false');
    if (settings.textPosition !== 'bottom') url.searchParams.set('position', settings.textPosition);
    if (settings.fillMode !== 'contain') url.searchParams.set('fill', settings.fillMode);
    
    document.getElementById('shareUrl').value = url.toString();
}

// Update overlay visibility
function updateOverlayVisibility() {
    const overlay = document.getElementById('overlay');
    if (showOverlay) {
        overlay.style.display = 'block';
    } else {
        overlay.style.display = 'none';
    }
}

// Update text position
function updateTextPosition() {
    const overlay = document.getElementById('overlay');
    overlay.className = `position-${textPosition}`;
}

// Apply fill mode
function applyFillMode() {
    const playerElement = document.getElementById('player');
    playerElement.className = fillMode;
}

// Setup controls visibility (hide after 5 seconds of inactivity)
function setupControlsVisibility() {
    const controlToggle = document.getElementById('controlToggle');
    const controlPanel = document.getElementById('controlPanel');
    
    function hideControls() {
        if (!controlPanel.classList.contains('hidden')) {
            return; // Don't hide if panel is open
        }
        controlToggle.classList.add('fade');
    }
    
    function showControls() {
        controlToggle.classList.remove('fade');
    }
    
    // Make resetHideTimer globally accessible
    window.resetHideTimer = function() {
        clearTimeout(hideControlsTimer);
        showControls();
        hideControlsTimer = setTimeout(hideControls, 5000);
    };
    
    // Mouse movement and click events
    document.addEventListener('mousemove', window.resetHideTimer);
    document.addEventListener('click', window.resetHideTimer);
    document.addEventListener('keydown', window.resetHideTimer);
    
    // Touch events for mobile
    document.addEventListener('touchstart', window.resetHideTimer);
    document.addEventListener('touchmove', window.resetHideTimer);
    
    // Start the timer
    window.resetHideTimer();
}

// Show play prompt when autoplay fails
function showPlayPrompt() {
    const existing = document.getElementById('playPrompt');
    if (existing) return;
    
    const prompt = document.createElement('div');
    prompt.id = 'playPrompt';
    prompt.innerHTML = `
        <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                    background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 10px; 
                    text-align: center; z-index: 1000; font-family: Arial, sans-serif;">
            <h3>🎬 Klik om te beginnen</h3>
            <p>Browser vereist gebruikersinteractie om af te spelen</p>
            <button onclick="startPlayback()" style="background: #ff0000; color: white; border: none; 
                    padding: 15px 25px; border-radius: 5px; cursor: pointer; font-size: 16px; margin-top: 15px;">
                ▶️ Afspelen
            </button>
        </div>
    `;
    document.body.appendChild(prompt);
}

// Start playback manually
function startPlayback() {
    const prompt = document.getElementById('playPrompt');
    if (prompt) {
        prompt.remove();
    }
    
    if (player && typeof player.playVideo === 'function') {
        player.playVideo();
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // YouTube API will call onYouTubeIframeAPIReady when ready
    });
} else {
    // YouTube API will call onYouTubeIframeAPIReady when ready
}