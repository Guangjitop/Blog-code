/**
 * 网易云账号配置模块
 * 提供账号配置的存储、加载和清除功能
 */

const ACCOUNT_CONFIG_KEY = 'neteaseAccountConfig';

/**
 * 保存账号配置
 * @param {Object} config - 账号配置
 * @param {boolean} config.enabled - 是否启用
 * @param {string} [config.userId] - 用户ID
 * @param {string} [config.cookie] - Cookie
 */
function saveAccountConfig(config) {
    try {
        const data = {
            enabled: !!config.enabled,
            userId: config.userId || '',
            cookie: config.cookie || '',
            configuredAt: Date.now()
        };
        localStorage.setItem(ACCOUNT_CONFIG_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        console.warn('保存账号配置失败:', e);
        return false;
    }
}

/**
 * 加载账号配置
 * @returns {Object|null} 账号配置或 null
 */
function loadAccountConfig() {
    try {
        const data = localStorage.getItem(ACCOUNT_CONFIG_KEY);
        if (data) {
            return JSON.parse(data);
        }
    } catch (e) {
        console.warn('加载账号配置失败:', e);
    }
    return null;
}

/**
 * 清除账号配置
 */
function clearAccountConfig() {
    try {
        localStorage.removeItem(ACCOUNT_CONFIG_KEY);
        return true;
    } catch (e) {
        console.warn('清除账号配置失败:', e);
        return false;
    }
}


/**
 * 检查是否已配置账号
 * @returns {boolean}
 */
function isAccountConfigured() {
    const config = loadAccountConfig();
    return config && config.enabled && (config.userId || config.cookie);
}

// 导出（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        saveAccountConfig,
        loadAccountConfig,
        clearAccountConfig,
        isAccountConfigured,
        ACCOUNT_CONFIG_KEY
    };
}
