"use client"

import { motion } from "framer-motion"
import { UserProfile } from "@clerk/nextjs"
import { dark } from "@clerk/themes"
import { useUserRole } from "@/hooks/use-user-role"

export default function SettingsPage() {
  const { userProfile } = useUserRole()

  // Jeśli nie ma userProfile, layout już przekieruje użytkownika
  if (!userProfile) {
    return null
  }

  return (
    <div className="p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ustawienia</h1>
          <p className="text-muted-foreground">
            Zarządzaj swoim kontem i preferencjami
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <UserProfile 
          routing="hash"
          appearance={{
            baseTheme: dark,
            elements: {
              formButtonPrimary: "bg-primary hover:bg-primary/90",
              card: "shadow-lg border"
            }
          }}
        />
      </motion.div>
    </div>
  )
}
