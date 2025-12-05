/**
 * 音乐播放器核心模块
 * 提供播放列表管理、播放控制和状态持久化功能
 */

// 支持的音频格式
const SUPPORTED_FORMATS = ['mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a', 'webm'];

// localStorage 键名
const STORAGE_KEY = 'musicPlayerState';

/**
 * 解析文件名，提取艺术家和歌曲名
 * @param {string} filename - 音乐文件名
 * @returns {{artist: string, title: string, format: string}}
 */
function parseTrackName(filename) {
    // 获取扩展名
    const lastDot = filename.lastIndexOf('.');
    const format = lastDot > 0 ? filename.substring(lastDot + 1).toLowerCase() : '';
    const name = lastDot > 0 ? filename.substring(0, lastDot) : filename;
    
    // 尝试解析 "艺术家 - 歌曲名" 格式
    const separator = ' - ';
    const sepIndex = name.indexOf(separator);
    
    if (sepIndex > 0) {
        return {
            artist: name.substring(0, sepIndex).trim(),
            title: name.substring(sepIndex + separator.length).trim(),
            format: format
        };
    }
    
    return {
        artist: '未知艺术家',
        title: name.trim(),
        format: format
    };
}

/**
 * 格式化音轨信息为文件名
 * @param {string} artist - 艺术家
 * @param {string} title - 歌曲名
 * @param {string} format - 格式
 * @returns {string}
 */
function formatTrackName(artist, title, format) {
    if (artist && artist !== '未知艺术家') {
        return `${artist} - ${title}.${format}`;
    }
    return `${title}.${format}`;
}

/**
 * 过滤支持的音频格式
 * @param {string[]} files - 文件名列表
 * @returns {string[]}
 */
function filterSupportedFormats(files) {
    return files.filter(file => {
        const lastDot = file.lastIndexOf('.');
        if (lastDot <= 0) return false;
        const ext = file.substring(lastDot + 1).toLowerCase();
        return SUPPORTED_FORMATS.includes(ext);
    });
}

/**
 * 获取下一个索引（循环）
 * @param {number} current - 当前索引
 * @param {number} total - 总数
 * @returns {number}
 */
function getNextIndex(current, total) {
    if (total <= 0) return 0;
    return (current + 1) % total;
}

/**
 * 获取上一个索引（循环）
 * @param {number} current - 当前索引
 * @param {number} total - 总数
 * @returns {number}
 */
function getPrevIndex(current, total) {
    if (total <= 0) return 0;
    return (current - 1 + total) % total;
}

/**
 * 保存播放器状态到 localStorage
 * @param {object} state - 播放器状态
 */
function saveState(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn('无法保存播放器状态:', e);
    }
}

/**
 * 从 localStorage 恢复播放器状态
 * @returns {object|null}
 */
function restoreState() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            return JSON.parse(data);
        }
    } catch (e) {
        console.warn('无法恢复播放器状态:', e);
    }
    return null;
}

/**
 * 音乐播放器类
 */
class MusicPlayer {
    constructor(playlistUrl = 'playlist.json') {
        this.playlistUrl = playlistUrl;
        this.playlist = [];
        this.currentIndex = 0;
        this.volume = 0.3;
        this.isPlaying = false;
        this.audio = null;
        
        // 回调函数
        this.onTrackChange = null;
        this.onPlayStateChange = null;
        this.onPlaylistLoad = null;
        this.onError = null;
    }
    
    /**
     * 初始化播放器
     */
    async init() {
        // 恢复状态
        const savedState = restoreState();
        if (savedState) {
            this.currentIndex = savedState.currentIndex || 0;
            this.volume = savedState.volume !== undefined ? savedState.volume : 0.3;
        }
        
        // 加载播放列表
        await this.loadPlaylist();
        
        // 确保索引有效
        if (this.currentIndex >= this.playlist.length) {
            this.currentIndex = 0;
        }
    }
    
    /**
     * 加载播放列表
     */
    async loadPlaylist() {
        try {
            const response = await fetch(this.playlistUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            this.playlist = data.tracks || [];
            
            if (this.onPlaylistLoad) {
                this.onPlaylistLoad(this.playlist);
            }
        } catch (e) {
            console.error('加载播放列表失败:', e);
            this.playlist = [];
            if (this.onError) {
                this.onError('加载播放列表失败');
            }
        }
    }
    
    /**
     * 获取播放列表
     */
    getPlaylist() {
        return this.playlist;
    }
    
    /**
     * 获取当前曲目
     */
    getCurrentTrack() {
        if (this.playlist.length === 0) return null;
        return this.playlist[this.currentIndex];
    }
    
    /**
     * 设置音频元素
     */
    setAudioElement(audioElement) {
        this.audio = audioElement;
        this.audio.volume = this.volume;
        
        // 监听播放结束
        this.audio.addEventListener('ended', () => {
            this.next();
        });
        
        // 监听错误
        this.audio.addEventListener('error', () => {
            console.error('音频加载失败:', this.getCurrentTrack()?.path);
            if (this.onError) {
                this.onError('音频加载失败');
            }
            // 自动跳到下一首
            setTimeout(() => this.next(), 1000);
        });
    }
    
    /**
     * 播放
     */
    play() {
        if (!this.audio || this.playlist.length === 0) return;
        
        const track = this.getCurrentTrack();
        if (!track) return;
        
        // 如果音源不同，更新音源
        if (!this.audio.src.endsWith(track.path)) {
            this.audio.src = track.path;
        }
        
        this.audio.play().then(() => {
            this.isPlaying = true;
            this._saveCurrentState();
            if (this.onPlayStateChange) {
                this.onPlayStateChange(true);
            }
        }).catch(e => {
            console.error('播放失败:', e);
        });
    }
    
    /**
     * 暂停
     */
    pause() {
        if (!this.audio) return;
        
        this.audio.pause();
        this.isPlaying = false;
        this._saveCurrentState();
        
        if (this.onPlayStateChange) {
            this.onPlayStateChange(false);
        }
    }
    
    /**
     * 切换播放/暂停
     */
    toggle() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    /**
     * 下一曲
     */
    next() {
        if (this.playlist.length === 0) return;
        
        this.currentIndex = getNextIndex(this.currentIndex, this.playlist.length);
        this._onTrackChanged();
    }
    
    /**
     * 上一曲
     */
    prev() {
        if (this.playlist.length === 0) return;
        
        this.currentIndex = getPrevIndex(this.currentIndex, this.playlist.length);
        this._onTrackChanged();
    }
    
    /**
     * 播放指定曲目
     */
    playTrack(index) {
        if (index < 0 || index >= this.playlist.length) return;
        
        this.currentIndex = index;
        this._onTrackChanged();
    }
    
    /**
     * 设置音量
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.audio) {
            this.audio.volume = this.volume;
        }
        this._saveCurrentState();
    }
    
    /**
     * 曲目变化处理
     */
    _onTrackChanged() {
        const track = this.getCurrentTrack();
        
        if (this.audio && track) {
            this.audio.src = track.path;
            if (this.isPlaying) {
                this.audio.play().catch(e => console.error('播放失败:', e));
            }
        }
        
        this._saveCurrentState();
        
        if (this.onTrackChange) {
            this.onTrackChange(track, this.currentIndex);
        }
    }
    
    /**
     * 保存当前状态
     */
    _saveCurrentState() {
        saveState({
            currentIndex: this.currentIndex,
            volume: this.volume
        });
    }
}

// 导出（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseTrackName,
        formatTrackName,
        filterSupportedFormats,
        getNextIndex,
        getPrevIndex,
        saveState,
        restoreState,
        MusicPlayer,
        SUPPORTED_FORMATS
    };
}
