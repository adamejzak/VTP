"use client"

import { motion } from "framer-motion"
import { ShieldX, ArrowLeft, Mail, LogOut } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useClerk } from "@clerk/nextjs"
import { useRouter } from "next/navigation"

export default function AccessDeniedPage() {
  const { signOut } = useClerk()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <Card>
          <CardHeader className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
            >
              <ShieldX className="h-8 w-8 text-destructive" />
            </motion.div>
            <CardTitle className="text-2xl">Dostęp Zabroniony</CardTitle>
            <CardDescription>
              Nie masz uprawnień do dostępu do tej aplikacji.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              <p>
                Twoje konto nie ma uprawnień do korzystania z tego panelu. 
                Skontaktuj się z administratorem, aby poprosić o dostęp.
              </p>
            </div>
            
            <div className="space-y-2">
              <Button asChild className="w-full">
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Powrót do Strony Głównej
                </Link>
              </Button>
              
              <Button variant="outline" className="w-full" asChild>
                <a href="mailto:admin@vtp.xyz">
                  <Mail className="mr-2 h-4 w-4" />
                  Skontaktuj się z Administratorem
                </a>
              </Button>

              <Button 
                variant="destructive" 
                className="w-full" 
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Wyloguj się
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
