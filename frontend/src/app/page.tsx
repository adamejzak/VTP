"use client"

import { useEffect } from "react"
import { useAuth, useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { Bot, Loader2 } from "lucide-react"

export default function HomePage() {
  const { isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded) return

    if (isSignedIn) {
      // User is signed in, redirect to dashboard
      router.push("/dashboard")
    } else {
      // User is not signed in, redirect to sign-in
      router.push("/sign-in")
    }
  }, [isSignedIn, isLoaded, router])

  // Show loading while checking auth status
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center">
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <Bot className="h-12 w-12 text-primary animate-pulse" />
        </div>
                       <h1 className="text-2xl font-bold mb-2">Panel VTP</h1>
               <div className="flex items-center justify-center space-x-2">
                 <Loader2 className="h-4 w-4 animate-spin" />
                 <span className="text-muted-foreground">Ładowanie...</span>
               </div>
      </div>
    </div>
  )
}
