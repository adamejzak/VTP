"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { 
  Bot, 
  Users, 
  Hash, 
  Shield, 
  Crown,
  Settings,
  Activity,
  MessageSquare,
  Calendar,
  TrendingUp
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useUserRole } from "@/hooks/use-user-role"
import { apiClient } from "@/lib/api"
import { DiscordServer, ServerMember } from "@/types"

// Using types from the types file instead of local interfaces

export default function ServerPage() {
  const { userProfile, getToken } = useUserRole()
  const [serverData, setServerData] = useState<DiscordServer | null>(null)
  const [members, setMembers] = useState<ServerMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchServerData = async () => {
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

        // Fetch server data and members in parallel
        const [serverResponse, membersResponse] = await Promise.allSettled([
          apiClient.getServer(token),
          apiClient.getServerMembers(50, 0, token)
        ])

        if (serverResponse.status === 'fulfilled') {
          setServerData(serverResponse.value as DiscordServer)
        } else {
          console.error('Failed to fetch server data:', serverResponse.reason)
          setError('Nie udało się załadować danych serwera')
        }

        if (membersResponse.status === 'fulfilled') {
          const membersData = membersResponse.value as any
          setMembers(membersData.members || membersData)
        } else {
          console.error('Failed to fetch server members:', membersResponse.reason)
          // Don't set error for members as it's not critical
        }

      } catch (err) {
        console.error('Error fetching server data:', err)
        setError('Nie udało się załadować danych serwera')
      } finally {
        setIsLoading(false)
      }
    }

    fetchServerData()
  }, [getToken])

  // Jeśli nie ma userProfile, layout już przekieruje użytkownika
  if (!userProfile) {
    return null
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

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Błąd ładowania</h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!serverData) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Brak serwera</h3>
              <p className="text-muted-foreground">
                Bot nie jest obecnie na żadnym serwerze Discord.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Server Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center space-x-4">
          <div className="relative">
            {serverData.icon ? (
              <img
                src={serverData.icon}
                alt={serverData.name}
                className="h-16 w-16 rounded-full"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-8 w-8 text-primary" />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-500 border-2 border-background"></div>
          </div>
          <div>
            <h1 className="text-3xl font-bold">{serverData.name}</h1>
            <p className="text-muted-foreground">
              Discord Server Management
            </p>
          </div>
        </div>
      </motion.div>

      {/* Server Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{serverData.memberCount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Total server members
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
              <CardTitle className="text-sm font-medium">Channels</CardTitle>
              <Hash className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">24</div>
              <p className="text-xs text-muted-foreground">
                Text and voice channels
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
              <CardTitle className="text-sm font-medium">Roles</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">
                Server roles configured
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
              <CardTitle className="text-sm font-medium">Bot Status</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-sm font-medium">Online</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Bot is running normally
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Server Details */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle>Server Information</CardTitle>
                  <CardDescription>
                    Basic information about your Discord server
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Server ID</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {serverData.id}
                    </code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Owner ID</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {serverData.ownerId}
                    </code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Joined</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(serverData.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Features</span>
                    <div className="flex flex-wrap gap-2">
                      {serverData.features.map((feature) => (
                        <Badge key={feature} variant="secondary">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  </div>
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
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>
                    Common server management tasks
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start" variant="outline">
                    <Settings className="mr-2 h-4 w-4" />
                    Server Settings
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Send Announcement
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Calendar className="mr-2 h-4 w-4" />
                    Schedule Event
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    View Analytics
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        <TabsContent value="members" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Server Members</CardTitle>
                <CardDescription>
                  Manage server members and their roles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                      <div className="relative">
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            alt={member.username}
                            className="h-10 w-10 rounded-full"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <Users className="h-5 w-5" />
                          </div>
                        )}
                        {member.isBot && (
                          <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-blue-500 border-2 border-background flex items-center justify-center">
                            <Bot className="h-2 w-2 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{member.displayName}</span>
                          {member.isBot && (
                            <Badge variant="secondary" className="text-xs">
                              Bot
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {member.username}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {member.roles.map((role) => (
                          <Badge
                            key={role.id}
                            variant="outline"
                            className="text-xs"
                            style={{ borderColor: `#${role.color.toString(16).padStart(6, '0')}` }}
                          >
                            {role.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="channels" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Server Channels</CardTitle>
                <CardDescription>
                  Manage text and voice channels
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Hash className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">Channel Management</h3>
                  <p className="text-muted-foreground">
                    Channel management features will be available soon.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Bot Permissions</CardTitle>
                <CardDescription>
                  Current bot permissions in this server
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {serverData.permissions.map((permission) => (
                    <div key={permission} className="flex items-center space-x-3">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span className="text-sm font-medium">{permission}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
