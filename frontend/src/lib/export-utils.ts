/**
 * 账号导出工具函数
 */

export interface ExportAccount {
  email: string
  password: string
}

/**
 * 转义 CSV 字段中的特殊字符
 * 如果字段包含逗号、引号或换行符，需要用引号包裹并转义内部引号
 */
function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

/**
 * 导出账号为 CSV 格式
 * @param accounts 账号列表
 * @returns CSV 格式字符串
 */
export function exportToCSV(accounts: ExportAccount[]): string {
  const header = 'email,password'
  const rows = accounts.map(acc => 
    `${escapeCSVField(acc.email)},${escapeCSVField(acc.password)}`
  )
  return [header, ...rows].join('\n')
}

/**
 * 导出账号为 TXT 格式（邮箱----密码）
 * @param accounts 账号列表
 * @returns TXT 格式字符串
 */
export function exportToTXT(accounts: ExportAccount[]): string {
  return accounts.map(acc => `${acc.email}----${acc.password}`).join('\n')
}

/**
 * 导出账号为 JSON 格式
 * @param accounts 账号列表
 * @returns JSON 格式字符串
 */
export function exportToJSON(accounts: ExportAccount[]): string {
  return JSON.stringify(accounts, null, 2)
}


/**
 * 生成导出文件名
 * @param count 账号数量
 * @param format 导出格式
 * @returns 文件名
 */
export function generateFilename(count: number, format: 'csv' | 'txt' | 'json'): string {
  const date = new Date()
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  return `accounts_${dateStr}_${count}.${format}`
}

/**
 * 触发文件下载
 * @param content 文件内容
 * @param filename 文件名
 * @param mimeType MIME 类型
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
