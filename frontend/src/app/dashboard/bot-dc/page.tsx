"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { 
  Bot, 
  Gamepad2, 
  Activity, 
  Play,
  Pause,
  Volume2,
  Eye,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trophy,
  Medal,
  Award
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUserRole } from "@/hooks/use-user-role"
import { useToast } from "@/hooks/use-toast"
import { DiscordBotStatus, DiscordBotInfo, DickRankingResponse, DickRankingEntry } from "@/types"
import { apiClient } from "@/lib/api"

const statusOptions = [
  { value: 'PLAYING', label: 'Gra w', icon: Play },
  { value: 'WATCHING', label: 'Ogląda', icon: Eye },
  { value: 'LISTENING', label: 'Słucha', icon: Volume2 },
  { value: 'STREAMING', label: 'Streamuje', icon: Activity },
  { value: 'COMPETING', label: 'Rywalizuje w', icon: Gamepad2 },
]

export default function BotDCPage() {
  const { userProfile, getToken } = useUserRole()
  const { toast } = useToast()
  const [botInfo, setBotInfo] = useState<DiscordBotInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [newStatus, setNewStatus] = useState<DiscordBotStatus>({
    type: 'PLAYING',
    name: '',
    url: ''
  })
  const [rankingData, setRankingData] = useState<DickRankingResponse | null>(null)
  const [rankingPeriod, setRankingPeriod] = useState<'all' | 'week' | 'month'>('all')
  const [isLoadingRanking, setIsLoadingRanking] = useState(false)

  useEffect(() => {
    // Only fetch bot info if user is authenticated
    if (!userProfile) return

    const fetchBotInfo = async () => {
      setIsLoading(true)
      try {
        const token = await getToken()
        if (!token) {
          setIsLoading(false)
          return
        }

        const botData = await apiClient.getBotInfo(token) as DiscordBotInfo
        setBotInfo(botData)
      } catch (error) {
        console.error('Failed to fetch bot info:', error)
        toast({
          title: "Błąd",
          description: "Nie udało się pobrać informacji o bocie",
          variant: "destructive"
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchBotInfo()
  }, [userProfile, getToken, toast])

  // Automatically load ranking when component mounts or period changes
  useEffect(() => {
    if (!userProfile) return
    
    fetchRanking(rankingPeriod)
  }, [userProfile, rankingPeriod, getToken, toast])


  const fetchRanking = async (period: 'all' | 'week' | 'month' = 'all') => {
    setIsLoadingRanking(true)
    try {
      const token = await getToken()
      if (!token) {
        setIsLoadingRanking(false)
        return
      }

      const data = await apiClient.getDickRanking(period, token) as DickRankingResponse
      setRankingData(data)
    } catch (error) {
      console.error('Failed to fetch ranking:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się pobrać rankingu",
        variant: "destructive"
      })
    } finally {
      setIsLoadingRanking(false)
    }
  }


  // Jeśli nie ma userProfile, layout już przekieruje użytkownika
  if (!userProfile) {
    return null
  }

  const handleStatusUpdate = async () => {
    if (!newStatus.name.trim()) {
      toast({
        title: "Błąd",
        description: "Nazwa statusu nie może być pusta",
        variant: "destructive"
      })
      return
    }

    setIsUpdating(true)
    try {
      const token = await getToken()
      if (!token) {
        toast({
          title: "Błąd",
          description: "Brak autoryzacji",
          variant: "destructive"
        })
        return
      }

      await apiClient.updateBotStatus(newStatus, token)
      
      setBotInfo(prev => prev ? {
        ...prev,
        activity: newStatus
      } : null)
      
      toast({
        title: "Sukces",
        description: "Status bota został zaktualizowany",
      })
    } catch (error) {
      console.error('Failed to update bot status:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się zaktualizować statusu bota",
        variant: "destructive"
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleStatusClear = async () => {
    setIsUpdating(true)
    try {
      const token = await getToken()
      if (!token) {
        toast({
          title: "Błąd",
          description: "Brak autoryzacji",
          variant: "destructive"
        })
        return
      }

      await apiClient.clearBotStatus(token)
      
      setBotInfo(prev => prev ? {
        ...prev,
        activity: null
      } : null)
      
      toast({
        title: "Sukces",
        description: "Status bota został wyczyszczony",
      })
    } catch (error) {
      console.error('Failed to clear bot status:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się wyczyścić statusu bota",
        variant: "destructive"
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'idle': return 'bg-yellow-500'
      case 'dnd': return 'bg-red-500'
      case 'offline': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'online': return 'Online'
      case 'idle': return 'Zaraz wracam'
      case 'dnd': return 'Nie przeszkadzać'
      case 'offline': return 'Offline'
      default: return 'Nieznany'
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (!botInfo) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Bot nie jest dostępny</h3>
              <p className="text-muted-foreground">
                Nie można połączyć się z botem Discord.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Bot Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:gap-4 sm:text-left">
          <div className="relative">
            {botInfo.avatar ? (
              <img
                src={botInfo.avatar}
                alt={botInfo.username}
                className="h-16 w-16 rounded-full"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-8 w-8 text-primary" />
              </div>
            )}
            <div className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-background ${getStatusColor(botInfo.status)}`}></div>
          </div>
          <div>
            <h1 className="text-3xl font-bold">{botInfo.username}</h1>
            <p className="text-muted-foreground">
              Zarządzanie botem Discord
            </p>
          </div>
        </div>
      </motion.div>

      {/* Bot Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <div className={`h-2 w-2 rounded-full ${getStatusColor(botInfo.status)}`}></div>
                <span className="text-sm font-medium">{getStatusLabel(botInfo.status)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Aktualny status bota
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Serwery</CardTitle>
              <Gamepad2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{botInfo.guilds}</div>
              <p className="text-xs text-muted-foreground">
                Połączone serwery
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Użytkownicy</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{botInfo.users.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Obsługiwani użytkownicy
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Czas działania</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{botInfo.uptime}</div>
              <p className="text-xs text-muted-foreground">
                Od ostatniego restartu
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bot Management */}
      <Tabs defaultValue="status" className="space-y-6">
        <TabsList className="flex w-full justify-center gap-2 sm:w-auto">
          <TabsTrigger value="status">Status</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Aktualny Status</CardTitle>
                  <CardDescription>
                    Obecny status aktywności bota
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {botInfo.activity ? (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        <span className="text-sm font-medium">
                          {statusOptions.find(opt => opt.value === botInfo.activity?.type)?.label} {botInfo.activity.name}
                        </span>
                      </div>
                      {botInfo.activity.url && (
                        <div className="text-sm text-muted-foreground">
                          URL: {botInfo.activity.url}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-3">
                      <div className="h-2 w-2 rounded-full bg-gray-500"></div>
                      <span className="text-sm font-medium">Brak aktywności</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Zmień Status</CardTitle>
                  <CardDescription>
                    Ustaw nowy status aktywności bota
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="status-type">Typ statusu</Label>
                    <Select 
                      value={newStatus.type} 
                      onValueChange={(value: any) => setNewStatus(prev => ({ ...prev, type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center space-x-2">
                              <option.icon className="h-4 w-4" />
                              <span>{option.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="status-name">Nazwa</Label>
                    <Input
                      id="status-name"
                      placeholder="np. antoni w wannie..."
                      value={newStatus.name}
                      onChange={(e) => setNewStatus(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  
                  {newStatus.type === 'STREAMING' && (
                    <div className="space-y-2">
                      <Label htmlFor="status-url">URL streamu</Label>
                      <Input
                        id="status-url"
                        placeholder="https://twitch.tv/username"
                        value={newStatus.url || ''}
                        onChange={(e) => setNewStatus(prev => ({ ...prev, url: e.target.value }))}
                      />
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                    <Button 
                      onClick={handleStatusUpdate} 
                      disabled={isUpdating || !newStatus.name.trim()}
                      className="w-full sm:flex-1"
                    >
                      {isUpdating ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Aktualizowanie...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Ustaw Status
                        </>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleStatusClear}
                      disabled={isUpdating}
                      className="w-full sm:w-auto"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Wyczyść
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        <TabsContent value="ranking" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 text-center lg:flex-row lg:items-center lg:justify-between lg:text-left">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center justify-center gap-2 lg:justify-start">
                      <Trophy className="h-5 w-5" />
                      <span>Ranking Penisa</span>
                    </CardTitle>
                    <CardDescription>
                      Ranking użytkowników według średniego rozmiaru
                    </CardDescription>
                  </div>
                  <div className="flex w-full flex-wrap items-center justify-center gap-2 lg:w-auto lg:justify-end">
                    <Select value={rankingPeriod} onValueChange={(value: any) => {
                      setRankingPeriod(value)
                      fetchRanking(value)
                    }}>
                      <SelectTrigger className="w-full sm:w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Wszystkie</SelectItem>
                        <SelectItem value="week">Tydzień</SelectItem>
                        <SelectItem value="month">Miesiąc</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => fetchRanking(rankingPeriod)}
                      disabled={isLoadingRanking}
                      className="w-full sm:w-auto"
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoadingRanking ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingRanking ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : rankingData ? (
                  <div className="space-y-4">
                    {rankingData.rankings.length > 0 ? (
                      <>
                        <div className="grid grid-cols-1 gap-3">
                          {rankingData.rankings.map((entry, index) => (
                            <motion.div
                              key={entry.userId}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, delay: index * 0.1 }}
                              className={`flex flex-col items-center gap-4 rounded-lg border p-4 text-center sm:flex-row sm:items-center sm:gap-4 sm:text-left ${
                                index === 0 ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800' :
                                index === 1 ? 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700' :
                                index === 2 ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800' :
                                'bg-background'
                              }`}
                            >
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                {index === 0 ? <Trophy className="h-5 w-5 text-yellow-600" /> :
                                 index === 1 ? <Medal className="h-5 w-5 text-gray-600" /> :
                                 index === 2 ? <Award className="h-5 w-5 text-orange-600" /> :
                                 <span className="text-sm font-bold">{entry.rank}</span>}
                              </div>
                              
                              <div className="relative">
                                {entry.avatar ? (
                                  <img
                                    src={entry.avatar}
                                    alt={entry.displayName}
                                    className="h-10 w-10 rounded-full"
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                    <Bot className="h-5 w-5" />
                                  </div>
                                )}
                              </div>
                              
                              <div className="w-full flex-1">
                                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                                  <span className="font-medium">{entry.displayName}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {entry.totalMeasurements} pomiarów
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  @{entry.username}
                                </p>
                              </div>
                              
                              <div className="w-full text-center sm:w-auto sm:text-right">
                                <div className="text-lg font-bold">
                                  {entry.averageSize} cm
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  średnia
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                        
                        <div className="text-center text-sm text-muted-foreground pt-4 border-t">
                          Łącznie {rankingData.totalUsers} użytkowników, {rankingData.totalMeasurements} pomiarów
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold">Brak danych</h3>
                        <p className="text-muted-foreground">
                          {rankingData.message || 'Brak pomiarów w wybranym okresie'}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-muted-foreground">
                      <Trophy className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <p>Brak danych rankingowych</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

      </Tabs>
    </div>
  )
}
