/**
 * LRC Parser 模块
 * 解析 LRC 格式歌词，支持时间同步显示
 */

/**
 * 解析时间戳字符串为秒数
 * @param {string} timeStr - 时间戳字符串，如 "00:05.50" 或 "00:05:50"
 * @returns {number} 秒数
 */
function parseTimeStamp(timeStr) {
    if (!timeStr) return 0;
    
    // 支持 mm:ss.xx 和 mm:ss:xx 格式
    const parts = timeStr.replace('.', ':').split(':');
    
    if (parts.length >= 2) {
        const minutes = parseInt(parts[0], 10) || 0;
        const seconds = parseInt(parts[1], 10) || 0;
        const milliseconds = parts[2] ? parseInt(parts[2].padEnd(3, '0').substring(0, 3), 10) : 0;
        
        return minutes * 60 + seconds + milliseconds / 1000;
    }
    
    return 0;
}

/**
 * 格式化秒数为时间戳字符串
 * @param {number} time - 秒数
 * @returns {string} 时间戳字符串，如 "00:05.50"
 */
function formatTimeStamp(time) {
    if (typeof time !== 'number' || isNaN(time) || time < 0) {
        time = 0;
    }
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.round((time % 1) * 100);
    
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`;
}

/**
 * 解析 LRC 格式歌词
 * @param {string} lrcContent - LRC 格式歌词内容
 * @returns {Array<{time: number, text: string}>} 歌词行数组
 */
function parseLRC(lrcContent) {
    if (!lrcContent || typeof lrcContent !== 'string') {
        return [];
    }

    const lines = lrcContent.split('\n');
    const lyrics = [];
    
    // 匹配时间戳的正则：[mm:ss.xx] 或 [mm:ss:xx] 或 [mm:ss]
    const timeRegex = /\[(\d{1,2}):(\d{2})([.:]\d{1,3})?\]/g;

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        // 跳过元数据行（如 [ti:标题]、[ar:艺术家] 等）
        if (/^\[[a-z]{2}:/.test(trimmedLine)) continue;
        
        // 提取所有时间戳
        const timeMatches = [...trimmedLine.matchAll(timeRegex)];
        if (timeMatches.length === 0) continue;
        
        // 提取歌词文本（移除所有时间戳）
        const text = trimmedLine.replace(timeRegex, '').trim();
        
        // 为每个时间戳创建一个歌词行
        for (const match of timeMatches) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const ms = match[3] ? parseFloat('0' + match[3].replace(':', '.')) : 0;
            
            const time = minutes * 60 + seconds + ms;
            
            lyrics.push({ time, text });
        }
    }

    // 按时间排序
    lyrics.sort((a, b) => a.time - b.time);
    
    return lyrics;
}

/**
 * 格式化歌词数组为 LRC 格式
 * @param {Array<{time: number, text: string}>} lyrics - 歌词行数组
 * @returns {string} LRC 格式歌词内容
 */
function formatLRC(lyrics) {
    if (!Array.isArray(lyrics) || lyrics.length === 0) {
        return '';
    }

    return lyrics
        .map(line => `[${formatTimeStamp(line.time)}]${line.text}`)
        .join('\n');
}

/**
 * 根据当前播放时间获取当前歌词行索引
 * @param {Array<{time: number, text: string}>} lyrics - 歌词行数组
 * @param {number} currentTime - 当前播放时间（秒）
 * @returns {number} 当前歌词行索引，-1 表示还未开始
 */
function getCurrentLyricIndex(lyrics, currentTime) {
    if (!Array.isArray(lyrics) || lyrics.length === 0) {
        return -1;
    }
    
    // 找到最后一个时间戳小于等于当前时间的歌词
    let index = -1;
    for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].time <= currentTime) {
            index = i;
        } else {
            break;
        }
    }
    
    return index;
}

/**
 * 获取当前歌词及上下文（用于淡入淡出显示）
 * @param {Array<{time: number, text: string}>} lyrics - 歌词行数组
 * @param {number} currentTime - 当前播放时间（秒）
 * @param {number} contextLines - 上下文行数，默认 2
 * @returns {{prev: string[], current: string, next: string[], currentIndex: number}}
 */
function getLyricContext(lyrics, currentTime, contextLines = 2) {
    const currentIndex = getCurrentLyricIndex(lyrics, currentTime);
    
    if (currentIndex < 0 || !lyrics || lyrics.length === 0) {
        return {
            prev: [],
            current: '',
            next: [],
            currentIndex: -1
        };
    }
    
    const prev = [];
    const next = [];
    
    // 获取前面的歌词
    for (let i = Math.max(0, currentIndex - contextLines); i < currentIndex; i++) {
        prev.push(lyrics[i].text);
    }
    
    // 获取后面的歌词
    for (let i = currentIndex + 1; i <= Math.min(lyrics.length - 1, currentIndex + contextLines); i++) {
        next.push(lyrics[i].text);
    }
    
    return {
        prev,
        current: lyrics[currentIndex].text,
        next,
        currentIndex
    };
}

// 导出（浏览器和 Node.js 兼容）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseTimeStamp,
        formatTimeStamp,
        parseLRC,
        formatLRC,
        getCurrentLyricIndex,
        getLyricContext
    };
}
