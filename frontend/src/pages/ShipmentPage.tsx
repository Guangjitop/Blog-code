import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ShipmentManager } from "@/components/ShipmentManager"

export default function ShipmentPage() {
  const [userKey, setUserKey] = useState("")
  const navigate = useNavigate()

  const getKeyFromCookie = () => {
    const match = document.cookie.match(/(?:^|;\s*)user_key=([^;]*)/)
    return match ? decodeURIComponent(match[1]) : null
  }

  useEffect(() => {
    const key = getKeyFromCookie()
    if (!key) {
      navigate("/user/login")
      return
    }
    setUserKey(key)
  }, [navigate])

  if (!userKey) return null

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      <div className="relative z-10 p-6 md:p-8 max-w-7xl mx-auto">
        <ShipmentManager authKey={userKey} apiUrl="/api" />
      </div>
    </div>
  )
}
