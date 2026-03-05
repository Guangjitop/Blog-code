import type { ReactNode } from "react"
import { Sidebar } from "./Sidebar"

interface MainLayoutProps {
  children: ReactNode
  userType: 'admin' | 'user'
}

export function MainLayout({ children, userType }: MainLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background relative selection:bg-primary/20">
      {/* Global Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {userType === 'admin' ? (
          <>
            <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-[100px]" />
            <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[100px]" />
          </>
        ) : (
          <>
            <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-[100px]" />
            <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-purple-500/5 blur-[100px]" />
          </>
        )}
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      </div>

      {/* 侧边栏 */}
      <Sidebar userType={userType} />
      
      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto relative z-10 scrollbar-custom">
        {children}
      </main>
    </div>
  )
}

