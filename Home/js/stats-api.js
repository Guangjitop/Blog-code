/**
 * 网站统计 API 模块
 * 提供从服务器获取和更新统计数据的功能
 */

// API 基础路径（生产环境从同域获取，开发环境可配置）
const STATS_API_BASE = window.STATS_API_BASE || '';

// 默认/回退值
const FALLBACK_STATS = {
    visitCount: 0,
    startTime: '2024-01-01T00:00:00+08:00'
};

// 会话标记 key
const SESSION_VISITED_KEY = 'site_visited';

/**
 * 获取统计数据（不增加计数）
 * @returns {Promise<{visitCount: number, startTime: string}>}
 */
async function fetchStats() {
    const url = `${STATS_API_BASE}/api/site-stats`;
    console.log('[STATS-API] 请求URL:', url);
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        
        console.log('[STATS-API] 响应状态:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error('[STATS-API] HTTP错误:', response.status, errorText);
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[STATS-API] 获取成功:', data);
        return data;
    } catch (error) {
        console.error('[STATS-API] 获取统计数据失败，使用回退值:', error);
        console.error('[STATS-API] 请求URL:', url);
        console.error('[STATS-API] STATS_API_BASE:', STATS_API_BASE);
        return FALLBACK_STATS;
    }
}

/**
 * 记录访问并获取统计（增加计数）
 * @returns {Promise<{visitCount: number, startTime: string}>}
 */
async function recordVisit() {
    const url = `${STATS_API_BASE}/api/site-stats/visit`;
    console.log('[STATS-API] 记录访问，请求URL:', url);
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Accept': 'application/json' }
        });
        
        console.log('[STATS-API] 记录访问响应状态:', response.status, response.statusText);
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error('[STATS-API] 记录访问HTTP错误:', response.status, errorText);
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[STATS-API] 记录访问成功:', data);
        return data;
    } catch (error) {
        console.error('[STATS-API] 记录访问失败，尝试获取当前统计:', error);
        console.error('[STATS-API] 请求URL:', url);
        // 失败时尝试获取当前统计
        return fetchStats();
    }
}

/**
 * 检查当前会话是否已访问过
 * @returns {boolean}
 */
function hasVisitedThisSession() {
    return sessionStorage.getItem(SESSION_VISITED_KEY) === 'true';
}

/**
 * 标记当前会话已访问
 */
function markSessionVisited() {
    sessionStorage.setItem(SESSION_VISITED_KEY, 'true');
}

/**
 * 初始化统计数据
 * - 新会话：记录访问并获取统计
 * - 已访问过：仅获取统计
 * @returns {Promise<{visitCount: number, startTime: string}>}
 */
async function initStats() {
    if (hasVisitedThisSession()) {
        // 同一会话，只获取不增加
        return fetchStats();
    } else {
        // 新会话，记录访问
        const stats = await recordVisit();
        markSessionVisited();
        return stats;
    }
}

// 导出（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        fetchStats,
        recordVisit,
        initStats,
        hasVisitedThisSession,
        markSessionVisited,
        FALLBACK_STATS
    };
}
