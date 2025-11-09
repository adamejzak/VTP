"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { 
  Bot, 
  Users, 
  Calendar, 
  Activity,
  Building2
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useUserRole } from "@/hooks/use-user-role"
import { apiClient } from "@/lib/api"
import { DiscordServer, Schedule } from "@/types"
import Link from "next/link"

export default function DashboardPage() {
  const { userProfile, isAdmin, getToken } = useUserRole()
  const [serverData, setServerData] = useState<DiscordServer | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [storesCount, setStoresCount] = useState<number>(0)
  const [backendVersion, setBackendVersion] = useState<string>('—')
  const frontendVersion = process.env.NEXT_PUBLIC_APP_VERSION || '—'
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Get JWT token from Clerk
        const token = await getToken()
        if (!token) {
          setError('Brak autoryzacji - zaloguj się ponownie')
          setIsLoading(false)
          return
        }

        // Fetch server, schedules, stores and health in parallel
        const [serverResponse, schedulesResponse, storesResponse, healthResponse] = await Promise.allSettled([
          apiClient.getServer(token),
          apiClient.getSchedules(token),
          apiClient.getStores(false, token),
          apiClient.getHealth()
        ])

        if (serverResponse.status === 'fulfilled') {
          setServerData(serverResponse.value as DiscordServer)
        } else {
          console.error('Failed to fetch server data:', serverResponse.reason)
        }

        if (schedulesResponse.status === 'fulfilled') {
          const schedulesData = schedulesResponse.value as any
          setSchedules(schedulesData.data || schedulesData)
        } else {
          console.error('Failed to fetch schedules:', schedulesResponse.reason)
        }

        if (storesResponse.status === 'fulfilled') {
          const storesData: any = storesResponse.value
          const list = storesData?.data || storesData
          setStoresCount(Array.isArray(list) ? list.length : 0)
        } else {
          console.error('Failed to fetch stores:', storesResponse.reason)
        }

        if (healthResponse.status === 'fulfilled') {
          const health: any = healthResponse.value
          setBackendVersion(health?.version || '—')
        }

      } catch (err) {
        console.error('Error fetching dashboard data:', err)
        setError('Nie udało się załadować danych dashboardu')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [getToken])

  // Jeśli nie ma userProfile, layout już przekieruje użytkownika
  if (!userProfile) {
    return null
  }

  // Calculate stats from real data
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()
  const currentMonthSchedules = schedules.filter(schedule => 
    schedule.month === currentMonth && schedule.year === currentYear
  ).length

  const stats = [
    {
      title: "Członkowie Serwera",
      value: serverData?.memberCount?.toLocaleString() || "0",
      changeType: "positive" as const,
      icon: Users,
      description: "Łączna liczba członków Discord",
    },
    {
      title: "Harmonogramy",
      value: schedules.length.toString(),
      change: "",
      changeType: currentMonthSchedules > 0 ? "positive" as const : "negative" as const,
      icon: Calendar,
      description: "Łączna liczba grafików",
    },
    {
      title: "Sklepy",
      value: storesCount.toString(),
      change: "",
      changeType: storesCount > 0 ? "positive" as const : "negative" as const,
      icon: Building2,
      description: "Łączna liczba sklepów",
    },
    {
      title: "Dostępność Bota",
      value: serverData ? "99.9%" : "Sprawdzanie...",
      change: serverData ? "+0.1%" : "Ładowanie...",
      changeType: "positive" as const,
      icon: Activity,
      description: "Dostępność bota Discord",
    },
  ]


  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Błąd ładowania</h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={userProfile?.imageUrl} />
              <AvatarFallback>
                {userProfile?.firstName?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Witaj ponownie, {userProfile?.firstName || 'Użytkowniku'}!
              </h1>
              <p className="text-muted-foreground">
                Oto co dzieje się na Twoim serwerze Discord dzisiaj.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <span className="text-muted-foreground">Rola:</span>
            <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-medium">
              {userProfile?.role === 'ADMIN' ? 'Administrator' : 'Pracownik'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 * index }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                {stat.change && (
                  <p className="text-xs text-muted-foreground">
                    <span className={`${
                      stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stat.change}
                    </span>
                  </p>
                )}
                {stat.description && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Szybkie Akcje</CardTitle>
              <CardDescription>
                Częste zadania i skróty
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                >
                  <Bot className="h-6 w-6 text-primary mb-2" />
                  <h3 className="font-medium">Ustawienia Bota</h3>
                  <p className="text-xs text-muted-foreground">
                    Konfiguruj ustawienia bota
                  </p>
                </motion.div>
                
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                >
                  <Link href="/dashboard/schedule" className="block">
                    <Calendar className="h-6 w-6 text-primary mb-2" />
                    <h3 className="font-medium">Zobacz Harmonogram</h3>
                    <p className="text-xs text-muted-foreground">
                      Sprawdź zmiany
                    </p>
                  </Link>
                </motion.div>
                
                {isAdmin && (
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  >
                    <Link href="/dashboard/users" className="block">
                      <Users className="h-6 w-6 text-primary mb-2" />
                      <h3 className="font-medium">Zarządzaj Użytkownikami</h3>
                      <p className="text-xs text-muted-foreground">
                        Administracja użytkownikami
                      </p>
                    </Link>
                  </motion.div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

      {/* Versions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Wersje systemu</CardTitle>
            <CardDescription>Informacje o aktualnych wersjach</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between p-3 border rounded-md">
                <span className="text-muted-foreground">Backend</span>
                <span className="font-medium">{backendVersion}</span>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-md">
                <span className="text-muted-foreground">Frontend</span>
                <span className="font-medium">{frontendVersion}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
