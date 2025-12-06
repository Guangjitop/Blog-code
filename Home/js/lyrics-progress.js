/**
 * 歌词进度计算模块
 * 提供歌词进度计算和渐变样式生成功能
 */

// 颜色常量
const LYRICS_BLUE = '#58a6ff';
const LYRICS_GRAY = 'rgba(255, 255, 255, 0.5)';

/**
 * 计算歌词行的进度百分比
 * @param {number} currentTime - 当前播放时间（秒）
 * @param {number} lineStartTime - 歌词行开始时间（秒）
 * @param {number} lineEndTime - 歌词行结束时间（秒）
 * @returns {number} - 进度百分比 (0-100)
 */
function calculateLyricProgress(currentTime, lineStartTime, lineEndTime) {
    // 处理无效输入
    if (typeof currentTime !== 'number' || isNaN(currentTime) ||
        typeof lineStartTime !== 'number' || isNaN(lineStartTime) ||
        typeof lineEndTime !== 'number' || isNaN(lineEndTime)) {
        return 0;
    }
    
    // 结束时间必须大于开始时间
    if (lineEndTime <= lineStartTime) {
        return currentTime >= lineStartTime ? 100 : 0;
    }
    
    // 还未到达该行
    if (currentTime < lineStartTime) {
        return 0;
    }
    
    // 已经播放完该行
    if (currentTime >= lineEndTime) {
        return 100;
    }
    
    // 计算进度百分比
    const progress = ((currentTime - lineStartTime) / (lineEndTime - lineStartTime)) * 100;
    return Math.min(100, Math.max(0, progress));
}

/**
 * 生成歌词渐变样式
 * @param {number} progress - 进度百分比 (0-100)
 * @returns {string} - CSS 渐变样式
 */
function generateGradientStyle(progress) {
    // 确保 progress 在有效范围内
    const p = Math.min(100, Math.max(0, progress));
    
    // 生成从左到右的渐变：蓝色(已播放) -> 灰白色(未播放)
    return `linear-gradient(to right, ${LYRICS_BLUE} ${p}%, ${LYRICS_GRAY} ${p}%)`;
}

/**
 * 获取歌词行的结束时间
 * @param {Array} lyrics - 歌词数组
 * @param {number} index - 当前行索引
 * @param {number} defaultDuration - 默认持续时间（秒）
 * @returns {number} - 结束时间
 */
function getLyricEndTime(lyrics, index, defaultDuration = 3) {
    if (!lyrics || index < 0 || index >= lyrics.length) {
        return 0;
    }
    
    const currentLine = lyrics[index];
    
    // 如果有下一行，使用下一行的开始时间作为结束时间
    if (index < lyrics.length - 1) {
        return lyrics[index + 1].time;
    }
    
    // 最后一行，使用默认持续时间
    return currentLine.time + defaultDuration;
}

// 导出（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateLyricProgress,
        generateGradientStyle,
        getLyricEndTime,
        LYRICS_BLUE,
        LYRICS_GRAY
    };
}
