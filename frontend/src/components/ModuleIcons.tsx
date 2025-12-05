// 模块图标组件集合
// 可以根据需要添加更多自定义图标

import { 
  Users, 
  ShieldCheck, 
  Key, 
  Home,
  Settings,
  FileText,
  Database,
  BarChart3,
  Bell,
  Package,
  Server,
  Code,
  Layers,
  type LucideIcon
} from "lucide-react"

// 导出所有可用的模块图标
export const ModuleIcons = {
  // 基础图标
  Home,
  Users,
  Settings,
  
  // 业务图标
  ShieldCheck,
  Key,
  FileText,
  Database,
  BarChart3,
  Bell,
  Package,
  Server,
  Code,
  Layers,
} as const

// 图标类型
export type ModuleIconType = keyof typeof ModuleIcons
export type IconComponent = LucideIcon

// 获取图标组件的辅助函数
export function getModuleIcon(iconName: ModuleIconType): IconComponent {
  return ModuleIcons[iconName]
}

