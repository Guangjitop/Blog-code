/**
 * Track Parser 模块
 * 解析音乐文件名，提取艺术家和歌曲名
 */

// 常见中文艺术家名列表（用于智能识别）
const KNOWN_ARTISTS = [
    '周杰伦', '林俊杰', '陈奕迅', '王力宏', '张学友', '刘德华',
    '华晨宇', '薛之谦', '邓紫棋', '李荣浩', '毛不易', '许嵩',
    '五月天', 'TFBOYS', '鹿晗', '吴亦凡', '张艺兴', '王嘉尔',
    'Jay Chou', 'JJ Lin', 'Eason Chan'
];

/**
 * 解析文件名，提取艺术家和歌曲名
 * @param {string} filename - 音乐文件名
 * @returns {{artist: string, title: string, format: string}}
 */
function parseTrackName(filename) {
    if (!filename || typeof filename !== 'string') {
        return { artist: '未知艺术家', title: '未知歌曲', format: '' };
    }

    // 获取扩展名
    const lastDot = filename.lastIndexOf('.');
    const format = lastDot > 0 ? filename.substring(lastDot + 1).toLowerCase() : '';
    const name = lastDot > 0 ? filename.substring(0, lastDot) : filename;

    // 尝试多种分隔符模式
    const separators = [' - ', '- ', ' -', '-'];
    
    for (const sep of separators) {
        const sepIndex = name.indexOf(sep);
        if (sepIndex > 0 && sepIndex < name.length - sep.length) {
            const part1 = name.substring(0, sepIndex).trim();
            const part2 = name.substring(sepIndex + sep.length).trim();
            
            if (part1 && part2) {
                // 智能判断哪个是艺术家，哪个是歌曲名
                const result = identifyArtistAndTitle(part1, part2);
                return { ...result, format };
            }
        }
    }

    // 无分隔符，整个名称作为歌曲名
    return {
        artist: '未知艺术家',
        title: name.trim() || '未知歌曲',
        format
    };
}

/**
 * 智能识别艺术家和歌曲名
 * @param {string} part1 - 分隔符前的部分
 * @param {string} part2 - 分隔符后的部分
 * @returns {{artist: string, title: string}}
 */
function identifyArtistAndTitle(part1, part2) {
    // 检查 part1 是否是已知艺术家
    const part1IsArtist = KNOWN_ARTISTS.some(artist => 
        part1.toLowerCase().includes(artist.toLowerCase())
    );
    
    // 检查 part2 是否是已知艺术家
    const part2IsArtist = KNOWN_ARTISTS.some(artist => 
        part2.toLowerCase().includes(artist.toLowerCase())
    );

    // 如果 part2 是已知艺术家而 part1 不是，则交换
    if (part2IsArtist && !part1IsArtist) {
        return { artist: part2, title: part1 };
    }
    
    // 默认：part1 是艺术家，part2 是歌曲名
    return { artist: part1, title: part2 };
}

/**
 * 格式化音轨信息为文件名
 * @param {string} artist - 艺术家
 * @param {string} title - 歌曲名
 * @param {string} format - 格式
 * @returns {string}
 */
function formatTrackName(artist, title, format) {
    const name = (artist && artist !== '未知艺术家')
        ? `${artist} - ${title}`
        : title;
    
    return format ? `${name}.${format}` : name;
}

/**
 * 过滤支持的音频格式
 * @param {string[]} files - 文件名列表
 * @returns {string[]}
 */
function filterSupportedFormats(files) {
    const SUPPORTED_FORMATS = ['mp3', 'flac', 'wav', 'ogg', 'aac', 'm4a', 'webm'];
    return files.filter(file => {
        const lastDot = file.lastIndexOf('.');
        if (lastDot <= 0) return false;
        const ext = file.substring(lastDot + 1).toLowerCase();
        return SUPPORTED_FORMATS.includes(ext);
    });
}

// 导出（浏览器和 Node.js 兼容）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseTrackName,
        formatTrackName,
        identifyArtistAndTitle,
        filterSupportedFormats,
        KNOWN_ARTISTS
    };
}
