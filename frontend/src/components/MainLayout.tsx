import type { ReactNode } from "react"
import { Sidebar } from "./Sidebar"

interface MainLayoutProps {
  children: ReactNode
  userType: 'admin' | 'user'
}

export function MainLayout({ children, userType }: MainLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 侧边栏 */}
      <Sidebar userType={userType} />
      
      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

