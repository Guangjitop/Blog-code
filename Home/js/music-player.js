// ==========================================
// TuneHub Music Player - 音乐播放器
// API: https://tunehub.sayqz.com/api/v1/parse
// ==========================================

(function () {
    const TUNEHUB_API = '/api/music/tunehub/parse';
    const TUNEHUB_METHODS_BASE = '/api/music/tunehub/methods';
    const MUSIC_APIKEY_ENDPOINT = '/api/music/apikey';
    const MUSIC_APIKEY_STATUS_ENDPOINT = '/api/music/apikey/status';
    const MUSIC_PROXY_URL = '/api/music-proxy';
    const STORAGE_KEY = 'tunehub_api_key';
    const PLAYLIST_KEY = 'tunehub_playlist';
    const DEBUG_LOG_LIMIT = 120;
    const PARSE_BATCH_LIMIT = 20;
    const PLAYLIST_TABS = [
        { key: 'history', label: '历史记录' },
        { key: 'hot', label: '热歌榜' },
        { key: 'new', label: '新歌榜' }
    ];
    const SONG_ID_KEYS = ['id', 'ids', 'songId', 'songid', 'songIds', 'song_ids', 'song_id', 'trackId', 'trackid', 'trackIds', 'track_id', 'mid', 'songmid', 'musicId', 'musicIds', 'music_id', 'musicrid', 'rid', 'hash'];
    const TOPLIST_PRESETS = {
        netease: [
            { id: '3778678', name: '热歌榜' },
            { id: '3779629', name: '新歌榜' },
            { id: '19723756', name: '飙升榜' },
            { id: '2884035', name: '原创榜' }
        ],
        qq: [
            { id: '26', name: '热歌榜' },
            { id: '27', name: '新歌榜' },
            { id: '62', name: '飙升榜' },
            { id: '4', name: '流行指数榜' }
        ],
        kuwo: [
            { id: '16', name: '热歌榜' },
            { id: '17', name: '新歌榜' },
            { id: '93', name: '飙升榜' },
            { id: '158', name: '抖音热歌榜' }
        ]
    };

    // State
    let playlist = [];
    let playlistBuckets = { history: [], hot: [], new: [] };
    let activePlaylistTab = 'history';
    let currentSongToken = '';
    let currentIndex = -1;
    let isPlaying = false;
    let searchRequestSeq = 0;
    let audio = new Audio();
    audio.volume = 0.7;
    let debugLogs = [];

    // DOM refs (set after init)
    let panelEl, toggleBtn, coverEl, titleEl, artistEl, qualityEl;
    let progressFill, timeCurrentEl, timeTotalEl;
    let playBtn, volumeSlider, volumeBtn;
    let playlistContainer, playlistTabsEl, clearTabBtn, clearAllTabsBtn, searchInput, platformSelect, qualitySelect, searchBtn;
    let functionSelect, pageInput, pageSizeInput, searchExtraRow;
    let apikeyInput, apikeySaveBtn, apikeyStatus;
    let loadingEl, errorEl;
    let toplistPresetEl;
    let debugLogEl, debugCopyBtn, debugClearBtn;
    let authModalEl, authModalInput, authModalConfirm, authModalCancel;
    let currentAuthResolve = null;

    // ---- Init ----
    document.addEventListener('DOMContentLoaded', initMusicPlayer);

    async function initMusicPlayer() {
        injectHTML();
        bindElements();
        bindEvents();
        updateSearchUI();
        await loadApiKey();
        loadPlaylist();
        appendDebug('info', '播放器初始化完成');
    }

    function injectHTML() {
        // Floating button
        const btn = document.createElement('button');
        btn.className = 'music-player-btn';
        btn.id = 'music-toggle-btn';
        btn.innerHTML = '<i class="fas fa-music"></i>';
        btn.title = '音乐播放器';
        document.body.appendChild(btn);

        // Panel
        const panel = document.createElement('div');
        panel.className = 'music-panel';
        panel.id = 'music-panel';
        panel.innerHTML = `
            <div class="music-panel-resizer music-panel-resizer-top"></div>
            <div class="music-panel-resizer music-panel-resizer-bottom"></div>
            <div class="music-panel-resizer music-panel-resizer-left"></div>
            <div class="music-panel-resizer music-panel-resizer-right"></div>
            <div class="music-panel-resizer music-panel-resizer-top-left"></div>
            <div class="music-panel-resizer music-panel-resizer-top-right"></div>
            <div class="music-panel-resizer music-panel-resizer-bottom-left"></div>
            <div class="music-panel-resizer music-panel-resizer-bottom-right"></div>

            <div class="music-panel-left">
                <div class="music-playlist-header">
                    <span>播放列表</span>
                    <div class="music-playlist-header-actions">
                        <button id="music-clear-tab" type="button">清空当前</button>
                        <button id="music-clear-all" type="button">清空全部</button>
                    </div>
                </div>
                <div class="music-playlist" id="music-playlist"></div>
                <div class="music-playlist-tabs" id="music-playlist-tabs"></div>
            </div>
            
            <div class="music-panel-right">
                <div class="music-panel-header" id="music-panel-header">
                    <div class="title"><i class="fas fa-headphones"></i> TuneHub 播放器</div>
                    <button class="close-btn" id="music-close"><i class="fas fa-times"></i></button>
                </div>

                <div class="music-apikey">
                    <div class="music-apikey-row">
                        <input type="password" id="music-apikey-input" placeholder="输入 API Key..." />
                        <button id="music-apikey-save">保存</button>
                    </div>
                    <div class="apikey-status" id="music-apikey-status"></div>
                </div>

                <div class="music-auth-modal" id="music-auth-modal" style="display:none;">
                    <div class="music-auth-content">
                        <div class="music-auth-title">管理员身份验证</div>
                        <p class="music-auth-desc">请输入管理员密码以保存 API Key 到服务端（跨端共享）</p>
                        <input type="password" id="music-auth-input" placeholder="输入管理员密码..." />
                        <div class="music-auth-actions">
                            <button id="music-auth-cancel" class="music-btn-secondary">取消</button>
                            <button id="music-auth-confirm" class="music-btn-primary">确定</button>
                        </div>
                    </div>
                </div>

                <div class="music-search">
                    <div class="music-search-row">
                        <select id="music-function">
                            <option value="parse">ID解析</option>
                            <option value="search" selected>搜索歌曲</option>
                            <option value="toplists">排行榜列表</option>
                            <option value="toplist">排行榜详情</option>
                            <option value="playlist">歌单详情</option>
                        </select>
                        <select id="music-platform">
                            <option value="netease">网易云</option>
                            <option value="qq">QQ音乐</option>
                            <option value="kuwo">酷我</option>
                        </select>
                        <input type="text" id="music-search-input" placeholder="输入歌曲ID，多个用逗号分隔" />
                    </div>
                    <div class="music-search-row" id="music-search-extra-row" style="display:none;">
                        <input type="number" id="music-page" min="1" value="1" placeholder="页码" />
                        <input type="number" id="music-page-size" min="1" max="50" value="10" placeholder="每页数量" />
                    </div>
                    <div class="music-search-actions">
                        <select id="music-quality">
                            <option value="320k">高品 320k</option>
                            <option value="128k">标准 128k</option>
                            <option value="flac">无损 FLAC</option>
                            <option value="flac24bit">Hi-Res</option>
                        </select>
                        <button id="music-search-btn">解析</button>
                    </div>
                    <div class="music-toplist-presets" id="music-toplist-presets"></div>
                </div>

                <div class="music-loading" id="music-loading" style="display:none;">
                    <i class="fas fa-spinner fa-spin"></i> 解析中...
                </div>
                <div class="music-error" id="music-error" style="display:none;"></div>

                <div class="music-debug" style="flex: 1; min-height: 80px; display: flex; flex-direction: column;">
                    <div class="music-debug-header">
                        <span>调试日志</span>
                        <div class="music-debug-actions">
                            <button id="music-debug-copy" type="button">复制</button>
                            <button id="music-debug-clear" type="button">清空</button>
                        </div>
                    </div>
                    <div class="music-debug-log" id="music-debug-log" style="flex: 1;"></div>
                </div>

                <div class="music-now-playing">
                    <div class="music-cover-placeholder" id="music-cover-area">
                        <i class="fas fa-music"></i>
                    </div>
                    <div class="music-info">
                        <div class="music-title" id="music-title">未在播放</div>
                        <div class="music-artist" id="music-artist">搜索歌曲开始播放</div>
                        <span class="music-quality-tag" id="music-quality-tag" style="display:none;"></span>
                    </div>
                </div>

                <div class="music-progress">
                    <div class="music-progress-bar" id="music-progress-bar">
                        <div class="music-progress-fill" id="music-progress-fill"></div>
                    </div>
                    <div class="music-time">
                        <span id="music-time-current">0:00</span>
                        <span id="music-time-total">0:00</span>
                    </div>
                </div>

                <div class="music-controls">
                    <button id="music-prev" title="上一首"><i class="fas fa-step-backward"></i></button>
                    <button class="play-btn" id="music-play" title="播放/暂停"><i class="fas fa-play"></i></button>
                    <button id="music-next" title="下一首"><i class="fas fa-step-forward"></i></button>
                </div>

                <div class="music-volume">
                    <button id="music-volume-btn"><i class="fas fa-volume-up"></i></button>
                    <input type="range" id="music-volume-slider" min="0" max="100" value="70" />
                </div>
            </div>
        `;
        document.body.appendChild(panel);
        initPanelDragAndResize(panel);
    }

    function bindElements() {
        panelEl = document.getElementById('music-panel');
        toggleBtn = document.getElementById('music-toggle-btn');
        coverEl = document.getElementById('music-cover-area');
        titleEl = document.getElementById('music-title');
        artistEl = document.getElementById('music-artist');
        qualityEl = document.getElementById('music-quality-tag');
        progressFill = document.getElementById('music-progress-fill');
        timeCurrentEl = document.getElementById('music-time-current');
        timeTotalEl = document.getElementById('music-time-total');
        playBtn = document.getElementById('music-play');
        volumeSlider = document.getElementById('music-volume-slider');
        volumeBtn = document.getElementById('music-volume-btn');
        playlistContainer = document.getElementById('music-playlist');
        playlistTabsEl = document.getElementById('music-playlist-tabs');
        clearTabBtn = document.getElementById('music-clear-tab');
        clearAllTabsBtn = document.getElementById('music-clear-all');
        searchInput = document.getElementById('music-search-input');
        functionSelect = document.getElementById('music-function');
        platformSelect = document.getElementById('music-platform');
        qualitySelect = document.getElementById('music-quality');
        searchBtn = document.getElementById('music-search-btn');
        pageInput = document.getElementById('music-page');
        pageSizeInput = document.getElementById('music-page-size');
        searchExtraRow = document.getElementById('music-search-extra-row');
        apikeyInput = document.getElementById('music-apikey-input');
        apikeySaveBtn = document.getElementById('music-apikey-save');
        apikeyStatus = document.getElementById('music-apikey-status');
        loadingEl = document.getElementById('music-loading');
        errorEl = document.getElementById('music-error');
        toplistPresetEl = document.getElementById('music-toplist-presets');
        debugLogEl = document.getElementById('music-debug-log');
        debugCopyBtn = document.getElementById('music-debug-copy');
        debugClearBtn = document.getElementById('music-debug-clear');
        authModalEl = document.getElementById('music-auth-modal');
        authModalInput = document.getElementById('music-auth-input');
        authModalConfirm = document.getElementById('music-auth-confirm');
        authModalCancel = document.getElementById('music-auth-cancel');
    }

    function bindEvents() {
        // Toggle panel
        toggleBtn.addEventListener('click', () => {
            panelEl.classList.toggle('show');
        });
        document.getElementById('music-close').addEventListener('click', () => {
            panelEl.classList.remove('show');
        });

        // API Key
        apikeySaveBtn.addEventListener('click', saveApiKey);
        apikeyInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveApiKey();
        });

        // Auth Modal
        authModalConfirm.addEventListener('click', () => {
            if (currentAuthResolve) {
                currentAuthResolve(authModalInput.value);
            }
        });
        authModalCancel.addEventListener('click', () => {
            if (currentAuthResolve) {
                currentAuthResolve(null);
            }
        });
        authModalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && currentAuthResolve) {
                currentAuthResolve(authModalInput.value);
            }
            if (e.key === 'Escape' && currentAuthResolve) {
                currentAuthResolve(null);
            }
        });

        // Search
        searchBtn.addEventListener('click', doSearch);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doSearch();
        });
        functionSelect.addEventListener('change', updateSearchUI);
        platformSelect.addEventListener('change', updateSearchUI);
        if (playlistTabsEl) {
            playlistTabsEl.addEventListener('click', (e) => {
                const btn = e.target.closest('.music-playlist-tab');
                if (!btn) return;
                const tab = btn.getAttribute('data-tab') || 'history';
                setActivePlaylistTab(tab);
            });
        }
        if (clearTabBtn) {
            clearTabBtn.addEventListener('click', clearActivePlaylistTab);
        }
        if (clearAllTabsBtn) {
            clearAllTabsBtn.addEventListener('click', clearAllPlaylistTabs);
        }
        pageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doSearch();
        });
        pageSizeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doSearch();
        });
        debugCopyBtn.addEventListener('click', copyDebugLogs);
        debugClearBtn.addEventListener('click', clearDebugLogs);

        // Playback controls
        playBtn.addEventListener('click', togglePlay);
        document.getElementById('music-prev').addEventListener('click', playPrev);
        document.getElementById('music-next').addEventListener('click', playNext);

        // Progress bar
        document.getElementById('music-progress-bar').addEventListener('click', seekTo);

        // Volume
        volumeSlider.addEventListener('input', (e) => {
            audio.volume = e.target.value / 100;
            updateVolumeIcon();
        });
        volumeBtn.addEventListener('click', toggleMute);

        // Audio events
        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('ended', playNext);
        audio.addEventListener('play', () => {
            isPlaying = true;
            playBtn.innerHTML = '<i class="fas fa-pause"></i>';
            toggleBtn.classList.add('playing');
        });
        audio.addEventListener('pause', () => {
            isPlaying = false;
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            toggleBtn.classList.remove('playing');
        });
        audio.addEventListener('error', () => {
            showError('音频加载失败，可能链接已过期');
        });
    }

    function renderPlaylistTabs() {
        if (!playlistTabsEl) return;
        playlistTabsEl.innerHTML = PLAYLIST_TABS.map(item => {
            const count = getBucket(item.key).length;
            const active = item.key === activePlaylistTab ? ' active' : '';
            return `<button class="music-playlist-tab${active}" data-tab="${item.key}">${item.label}<span class="music-playlist-tab-count">${count}</span></button>`;
        }).join('');
    }

    // ---- Drag & Resize ----
    function initPanelDragAndResize(panel) {
        const header = panel.querySelector('#music-panel-header');
        let isDragging = false;
        let isResizing = false;
        let startX, startY;
        let startLeft, startTop, startWidth, startHeight;
        let currentResizer = null;

        // Dragging
        [header, panel.querySelector('.music-playlist-header')].forEach(handle => {
            if (!handle) return;
            handle.addEventListener('mousedown', (e) => {
                if (e.target.closest('button')) return;
                isDragging = true;
                const rect = panel.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;
                startX = e.clientX;
                startY = e.clientY;
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
                panel.style.left = startLeft + 'px';
                panel.style.top = startTop + 'px';
                panel.style.transition = 'none';
            });
        });

        // Resizing
        panel.querySelectorAll('.music-panel-resizer').forEach(resizer => {
            resizer.addEventListener('mousedown', (e) => {
                e.preventDefault();
                isResizing = true;
                currentResizer = resizer;
                const rect = panel.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;
                startWidth = rect.width;
                startHeight = rect.height;
                startX = e.clientX;
                startY = e.clientY;
                panel.style.right = 'auto';
                panel.style.bottom = 'auto';
                panel.style.left = startLeft + 'px';
                panel.style.top = startTop + 'px';
                panel.style.transition = 'none';
            });
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                panel.style.left = (startLeft + dx) + 'px';
                panel.style.top = (startTop + dy) + 'px';
            } else if (isResizing && currentResizer) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                let newWidth = startWidth;
                let newHeight = startHeight;
                let newLeft = startLeft;
                let newTop = startTop;

                const isRight = currentResizer.classList.contains('music-panel-resizer-right') || currentResizer.classList.contains('music-panel-resizer-top-right') || currentResizer.classList.contains('music-panel-resizer-bottom-right');
                const isLeft = currentResizer.classList.contains('music-panel-resizer-left') || currentResizer.classList.contains('music-panel-resizer-top-left') || currentResizer.classList.contains('music-panel-resizer-bottom-left');
                const isBottom = currentResizer.classList.contains('music-panel-resizer-bottom') || currentResizer.classList.contains('music-panel-resizer-bottom-left') || currentResizer.classList.contains('music-panel-resizer-bottom-right');
                const isTop = currentResizer.classList.contains('music-panel-resizer-top') || currentResizer.classList.contains('music-panel-resizer-top-left') || currentResizer.classList.contains('music-panel-resizer-top-right');

                if (isRight) newWidth = startWidth + dx;
                if (isLeft) {
                    newWidth = startWidth - dx;
                    newLeft = startLeft + dx;
                }
                if (isBottom) newHeight = startHeight + dy;
                if (isTop) {
                    newHeight = startHeight - dy;
                    newTop = startTop + dy;
                }

                // Enforce min sizes
                const minWidth = 700;
                const minHeight = 480;
                if (newWidth < minWidth) {
                    if (isLeft) newLeft = startLeft + startWidth - minWidth;
                    newWidth = minWidth;
                }
                if (newHeight < minHeight) {
                    if (isTop) newTop = startTop + startHeight - minHeight;
                    newHeight = minHeight;
                }

                panel.style.width = newWidth + 'px';
                panel.style.height = newHeight + 'px';
                panel.style.left = newLeft + 'px';
                panel.style.top = newTop + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            isResizing = false;
            currentResizer = null;
        });
    }

    // ---- API Key ----
    async function loadApiKey() {
        const key = localStorage.getItem(STORAGE_KEY);
        if (key) {
            apikeyInput.value = key;
            apikeyStatus.textContent = '✓ 已读取本地 API Key';
            apikeyStatus.className = 'apikey-status ok';
        }

        try {
            const resp = await fetch(MUSIC_APIKEY_STATUS_ENDPOINT);
            const data = await resp.json();
            if (resp.ok && data.configured) {
                apikeyStatus.textContent = '✓ 服务端 API Key 已配置（跨端可用）';
                apikeyStatus.className = 'apikey-status ok';
                appendDebug('info', '检测到服务端 API Key 已配置');
            } else if (resp.ok) {
                apikeyStatus.textContent = '未检测到服务端 API Key，请先保存';
                apikeyStatus.className = 'apikey-status';
            }
        } catch (e) {
            appendDebug('warn', '获取服务端 API Key 状态失败', { message: e && e.message ? e.message : String(e) });
        }
    }

    function promptForAdminPassword() {
        return new Promise(resolve => {
            currentAuthResolve = (val) => {
                resolve(val);
                closeAuthModal();
            };
            authModalInput.value = '';
            authModalEl.style.display = 'flex';
            setTimeout(() => {
                authModalEl.classList.add('show');
                authModalInput.focus();
            }, 10);
        });
    }

    function closeAuthModal() {
        authModalEl.classList.remove('show');
        setTimeout(() => {
            authModalEl.style.display = 'none';
            currentAuthResolve = null;
        }, 300);
    }

    function tryParseRawPayload(raw) {
        if (!raw || typeof raw !== 'string') return null;
        const text = raw.trim();
        if (!text) return null;

        // 优先尝试完整 JSON
        try {
            return JSON.parse(text);
        } catch (e) {}

        // 兼容 JSONP: callback({...})
        const jsonpMatch = text.match(/^[\w$]+\s*\((.*)\)\s*;?$/s);
        if (jsonpMatch && jsonpMatch[1]) {
            try {
                return JSON.parse(jsonpMatch[1]);
            } catch (e) {}
        }

        // 兼容旧式 JS 对象：try{var jsondata={...}; ...}
        const jsObjMatch = text.match(/jsondata\s*=\s*(\{[\s\S]*\})\s*;?/i);
        if (jsObjMatch && jsObjMatch[1]) {
            try {
                // eslint-disable-next-line no-new-func
                const parsed = new Function('return (' + jsObjMatch[1] + ');')();
                if (parsed && typeof parsed === 'object') {
                    return parsed;
                }
            } catch (e) {}
        }

        // 兜底提取首个 JSON 对象/数组片段
        const startObj = text.indexOf('{');
        const startArr = text.indexOf('[');
        const starts = [startObj, startArr].filter(i => i >= 0).sort((a, b) => a - b);
        if (starts.length === 0) return null;
        const start = starts[0];
        const endObj = text.lastIndexOf('}');
        const endArr = text.lastIndexOf(']');
        const end = Math.max(endObj, endArr);
        if (end <= start) return null;

        const fragment = text.slice(start, end + 1);
        try {
            return JSON.parse(fragment);
        } catch (e) {
            return null;
        }
    }

    async function saveApiKey() {
        const key = apikeyInput.value.trim();
        if (!key) {
            apikeyStatus.textContent = '请输入有效的 API Key';
            apikeyStatus.className = 'apikey-status';
            return;
        }

        const password = await promptForAdminPassword();
        if (password === null) {
            apikeyStatus.textContent = '已取消保存';
            apikeyStatus.className = 'apikey-status';
            return;
        }
        if (!String(password).trim()) {
            apikeyStatus.textContent = '请输入管理员密码';
            apikeyStatus.className = 'apikey-status';
            return;
        }

        localStorage.setItem(STORAGE_KEY, key);

        try {
            const resp = await fetch(MUSIC_APIKEY_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: key, password: String(password).trim() })
            });

            let data = null;
            try {
                data = await resp.json();
            } catch (e) {}

            if (!resp.ok) {
                const msg = (data && (data.detail || data.message)) || ('HTTP ' + resp.status);
                if (resp.status === 401) {
                    apikeyStatus.textContent = '密码错误，保存失败';
                    apikeyStatus.className = 'apikey-status';
                    appendDebug('error', '服务端 API Key 保存失败：管理员密码错误', { status: resp.status, message: msg });
                    return;
                }
                if (resp.status === 405) {
                    apikeyStatus.textContent = '后端未更新（405），请重启后端服务';
                    apikeyStatus.className = 'apikey-status';
                    appendDebug('error', '服务端 API Key 保存失败：后端接口方法不匹配', { status: resp.status, message: msg });
                    return;
                }
                apikeyStatus.textContent = '保存失败: ' + msg;
                apikeyStatus.className = 'apikey-status';
                appendDebug('error', '服务端 API Key 保存失败', { status: resp.status, message: msg });
                return;
            }

            apikeyStatus.textContent = '✓ 服务端 API Key 已保存（跨端可用）';
            apikeyStatus.className = 'apikey-status ok';
            appendDebug('info', '服务端 API Key 保存成功');
        } catch (e) {
            apikeyStatus.textContent = '网络异常，已仅保存到本地';
            apikeyStatus.className = 'apikey-status';
            appendDebug('warn', '服务端 API Key 保存请求失败，已本地保存', { message: e && e.message ? e.message : String(e) });
        }
    }

    // ---- Search / Parse ----
    function updateSearchUI() {
        const method = functionSelect.value;
        const isSearch = method === 'search';
        const isToplists = method === 'toplists';

        searchExtraRow.style.display = isSearch ? 'flex' : 'none';
        searchInput.disabled = isToplists;
        if (isToplists) searchInput.value = '';

        const placeholderMap = {
            parse: '输入歌曲ID，多个用逗号分隔',
            search: '输入关键词，如：周杰伦',
            toplists: '排行榜列表无需输入',
            toplist: '输入排行榜ID',
            playlist: '输入歌单ID'
        };
        searchInput.placeholder = placeholderMap[method] || '请输入内容';
        searchBtn.textContent = getActionLabel(method);
        renderToplistPresets();
    }

    function renderToplistPresets() {
        if (!toplistPresetEl) return;

        const method = functionSelect.value;
        const shouldShow = method === 'search' || method === 'toplist' || method === 'toplists';
        if (!shouldShow) {
            toplistPresetEl.style.display = 'none';
            toplistPresetEl.innerHTML = '';
            return;
        }

        const platform = platformSelect.value;
        const presets = TOPLIST_PRESETS[platform] || [];
        if (presets.length === 0) {
            toplistPresetEl.style.display = 'none';
            toplistPresetEl.innerHTML = '';
            return;
        }

        toplistPresetEl.style.display = 'block';
        toplistPresetEl.innerHTML = `
            <div class="music-toplist-title">内置排行榜</div>
            <div class="music-toplist-chips">
                ${presets.map(item => `<button class="music-toplist-chip" data-id="${escapeHtml(String(item.id))}" data-name="${escapeHtml(item.name)}">${escapeHtml(item.name)}</button>`).join('')}
            </div>
        `;

        toplistPresetEl.querySelectorAll('.music-toplist-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id') || '';
                const name = btn.getAttribute('data-name') || '';
                if (!id) return;
                functionSelect.value = 'toplist';
                updateSearchUI();
                searchInput.value = id;
                pageInput.value = '1';
                appendDebug('info', '点击内置排行榜', { platform: platformSelect.value, id, name });
                doSearch();
            });
        });
    }

    function getActionLabel(method) {
        const labelMap = {
            parse: '解析',
            search: '搜索',
            toplists: '获取榜单',
            toplist: '查询榜单',
            playlist: '查询歌单'
        };
        return labelMap[method] || '执行';
    }

    async function doSearch() {
        const method = functionSelect.value;
        const query = searchInput.value.trim();
        if (method !== 'toplists' && !query) {
            showError('请输入必要参数');
            return;
        }

        const platform = platformSelect.value;
        const quality = qualitySelect.value;
        const page = Math.max(1, parseInt(pageInput.value, 10) || 1);
        const pageSize = Math.min(50, Math.max(1, parseInt(pageSizeInput.value, 10) || 10));
        const actionLabel = getActionLabel(method);
        const requestId = ++searchRequestSeq;

        appendDebug('info', '开始请求', {
            requestId,
            method,
            platform,
            quality,
            query,
            page,
            pageSize
        });

        searchBtn.disabled = true;
        searchBtn.textContent = actionLabel + '中...';
        loadingEl.style.display = 'block';
        errorEl.style.display = 'none';

        try {
            let songs = [];

            if (method === 'parse') {
                const parseData = await callTuneHub({ platform, ids: query, quality });
                songs = normalizeSongsFromResponse(parseData, platform, quality);
                appendDebug('info', '解析完成', { requestId, songs: songs.length });

                if (songs.length === 0 && !isLikelyIdQuery(query)) {
                    appendDebug('warn', '解析模式未命中且输入像关键词，自动走搜索兜底', {
                        requestId,
                        query,
                        platform,
                        page,
                        pageSize
                    });
                    const functionData = await callTuneHubFunction('search', query, page, pageSize, platform, quality);
                    songs = await resolveMethodSongs(functionData, 'search', platform, quality, query, page, pageSize);
                    appendDebug('info', '搜索兜底完成', { requestId, songs: songs.length });
                }
            } else {
                const functionData = await callTuneHubFunction(method, query, page, pageSize, platform, quality);
                appendDebug('info', '函数调用完成', {
                    requestId,
                    method,
                    dataKeys: Object.keys((functionData && functionData.data) || {}).slice(0, 12)
                });

                if (method === 'toplists') {
                    const toplistIds = extractIdList(functionData, platform);
                    if (toplistIds.length > 0) {
                        functionSelect.value = 'toplist';
                        updateSearchUI();
                        searchInput.value = toplistIds[0];
                        showNotice('已获取排行榜列表，已填入首个榜单ID，可继续查询榜单歌曲');
                    }
                }

                songs = await resolveMethodSongs(functionData, method, platform, quality, query, page, pageSize);
                appendDebug('info', '结果处理完成', { requestId, method, songs: songs.length });
            }

            if (songs.length === 0) {
                appendDebug('warn', '未获取到可播放歌曲', { requestId, method });
                showError('没有获取到可播放歌曲');
                return;
            }

            const targetTab = resolveTargetPlaylistTab(method, platform, query);
            if (activePlaylistTab !== targetTab) {
                setActivePlaylistTab(targetTab);
            }

            const firstNew = mergeSongsToPlaylist(songs, targetTab);
            savePlaylist();
            renderPlaylistTabs();
            renderPlaylist();
            if (firstNew >= 0) playSong(firstNew);

            errorEl.style.display = 'none';
        } catch (err) {
            appendDebug('error', '请求失败', {
                requestId,
                message: err && err.message,
                stack: err && err.stack ? String(err.stack).split('\n').slice(0, 3).join(' | ') : ''
            });
            showError('请求失败: ' + (err.message || '网络错误'));
        } finally {
            searchBtn.disabled = false;
            searchBtn.textContent = getActionLabel(functionSelect.value);
            loadingEl.style.display = 'none';
        }
    }

    function replaceTemplateVars(obj, vars) {
        if (typeof obj === 'string') {
            return obj.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, expr) => {
                const value = evaluateTemplateExpression(expr, vars);
                return value === undefined || value === null ? '' : String(value);
            });
        }
        if (Array.isArray(obj)) {
            return obj.map(item => replaceTemplateVars(item, vars));
        }
        if (obj && typeof obj === 'object') {
            const result = {};
            Object.keys(obj).forEach(key => {
                result[key] = replaceTemplateVars(obj[key], vars);
            });
            return result;
        }
        return obj;
    }

    function evaluateTemplateExpression(expr, vars) {
        const raw = String(expr || '').trim();
        if (!raw) return '';

        // 纯变量名直接取值
        if (/^[a-zA-Z0-9_]+$/.test(raw)) {
            return Object.prototype.hasOwnProperty.call(vars, raw) ? vars[raw] : '';
        }

        // 表达式计算（如 page || 1 / (page || 1) - 1）
        try {
            // eslint-disable-next-line no-new-func
            const fn = new Function('vars', 'with(vars){ return (' + raw + '); }');
            return fn(vars || {});
        } catch (e) {
            return '';
        }
    }

    function isLikelyIdQuery(query) {
        if (!query || typeof query !== 'string') return false;
        const parts = query
            .split(/[，,\s]+/)
            .map(s => s.trim())
            .filter(Boolean);
        if (parts.length === 0) return false;

        return parts.every(part => {
            if (/^\d{3,}$/.test(part)) return true;
            return /^[a-zA-Z0-9_-]{6,}$/.test(part);
        });
    }

    async function callTuneHubFunction(method, query, page, pageSize, platform, quality) {
        const methodsUrl = TUNEHUB_METHODS_BASE + '/' + platform + '/' + method;
        appendDebug('info', '获取 Methods 配置', { methodsUrl, method, platform });
        const configResp = await fetch(methodsUrl, { method: 'GET' });

        const configText = await configResp.text();
        let configData = null;
        if (configText) {
            try {
                configData = JSON.parse(configText);
            } catch (e) {
                appendDebug('error', 'Methods 配置返回非 JSON', {
                    status: configResp.status,
                    contentType: configResp.headers.get('content-type') || '',
                    bodyPreview: configText.slice(0, 160)
                });
                if (!configResp.ok) {
                    throw new Error('Methods 接口异常: HTTP ' + configResp.status);
                }
                throw new Error('方法配置响应不是有效 JSON');
            }
        }

        if (!configResp.ok) {
            appendDebug('error', 'Methods 配置获取失败', { status: configResp.status, body: configData });
            throw new Error((configData && (configData.message || configData.detail)) || ('HTTP ' + configResp.status));
        }
        if (!configData || typeof configData !== 'object') {
            throw new Error('方法配置响应为空');
        }
        if (configData.code !== undefined && configData.code !== 0) {
            appendDebug('error', 'Methods 配置返回异常 code', configData);
            throw new Error(configData.message || '获取方法配置失败');
        }

        const config = configData.data;
        if (!config || !config.url) {
            throw new Error('该平台暂不支持此功能');
        }

        const vars = {
            keyword: query || '',
            page: String(Math.max(1, page)),
            pageSize: String(pageSize),
            limit: String(pageSize),
            offset: String((Math.max(1, page) - 1) * pageSize),
            id: query || ''
        };
        const processedConfig = replaceTemplateVars(config, vars);
        appendDebug('info', 'Methods 配置解析完成', {
            url: processedConfig.url,
            method: processedConfig.method || 'GET',
            hasTransform: Boolean(config.transform)
        });

        const proxyPayload = {
            url: processedConfig.url,
            method: processedConfig.method || 'GET',
            headers: processedConfig.headers || {},
            params: processedConfig.params || {},
            body: processedConfig.body || null
        };

        const proxyResp = await fetch(MUSIC_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(proxyPayload)
        });

        appendDebug('info', '代理请求完成', {
            status: proxyResp.status,
            ok: proxyResp.ok,
            target: processedConfig.url
        });

        if (!proxyResp.ok) {
            let errMsg = '代理请求失败: HTTP ' + proxyResp.status;
            try {
                const errData = await proxyResp.json();
                if (errData.detail) errMsg = errData.detail;
            } catch (e) {}
            throw new Error(errMsg);
        }

        let responseData = await proxyResp.json();

        if (responseData && typeof responseData === 'object' && typeof responseData._raw === 'string') {
            const recovered = tryParseRawPayload(responseData._raw);
            appendDebug('warn', '代理返回原始文本，尝试恢复 JSON', {
                status: responseData._status,
                recovered: Boolean(recovered),
                rawPreview: responseData._raw.slice(0, 120)
            });
            if (recovered) {
                responseData = recovered;
            }
        }

        const rawResponseData = responseData;

        if (config.transform) {
            try {
                const fn = new Function('return ' + config.transform)();
                const transformed = fn(responseData);
                if (transformed !== undefined && transformed !== null) {
                    responseData = transformed;
                }
            } catch (e) {}
        }

        if (Array.isArray(responseData) && responseData.length === 0) {
            const rawList = extractPrimaryList(rawResponseData);
            const rawIds = extractIdList({ data: rawResponseData }, platform);
            if (rawList.length > 0 || rawIds.length > 0) {
                appendDebug('warn', 'transform 结果为空，回退到原始响应', {
                    rawListCount: rawList.length,
                    rawIdCount: rawIds.length,
                    rawShape: summarizePayload(rawResponseData, 2)
                });
                responseData = rawResponseData;
            }
        }

        appendDebug('info', '函数响应预览', {
            kind: Array.isArray(responseData) ? 'array' : typeof responseData,
            keys: responseData && typeof responseData === 'object' ? Object.keys(responseData).slice(0, 12) : [],
            shape: summarizePayload(responseData, 2)
        });

        return { data: responseData };
    }

    function splitParseIds(ids) {
        if (Array.isArray(ids)) {
            return ids.map(item => String(item || '').trim()).filter(Boolean);
        }
        if (ids === undefined || ids === null) return [];
        return String(ids)
            .split(/[，,\s]+/)
            .map(item => item.trim())
            .filter(Boolean);
    }

    function mergeParseBatchResponses(batchResponses) {
        if (!Array.isArray(batchResponses) || batchResponses.length === 0) {
            return { data: { data: [], total: 0, success_count: 0, fail_count: 0, cache_hit_count: 0, cost: 0 } };
        }

        const merged = {
            data: [],
            total: 0,
            success_count: 0,
            fail_count: 0,
            cache_hit_count: 0,
            cost: 0
        };

        batchResponses.forEach(resp => {
            const root = resp && (resp.data || resp);
            const list = Array.isArray(root && root.data) ? root.data : [];
            merged.data = merged.data.concat(list);
            merged.total += Number((root && root.total) || list.length || 0);
            merged.success_count += Number((root && root.success_count) || list.filter(item => item && item.success !== false).length || 0);
            merged.fail_count += Number((root && root.fail_count) || list.filter(item => item && item.success === false).length || 0);
            merged.cache_hit_count += Number((root && root.cache_hit_count) || 0);
            merged.cost += Number((root && root.cost) || 0);
        });

        const first = batchResponses[0];
        if (first && typeof first === 'object' && Object.prototype.hasOwnProperty.call(first, 'data')) {
            return Object.assign({}, first, { data: merged });
        }
        return merged;
    }

    async function callTuneHubSingle(payload, idsCsv, batchInfo) {
        appendDebug('info', '调用 Parse API', {
            platform: payload && payload.platform,
            quality: payload && payload.quality,
            idsPreview: idsCsv ? String(idsCsv).split(',').slice(0, 6) : [],
            batch: batchInfo ? (batchInfo.index + '/' + batchInfo.total) : ''
        });

        const requestPayload = Object.assign({}, payload, { ids: idsCsv });
        const resp = await fetch(TUNEHUB_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload)
        });

        let data;
        try {
            data = await resp.json();
        } catch (e) {
            throw new Error('服务响应不是有效 JSON');
        }

        if (!resp.ok) {
            appendDebug('error', 'Parse API 请求失败', { status: resp.status, body: data });
            throw new Error((data && (data.message || data.detail)) || ('HTTP ' + resp.status));
        }
        if (Object.prototype.hasOwnProperty.call(data, 'code') && data.code !== 0) {
            appendDebug('error', 'Parse API 返回 code 非 0', data);
            throw new Error(data.message || '请求失败');
        }
        appendDebug('info', 'Parse API 成功', {
            code: data.code,
            hasData: Boolean(data.data)
        });
        return data;
    }

    async function callNeteaseToplistFallback(toplistId) {
        const fallbackPayload = {
            url: 'https://music.163.com/api/v6/playlist/detail',
            method: 'GET',
            params: {
                id: String(toplistId || '').trim(),
                n: '1000',
                s: '8'
            },
            headers: {
                Referer: 'https://music.163.com/',
                'User-Agent': 'Mozilla/5.0'
            }
        };

        const resp = await fetch(MUSIC_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fallbackPayload)
        });

        appendDebug('info', '网易云榜单兜底请求完成', { status: resp.status, ok: resp.ok });

        if (!resp.ok) {
            throw new Error('网易云榜单兜底失败: HTTP ' + resp.status);
        }

        let data = await resp.json();
        if (data && typeof data === 'object' && typeof data._raw === 'string') {
            const recovered = tryParseRawPayload(data._raw);
            if (recovered) data = recovered;
        }

        appendDebug('info', '网易云榜单兜底响应预览', {
            shape: summarizePayload(data, 2)
        });

        return data;
    }

    async function callTuneHub(payload) {
        const ids = splitParseIds(payload && payload.ids);
        if (ids.length <= PARSE_BATCH_LIMIT) {
            const idsCsv = ids.length > 0 ? ids.join(',') : String((payload && payload.ids) || '');
            return callTuneHubSingle(payload, idsCsv);
        }

        const batchCount = Math.ceil(ids.length / PARSE_BATCH_LIMIT);
        appendDebug('warn', 'Parse ID 数量超出限制，自动分批请求', {
            idCount: ids.length,
            batchLimit: PARSE_BATCH_LIMIT,
            batchCount
        });

        const batchResponses = [];
        for (let i = 0; i < batchCount; i++) {
            const chunk = ids.slice(i * PARSE_BATCH_LIMIT, (i + 1) * PARSE_BATCH_LIMIT);
            const chunkResp = await callTuneHubSingle(payload, chunk.join(','), { index: i + 1, total: batchCount });
            batchResponses.push(chunkResp);
        }

        const merged = mergeParseBatchResponses(batchResponses);
        const mergedRoot = merged && (merged.data || merged);
        appendDebug('info', 'Parse 分批请求合并完成', {
            total: mergedRoot && mergedRoot.total,
            success_count: mergedRoot && mergedRoot.success_count,
            fail_count: mergedRoot && mergedRoot.fail_count
        });
        return merged;
    }

    async function callKuwoSearchFallback(keyword, page, pageSize) {
        const fallbackPayload = {
            url: 'http://search.kuwo.cn/r.s',
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0'
            },
            params: {
                all: keyword,
                ft: 'music',
                client: 'kt',
                pn: String(Math.max(0, (Math.max(1, Number(page) || 1) - 1))),
                rn: String(pageSize || 20),
                rformat: 'json',
                encoding: 'utf8',
                callback: 'callback'
            }
        };

        const resp = await fetch(MUSIC_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fallbackPayload)
        });

        appendDebug('info', 'Kuwo 搜索兜底请求完成', { status: resp.status, ok: resp.ok });

        if (!resp.ok) {
            throw new Error('Kuwo 搜索兜底失败: HTTP ' + resp.status);
        }

        let data = await resp.json();
        if (data && typeof data === 'object' && typeof data._raw === 'string') {
            const recovered = tryParseRawPayload(data._raw);
            if (recovered) data = recovered;
        }

        appendDebug('info', 'Kuwo 搜索兜底响应预览', {
            shape: summarizePayload(data, 2)
        });

        return data;
    }

    async function callQQSearchFallback(keyword, page, pageSize) {
        const fallbackPayload = {
            url: 'https://c.y.qq.com/soso/fcgi-bin/client_search_cp',
            method: 'GET',
            headers: {
                Referer: 'https://y.qq.com/',
                'User-Agent': 'Mozilla/5.0'
            },
            params: {
                w: keyword,
                p: String(Math.max(1, Number(page) || 1)),
                n: String(pageSize || 20),
                format: 'jsonp',
                callback: 'callback'
            }
        };

        const resp = await fetch(MUSIC_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fallbackPayload)
        });

        appendDebug('info', 'QQ 搜索兜底请求完成', { status: resp.status, ok: resp.ok });

        if (!resp.ok) {
            throw new Error('QQ 搜索兜底失败: HTTP ' + resp.status);
        }

        let data = await resp.json();
        if (data && typeof data === 'object' && typeof data._raw === 'string') {
            const recovered = tryParseRawPayload(data._raw);
            if (recovered) data = recovered;
        }

        appendDebug('info', 'QQ 搜索兜底响应预览', {
            shape: summarizePayload(data, 2)
        });

        return data;
    }

    async function resolveMethodSongs(functionData, method, platform, quality, query, page, pageSize) {
        let songs = normalizeSongsFromResponse(functionData, platform, quality);
        if (songs.length > 0) return songs;

        // 部分 function 只返回歌曲ID，再次走 parse 获取可播放链接
        let ids = extractIdList(functionData, platform);

        if (method === 'search' && platform === 'qq' && ids.length > 0) {
            const beforeCount = ids.length;
            ids = ids.filter(id => !isLikelyQQTraceId(id));
            if (ids.length !== beforeCount) {
                appendDebug('warn', '过滤疑似 traceid 的 QQ 伪歌曲ID', {
                    beforeCount,
                    afterCount: ids.length
                });
            }
        }

        appendDebug('info', '提取待解析歌曲ID', {
            method,
            idCount: ids.length,
            idsPreview: ids.slice(0, 8)
        });

        if (ids.length === 0 && method === 'search' && platform === 'netease' && query) {
            appendDebug('warn', 'Methods 搜索未取到ID，尝试网易云搜索接口兜底', {
                query,
                page,
                pageSize
            });

            const fallbackData = await callNeteaseSearchFallback(query, page, pageSize);
            const fallbackPayload = { data: fallbackData };

            songs = normalizeSongsFromResponse(fallbackPayload, platform, quality);
            if (songs.length > 0) {
                appendDebug('info', '网易云兜底直接返回可播歌曲', { songs: songs.length });
                return songs;
            }

            ids = extractIdList(fallbackPayload, platform);
            appendDebug('info', '网易云兜底提取歌曲ID', {
                idCount: ids.length,
                idsPreview: ids.slice(0, 8)
            });
        }

        if (ids.length === 0 && method === 'toplist' && platform === 'netease' && query) {
            appendDebug('warn', '网易云榜单未提取到ID，尝试 v6 榜单接口兜底', {
                id: query
            });

            const fallbackData = await callNeteaseToplistFallback(query);
            const fallbackPayload = { data: fallbackData };
            ids = extractIdList(fallbackPayload, platform);

            appendDebug('info', '网易云榜单兜底提取歌曲ID', {
                idCount: ids.length,
                idsPreview: ids.slice(0, 8)
            });
        }

        if (method === 'search' && platform === 'qq' && query) {
            appendDebug('warn', 'QQ 搜索优先走 QQ 搜索接口兜底提取真实歌曲ID', {
                query,
                page,
                pageSize
            });

            const fallbackData = await callQQSearchFallback(query, page, pageSize);
            const fallbackPayload = { data: fallbackData };
            const qqFallbackIds = extractIdList(fallbackPayload, platform).filter(id => !isLikelyQQTraceId(id));

            if (qqFallbackIds.length > 0) {
                ids = qqFallbackIds;
            }

            appendDebug('info', 'QQ 兜底提取歌曲ID', {
                idCount: ids.length,
                idsPreview: ids.slice(0, 8)
            });
        }

        if (ids.length === 0 && method === 'search' && platform === 'kuwo' && query) {
            appendDebug('warn', 'Kuwo Methods 搜索未取到ID，尝试 Kuwo 搜索接口兜底', {
                query,
                page,
                pageSize
            });

            const fallbackData = await callKuwoSearchFallback(query, page, pageSize);
            const fallbackPayload = { data: fallbackData };
            ids = extractIdList(fallbackPayload, platform);

            appendDebug('info', 'Kuwo 兜底提取歌曲ID', {
                idCount: ids.length,
                idsPreview: ids.slice(0, 8)
            });
        }

        if (ids.length === 0) {
            appendDebug('warn', '未提取到歌曲ID，响应结构', {
                method,
                shape: summarizePayload(functionData && functionData.data !== undefined ? functionData.data : functionData, 2)
            });
            if (method === 'search') {
                console.warn('[TuneHub] search response without parseable ids', functionData);
                throw new Error('搜索结果里未找到可解析的歌曲ID');
            }
            if (method === 'toplists') return [];
            return [];
        }
        if (method === 'toplists') return [];

        const parseData = await callTuneHub({ platform, ids: ids.join(','), quality });
        songs = normalizeSongsFromResponse(parseData, platform, quality);

        const parseFailure = getParseFailureInfo(parseData);
        if (songs.length === 0 && parseFailure.failCount > 0) {
            throw new Error(parseFailure.firstError || '当前平台歌曲暂不可解析播放');
        }

        return songs;
    }

    function getParseFailureInfo(parseData) {
        const root = parseData && (parseData.data || parseData);
        if (!root || typeof root !== 'object') {
            return { failCount: 0, firstError: '' };
        }

        const list = Array.isArray(root.data) ? root.data : [];
        const failedItems = list.filter(item => item && item.success === false);
        const failCount = Number(root.fail_count || failedItems.length || 0);
        const firstError = (failedItems[0] && (failedItems[0].error || failedItems[0].message)) || '';

        return { failCount, firstError };
    }

    async function callNeteaseSearchFallback(keyword, page, pageSize) {
        const fallbackPayload = {
            url: 'https://music.163.com/api/search/get',
            method: 'GET',
            params: {
                s: keyword,
                type: '1',
                limit: String(pageSize || 10),
                offset: String((Math.max(1, Number(page) || 1) - 1) * (Number(pageSize) || 10))
            },
            headers: {
                Referer: 'https://music.163.com/'
            }
        };

        const resp = await fetch(MUSIC_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fallbackPayload)
        });

        appendDebug('info', '网易云搜索兜底请求完成', { status: resp.status, ok: resp.ok });

        if (!resp.ok) {
            throw new Error('网易云搜索兜底失败: HTTP ' + resp.status);
        }

        let data = await resp.json();
        if (data && typeof data === 'object' && typeof data._raw === 'string') {
            const recovered = tryParseRawPayload(data._raw);
            if (recovered) data = recovered;
        }

        appendDebug('info', '网易云搜索兜底响应预览', {
            shape: summarizePayload(data, 2)
        });

        return data;
    }

    function normalizeSongsFromResponse(payload, fallbackPlatform, fallbackQuality) {
        const root = payload && (payload.data || payload);
        const list = extractPrimaryList(root);
        if (list.length === 0) return [];

        return list
            .map((song, index) => mapSongItem(song, index, fallbackPlatform, fallbackQuality))
            .filter(item => item && item.url);
    }

    function extractPrimaryList(node) {
        if (Array.isArray(node)) return node;
        if (!node || typeof node !== 'object') return [];

        const directKeys = ['data', 'list', 'songs', 'items', 'tracks', 'song', 'songList', 'songlist', 'item_song', 'records', 'rows', 'result', 'toplists', 'toplist', 'playlist', 'body', 'req'];
        const candidates = [];

        for (const key of directKeys) {
            if (Array.isArray(node[key])) {
                candidates.push(node[key]);
            }
        }
        for (const key of directKeys) {
            if (node[key] && typeof node[key] === 'object') {
                const nested = extractPrimaryList(node[key]);
                if (nested.length > 0) {
                    candidates.push(nested);
                }
            }
        }

        // 兜底：当白名单 key 不命中时，递归遍历所有对象键
        if (candidates.length === 0) {
            Object.keys(node).forEach(key => {
                const value = node[key];
                if (value && typeof value === 'object') {
                    const nested = extractPrimaryList(value);
                    if (nested.length > 0) {
                        candidates.push(nested);
                    }
                }
            });
        }

        if (candidates.length === 0) return [];
        candidates.sort((a, b) => scoreSongArray(b) - scoreSongArray(a));
        return candidates[0];
    }

    function scoreSongArray(list) {
        if (!Array.isArray(list) || list.length === 0) return 0;

        let score = 0;
        const sample = list.slice(0, 15);
        sample.forEach(item => {
            if (!item || typeof item !== 'object') return;
            score += 0.2;
            if (pickFirst(item, SONG_ID_KEYS)) score += 2;
            if (item.name || item.songName || item.title) score += 1.5;
            if (item.url || item.playUrl || item.play_url || item.src || item.musicUrl || item.url128 || item.url320) score += 2.5;
            if (item.artist || item.singer || item.artists) score += 1;
            if (item.info && typeof item.info === 'object') {
                if (pickFirst(item.info, SONG_ID_KEYS)) score += 1;
                if (item.info.name || item.info.title) score += 0.8;
                if (item.info.artist || item.info.artists) score += 0.5;
            }
        });

        return score;
    }

    function mapSongItem(song, index, fallbackPlatform, fallbackQuality) {
        if (!song || typeof song !== 'object') return null;

        const info = (song.info && typeof song.info === 'object') ? song.info : {};
        const rawId = pickFirst(song, SONG_ID_KEYS) || pickFirst(info, SONG_ID_KEYS) || (Date.now() + '-' + index);
        const url = song.url || song.playUrl || song.play_url || song.src || song.musicUrl || song.music_url || song.url128 || song.url320 || '';
        const name = song.name || song.songName || song.title || info.name || info.title || ('未知曲目 ' + (index + 1));
        const artist = normalizeArtists(song.artist || song.singer || info.artist || song.artists || info.artists) || '未知歌手';
        const album = song.album || song.albumName || song.al || info.album || '';
        const durationRaw = song.duration || info.duration || song.dt || 0;
        const cover = song.cover || song.pic || song.picUrl || info.picUrl || '';

        return {
            id: String(rawId),
            name,
            artist,
            album,
            duration: normalizeDuration(durationRaw),
            url,
            cover,
            quality: song.actualQuality || song.quality || fallbackQuality || '',
            lyrics: song.lyrics || song.lrc || '',
            platform: song.platform || fallbackPlatform
        };
    }

    function normalizeArtists(value) {
        if (!value) return '';
        if (Array.isArray(value)) {
            return value.map(v => {
                if (typeof v === 'string') return v;
                if (v && typeof v === 'object') return v.name || v.artist || '';
                return '';
            }).filter(Boolean).join(' / ');
        }
        if (typeof value === 'object') {
            return value.name || value.artist || '';
        }
        return String(value);
    }

    function normalizeDuration(value) {
        const n = Number(value || 0);
        if (!n || isNaN(n)) return 0;
        return n > 10000 ? Math.round(n / 1000) : Math.round(n);
    }

    function extractIdList(payload, platform) {
        const root = payload && (payload.data || payload);
        const list = extractPrimaryList(root);
        const platformIdKeys = getPlatformIdKeys(platform);
        const ids = [];
        list.forEach(item => {
            if (typeof item === 'string' || typeof item === 'number') {
                appendPossibleIds(item, ids);
                return;
            }
            if (!item || typeof item !== 'object') return;
            const id = pickFirst(item, platformIdKeys) || (item.info && pickFirst(item.info, platformIdKeys));
            if (id !== undefined && id !== null && id !== '') {
                appendPossibleIds(id, ids);
            }
        });

        // 兜底：深度遍历抓取可能的歌曲ID字段
        if (ids.length === 0) {
            collectDeepIds(root, ids, '', platformIdKeys);
        }

        return [...new Set(ids)];
    }

    function collectDeepIds(node, out, parentKey, idKeys) {
        if (!node) return;
        if (Array.isArray(node)) {
            if (isLikelyIdKey(parentKey)) {
                node.forEach(value => {
                    if ((typeof value === 'string' || typeof value === 'number') && isLikelyIdValue(value)) {
                        out.push(String(value));
                    }
                });
            }
            node.forEach(n => collectDeepIds(n, out, parentKey, idKeys));
            return;
        }
        if (typeof node !== 'object') return;

        const id = pickFirst(node, idKeys || SONG_ID_KEYS);
        if (id !== undefined && id !== null && id !== '') {
            appendPossibleIds(id, out);
        }

        Object.keys(node).forEach(k => {
            const value = node[k];
            if (isLikelyIdKey(k)) {
                appendPossibleIds(value, out);
            }
            collectDeepIds(value, out, k, idKeys);
        });
    }

    function getPlatformIdKeys(platform) {
        const p = String(platform || '').toLowerCase();
        if (p === 'qq') {
            return ['mid', 'songmid', 'songMid', 'media_mid', 'mediaMid', 'songId', 'songid', 'id'];
        }
        if (p === 'kuwo') {
            return ['rid', 'musicrid', 'musicRid', 'songId', 'songid', 'id', 'mid'];
        }
        return SONG_ID_KEYS;
    }

    function isLikelyIdKey(key) {
        if (typeof key !== 'string') return false;
        const lower = key.toLowerCase();
        if (lower === 'traceid' || lower === 'trace_id' || lower.endsWith('traceid')) return false;
        if (lower === 'start_ts' || lower === 'ts' || lower === 'timestamp') return false;
        if (lower === 'code' || lower === 'msg' || lower === 'message') return false;
        return /(^|_)(id|mid|rid|hash)(s)?$/.test(lower) || /(song|track|music).*(id|mid|rid|hash)/.test(lower);
    }

    function isLikelyIdValue(value) {
        const str = String(value || '').trim();
        if (!str) return false;
        if (/^\d{3,}$/.test(str)) return true;
        return /^[a-zA-Z0-9_-]{8,}$/.test(str);
    }

    function isLikelyQQTraceId(id) {
        const str = String(id || '').trim();
        return /^[a-f0-9]{16}$/i.test(str);
    }

    function appendPossibleIds(value, out) {
        if (value === undefined || value === null || value === '') return;
        if (Array.isArray(value)) {
            value.forEach(v => appendPossibleIds(v, out));
            return;
        }
        if (typeof value === 'number') {
            const raw = String(value);
            if (isLikelyIdValue(raw)) out.push(raw);
            return;
        }
        if (typeof value !== 'string') return;

        const raw = value.trim();
        if (!raw) return;

        // 兼容 JSON 字符串数组："[\"123\",\"456\"]"
        if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('{') && raw.endsWith('}'))) {
            try {
                const parsed = JSON.parse(raw);
                appendPossibleIds(parsed, out);
                return;
            } catch (e) {
                // ignore parse error and continue fallback parsing
            }
        }

        // 兼容 "123,456" / "123|456" / "123 456" 这类返回
        const chunks = /[,|;\s]/.test(raw)
            ? raw.split(/[,|;\s]+/).map(s => s.trim()).filter(Boolean)
            : [raw];

        chunks.forEach(chunk => {
            const normalized = chunk.replace(/[\[\]"'`]/g, '');
            if (isLikelyIdValue(normalized)) {
                out.push(normalized);
            }
        });
    }

    function pickFirst(obj, keys) {
        if (!obj || typeof obj !== 'object') return '';
        for (const key of keys) {
            if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
                return obj[key];
            }
        }
        return '';
    }

    function resolveTargetPlaylistTab(method, platform, query) {
        if (method === 'search') return 'history';
        if (method === 'toplist') {
            const presets = TOPLIST_PRESETS[platform] || [];
            const matched = presets.find(item => String(item.id) === String(query || '').trim());
            if (matched && matched.name) {
                if (matched.name.indexOf('热歌榜') >= 0) return 'hot';
                if (matched.name.indexOf('新歌榜') >= 0) return 'new';
            }
        }
        return activePlaylistTab;
    }

    function getSongToken(song) {
        if (!song || !song.id) return '';
        return String(song.id) + '::' + String(song.platform || '');
    }

    function hasSongInAnyBucket(token) {
        if (!token) return false;
        return PLAYLIST_TABS.some(item => getBucket(item.key).some(song => getSongToken(song) === token));
    }

    function resetPlaybackState() {
        currentIndex = -1;
        currentSongToken = '';
        audio.pause();
        audio.removeAttribute('src');
        titleEl.textContent = '未在播放';
        artistEl.textContent = '搜索歌曲开始播放';
        qualityEl.style.display = 'none';
        timeCurrentEl.textContent = '0:00';
        timeTotalEl.textContent = '0:00';
        progressFill.style.width = '0%';
        coverEl.className = 'music-cover-placeholder';
        coverEl.innerHTML = '<i class="fas fa-music"></i>';
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        toggleBtn.classList.remove('playing');
    }

    function clearActivePlaylistTab() {
        const bucket = getBucket(activePlaylistTab);
        if (bucket.length === 0) {
            showNotice('当前标签已经是空的');
            return;
        }

        bucket.length = 0;
        playlist = bucket;

        if (currentSongToken && !hasSongInAnyBucket(currentSongToken)) {
            resetPlaybackState();
        } else {
            currentIndex = -1;
        }

        savePlaylist();
        renderPlaylistTabs();
        renderPlaylist();
        showNotice('已清空当前标签');
    }

    function clearAllPlaylistTabs() {
        let total = 0;
        PLAYLIST_TABS.forEach(item => {
            const bucket = getBucket(item.key);
            total += bucket.length;
            playlistBuckets[item.key] = [];
        });

        if (total === 0) {
            showNotice('当前没有可清空的数据');
            return;
        }

        playlist = getBucket(activePlaylistTab);
        resetPlaybackState();
        savePlaylist();
        renderPlaylistTabs();
        renderPlaylist();
        showNotice('已清空全部标签');
    }

    function getBucket(tabKey) {
        const key = PLAYLIST_TABS.some(item => item.key === tabKey) ? tabKey : 'history';
        if (!Array.isArray(playlistBuckets[key])) {
            playlistBuckets[key] = [];
        }
        return playlistBuckets[key];
    }

    function setActivePlaylistTab(tabKey) {
        activePlaylistTab = PLAYLIST_TABS.some(item => item.key === tabKey) ? tabKey : 'history';
        playlist = getBucket(activePlaylistTab);
        currentIndex = currentSongToken
            ? playlist.findIndex(item => getSongToken(item) === currentSongToken)
            : -1;
        renderPlaylistTabs();
        renderPlaylist();
    }

    function mergeSongsToPlaylist(songs, tabKey) {
        const bucket = getBucket(tabKey || activePlaylistTab);
        let firstIndex = -1;
        songs.forEach(song => {
            const exists = bucket.findIndex(p => String(p.id) === String(song.id) && p.platform === song.platform);
            if (exists >= 0) {
                bucket[exists] = song;
                if (firstIndex < 0) firstIndex = exists;
            } else {
                bucket.push(song);
                if (firstIndex < 0) firstIndex = bucket.length - 1;
            }
        });
        if (activePlaylistTab === tabKey || (!tabKey && activePlaylistTab)) {
            playlist = bucket;
        }
        return firstIndex;
    }

    // ---- Playback ----
    function playSong(index) {
        if (index < 0 || index >= playlist.length) return;
        currentIndex = index;
        const song = playlist[index];
        currentSongToken = getSongToken(song);

        audio.src = song.url;
        audio.play().catch(() => {});

        // Update UI
        titleEl.textContent = song.name;
        artistEl.textContent = song.artist + (song.album ? ' · ' + song.album : '');

        if (song.cover) {
            coverEl.innerHTML = '<img class="music-cover" src="' + song.cover + '" alt="cover" />';
        } else {
            coverEl.innerHTML = '<i class="fas fa-music"></i>';
            coverEl.className = 'music-cover-placeholder';
        }

        if (song.quality) {
            qualityEl.textContent = song.quality;
            qualityEl.style.display = 'inline-block';
        } else {
            qualityEl.style.display = 'none';
        }

        renderPlaylist();
    }

    function togglePlay() {
        if (currentIndex < 0 && playlist.length > 0) {
            playSong(0);
            return;
        }
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play().catch(() => {});
        }
    }

    function playPrev() {
        if (playlist.length === 0) return;
        let idx = currentIndex - 1;
        if (idx < 0) idx = playlist.length - 1;
        playSong(idx);
    }

    function playNext() {
        if (playlist.length === 0) return;
        let idx = currentIndex + 1;
        if (idx >= playlist.length) idx = 0;
        playSong(idx);
    }

    // ---- Progress ----
    function updateProgress() {
        if (!audio.duration) return;
        const pct = (audio.currentTime / audio.duration) * 100;
        progressFill.style.width = pct + '%';
        timeCurrentEl.textContent = formatTime(audio.currentTime);
        timeTotalEl.textContent = formatTime(audio.duration);
    }

    function seekTo(e) {
        if (!audio.duration) return;
        const bar = e.currentTarget;
        const rect = bar.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        audio.currentTime = pct * audio.duration;
    }

    // ---- Volume ----
    function toggleMute() {
        audio.muted = !audio.muted;
        updateVolumeIcon();
    }

    function updateVolumeIcon() {
        const icon = volumeBtn.querySelector('i');
        if (audio.muted || audio.volume === 0) {
            icon.className = 'fas fa-volume-mute';
        } else if (audio.volume < 0.5) {
            icon.className = 'fas fa-volume-down';
        } else {
            icon.className = 'fas fa-volume-up';
        }
    }

    // ---- Playlist ----
    function renderPlaylist() {
        if (playlist.length === 0) {
            const activeTab = PLAYLIST_TABS.find(item => item.key === activePlaylistTab);
            const label = activeTab ? activeTab.label : '当前标签';
            playlistContainer.innerHTML = '<div class="music-empty">' + escapeHtml(label) + '为空，先搜索/解析歌曲</div>';
            return;
        }
        let html = '';
        playlist.forEach((song, i) => {
            const active = i === currentIndex ? ' active' : '';
            const dur = song.duration > 0 ? formatTime(song.duration) : '';
            html += `
                <div class="music-playlist-item${active}" data-index="${i}">
                    <span class="pl-index">${i === currentIndex ? '<i class="fas fa-play"></i>' : (i + 1)}</span>
                    <div class="pl-info">
                        <div class="pl-name">${escapeHtml(song.name)}</div>
                        <div class="pl-artist">${escapeHtml(song.artist)}</div>
                    </div>
                    <span class="pl-duration">${dur}</span>
                </div>
            `;
        });
        playlistContainer.innerHTML = html;

        // Bind click
        playlistContainer.querySelectorAll('.music-playlist-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index);
                playSong(idx);
            });
        });
    }

    // ---- Persistence ----
    function savePlaylist() {
        try {
            const data = {
                version: 2,
                activeTab: activePlaylistTab,
                buckets: {}
            };
            PLAYLIST_TABS.forEach(item => {
                data.buckets[item.key] = getBucket(item.key).map(s => ({
                    id: s.id,
                    name: s.name,
                    artist: s.artist,
                    album: s.album,
                    duration: s.duration,
                    url: s.url,
                    cover: s.cover,
                    quality: s.quality,
                    platform: s.platform
                }));
            });
            localStorage.setItem(PLAYLIST_KEY, JSON.stringify(data));
        } catch (e) { /* ignore */ }
    }

    function loadPlaylist() {
        try {
            const data = localStorage.getItem(PLAYLIST_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                    playlistBuckets = { history: parsed, hot: [], new: [] };
                    activePlaylistTab = 'history';
                } else {
                    const buckets = (parsed && parsed.buckets) || {};
                    playlistBuckets = {
                        history: Array.isArray(buckets.history) ? buckets.history : [],
                        hot: Array.isArray(buckets.hot) ? buckets.hot : [],
                        new: Array.isArray(buckets.new) ? buckets.new : []
                    };
                    activePlaylistTab = PLAYLIST_TABS.some(item => item.key === parsed.activeTab) ? parsed.activeTab : 'history';
                }
            }
        } catch (e) {
            playlistBuckets = { history: [], hot: [], new: [] };
            activePlaylistTab = 'history';
        }
        setActivePlaylistTab(activePlaylistTab);
    }

    // ---- Helpers ----
    function formatTime(sec) {
        if (!sec || isNaN(sec)) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return m + ':' + s.toString().padStart(2, '0');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showError(msg) {
        errorEl.style.color = '#f85149';
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
        setTimeout(() => { errorEl.style.display = 'none'; }, 5000);
    }

    function showNotice(msg) {
        errorEl.style.color = 'var(--accent-color)';
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
        setTimeout(() => {
            errorEl.style.display = 'none';
            errorEl.style.color = '#f85149';
        }, 5000);
    }

    function appendDebug(level, message, data) {
        const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        const entry = {
            ts,
            level: level || 'info',
            message: String(message || ''),
            dataText: safeStringify(data)
        };
        debugLogs.push(entry);
        if (debugLogs.length > DEBUG_LOG_LIMIT) {
            debugLogs = debugLogs.slice(debugLogs.length - DEBUG_LOG_LIMIT);
        }
        renderDebugLogs();
    }

    function renderDebugLogs() {
        if (!debugLogEl) return;
        if (debugLogs.length === 0) {
            debugLogEl.innerHTML = '<div class="music-debug-empty">暂无日志</div>';
            return;
        }
        debugLogEl.innerHTML = debugLogs.map(item => {
            const dataPart = item.dataText ? ' | ' + item.dataText : '';
            return '<div class="music-debug-item level-' + item.level + '">[' + item.ts + '] ' + escapeHtml(item.message + dataPart) + '</div>';
        }).join('');
        debugLogEl.scrollTop = debugLogEl.scrollHeight;
    }

    function clearDebugLogs() {
        debugLogs = [];
        renderDebugLogs();
    }

    function copyDebugLogs() {
        const text = debugLogs.map(item => '[' + item.ts + '][' + item.level.toUpperCase() + '] ' + item.message + (item.dataText ? ' | ' + item.dataText : '')).join('\n');
        if (!text) {
            appendDebug('warn', '当前没有可复制的日志');
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => appendDebug('info', '日志已复制到剪贴板'))
                .catch(() => appendDebug('warn', '复制失败，请手动选择日志内容'));
            return;
        }
        appendDebug('warn', '浏览器不支持自动复制，请手动复制日志');
    }

    function safeStringify(value) {
        if (value === undefined || value === null) return '';
        if (typeof value === 'string') return value;
        try {
            const raw = JSON.stringify(value);
            return raw.length > 420 ? raw.slice(0, 420) + '...(truncated)' : raw;
        } catch (e) {
            return String(value);
        }
    }

    function summarizePayload(value, depth) {
        if (value === null || value === undefined) return value;

        if (typeof value === 'string') {
            return value.length > 80 ? value.slice(0, 80) + '...(truncated)' : value;
        }
        if (typeof value === 'number' || typeof value === 'boolean') return value;

        if (Array.isArray(value)) {
            return {
                type: 'array',
                length: value.length,
                first: depth > 0 && value.length > 0 ? summarizePayload(value[0], depth - 1) : undefined
            };
        }

        if (typeof value === 'object') {
            const keys = Object.keys(value);
            const sample = {};
            keys.slice(0, 10).forEach(key => {
                const v = value[key];
                if (v === null || v === undefined) {
                    sample[key] = v;
                } else if (typeof v === 'string') {
                    sample[key] = v.length > 50 ? v.slice(0, 50) + '...(truncated)' : v;
                } else if (typeof v === 'number' || typeof v === 'boolean') {
                    sample[key] = v;
                } else if (Array.isArray(v)) {
                    sample[key] = 'array(' + v.length + ')';
                    if (depth > 0 && v.length > 0) {
                        sample[key + '_first'] = summarizePayload(v[0], depth - 1);
                    }
                } else if (typeof v === 'object') {
                    sample[key] = depth > 0
                        ? { keys: Object.keys(v).slice(0, 8) }
                        : 'object';
                } else {
                    sample[key] = typeof v;
                }
            });

            return {
                type: 'object',
                keys: keys.slice(0, 20),
                sample
            };
        }

        return String(value);
    }
})();
