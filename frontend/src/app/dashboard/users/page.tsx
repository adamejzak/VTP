"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter,
  Edit,
  Trash2,
  Shield,
  Calendar,
  MoreHorizontal,
  Check,
  X,
  Gamepad2,
  MessageSquare,
  Send
  
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useUserRole } from "@/hooks/use-user-role"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@clerk/nextjs"
import { useApi } from "@/lib/api"

interface User {
  id: string
  clerkId: string
  firstName?: string
  lastName?: string
  role: 'ADMIN' | 'EMPLOYEE' | 'NONE'
  discordId?: string
  isActive: boolean
  imageUrl?: string
  createdAt: string
  updatedAt: string
}

export default function UsersPage() {
  const { userProfile, isAdmin } = useUserRole()
  const { toast } = useToast()
  const { getToken } = useAuth()
  const api = useApi()
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [isEditUserOpen, setIsEditUserOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [newUser, setNewUser] = useState({
    firstName: "",
    lastName: "",
    discordId: "",
    role: "NONE" as const,
  })
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false)
  const [messageData, setMessageData] = useState({
    channelId: "",
    message: "",
    title: "",
    description: "",
    color: "#0099ff"
  })
  const [channels, setChannels] = useState<Array<{id: string, name: string}>>([])
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [isDMDialogOpen, setIsDMDialogOpen] = useState(false)
  const [dmData, setDMData] = useState({
    selectedUsers: [] as string[],
    message: "",
    title: "",
    description: "",
    color: "#0099ff"
  })
  const [isSendingDM, setIsSendingDM] = useState(false)

  // Predefiniowane szablony wiadomości
  const messageTemplates = [
    {
      name: "Ogłoszenie",
      title: "📢 Ogłoszenie",
      description: "Ważna informacja dla zespołu",
      color: "#ff6b35",
      message: ""
    },
    {
      name: "Przypomnienie",
      title: "⏰ Przypomnienie",
      description: "Nie zapomnij o...",
      color: "#f7931e",
      message: ""
    },
    {
      name: "Gratulacje",
      title: "🎉 Gratulacje!",
      description: "Świetna robota!",
      color: "#4caf50",
      message: ""
    },
    {
      name: "Informacja",
      title: "ℹ️ Informacja",
      description: "Przydatna informacja",
      color: "#2196f3",
      message: ""
    },
    {
      name: "Ostrzeżenie",
      title: "⚠️ Uwaga",
      description: "Ważne ostrzeżenie",
      color: "#ff9800",
      message: ""
    }
  ]

  useEffect(() => {
    // Pobieranie prawdziwych danych użytkowników z API
    const fetchUsers = async () => {
      try {
        setIsLoading(true)
        const token = await getToken()
        if (!token) {
          toast({
            title: "Błąd",
            description: "Brak tokenu autoryzacji",
            variant: "destructive"
          })
          return
        }

        const data = await api.getAllUsers(token) as { users: User[] }
        setUsers(data.users || [])
        setFilteredUsers(data.users || [])
      } catch (error) {
        console.error('Error fetching users:', error)
        toast({
          title: "Błąd",
          description: "Nie udało się pobrać listy użytkowników",
          variant: "destructive"
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsers()
  }, [getToken, toast, api])

  // Fetch Discord channels when message dialog opens
  useEffect(() => {
    const fetchChannels = async () => {
      if (isMessageDialogOpen) {
        try {
          const token = await getToken()
          if (!token) return
          
          const channelsData = await api.getServerChannels(token) as { channels: Array<{id: string, name: string, type: number}> }
          // Filter text channels (type 0)
          const textChannels = channelsData.channels?.filter(channel => channel.type === 0) || []
          setChannels(textChannels)
        } catch (error) {
          console.error('Error fetching channels:', error)
          toast({
            title: "Błąd",
            description: "Nie udało się pobrać listy kanałów",
            variant: "destructive"
          })
        }
      }
    }

    fetchChannels()
  }, [isMessageDialogOpen, getToken, toast, api])

  useEffect(() => {
    // Filtrowanie użytkowników
    let filtered = users

    if (searchTerm) {
      filtered = filtered.filter(user => 
        (user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
      )
    }

    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.role === roleFilter)
    }

    setFilteredUsers(filtered)
  }, [users, searchTerm, roleFilter])

  const handleAddUser = async () => {
    if (!newUser.firstName || !newUser.lastName) {
      toast({
        title: "Błąd",
        description: "Wszystkie pola są wymagane",
        variant: "destructive"
      })
      return
    }

    try {
      const token = await getToken()
      if (!token) {
        toast({
          title: "Błąd",
          description: "Brak tokenu autoryzacji",
          variant: "destructive"
        })
        return
      }

      // Tworzenie nowego użytkownika
      const data = await api.createUser({
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        discordId: newUser.discordId || undefined,
        role: newUser.role
      }, token) as { user: User }
      
      // Odśwież listę użytkowników
      const updatedUsers = [...users, data.user]
      setUsers(updatedUsers)
      setNewUser({ firstName: "", lastName: "", discordId: "", role: "NONE" })
      setIsAddUserOpen(false)
      
      toast({
        title: "Sukces",
        description: "Użytkownik został dodany",
      })
    } catch (error) {
      console.error('Error adding user:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się dodać użytkownika",
        variant: "destructive"
      })
    }
  }

  const handleEditUser = async () => {
    if (!selectedUser) return

    try {
      const token = await getToken()
      if (!token) {
        toast({
          title: "Błąd",
          description: "Brak tokenu autoryzacji",
          variant: "destructive"
        })
        return
      }

      // Przygotuj dane do aktualizacji
      const updateData: {
        role?: 'ADMIN' | 'EMPLOYEE' | 'NONE'
        discordId?: string
        newClerkId?: string
        firstName?: string
        lastName?: string
      } = {}

      // Dodaj tylko zmienione pola
      if (selectedUser.role !== 'NONE') {
        updateData.role = selectedUser.role
      }
      
      if (selectedUser.discordId !== undefined) {
        updateData.discordId = selectedUser.discordId
      }

      if (selectedUser.clerkId) {
        updateData.newClerkId = selectedUser.clerkId
      }

      if (selectedUser.firstName !== undefined) {
        updateData.firstName = selectedUser.firstName
      }

      if (selectedUser.lastName !== undefined) {
        updateData.lastName = selectedUser.lastName
      }

      // Wykonaj jedną aktualizację wszystkich danych
      await api.updateUser(selectedUser.clerkId, updateData, token)

      // Odśwież listę użytkowników
      setUsers(prev => prev.map(user => 
        user.clerkId === selectedUser.clerkId ? selectedUser : user
      ))
      
      setIsEditUserOpen(false)
      setSelectedUser(null)
      
      toast({
        title: "Sukces",
        description: "Użytkownik został zaktualizowany",
      })
    } catch (error) {
      console.error('Error updating user:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się zaktualizować użytkownika",
        variant: "destructive"
      })
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (userId === userProfile?.clerkId) {
      toast({
        title: "Błąd",
        description: "Nie możesz usunąć własnego konta",
        variant: "destructive"
      })
      return
    }

    // Potwierdzenie usunięcia
    if (!confirm("Czy na pewno chcesz usunąć tego użytkownika? Ta operacja jest nieodwracalna.")) {
      return
    }

    try {
      const token = await getToken()
      if (!token) {
        toast({
          title: "Błąd",
          description: "Brak tokenu autoryzacji",
          variant: "destructive"
        })
        return
      }

      // Usuń użytkownika całkowicie
      await api.deleteUser(userId, token)

      // Usuń użytkownika z listy
      setUsers(prev => prev.filter(user => user.clerkId !== userId))
      
      toast({
        title: "Sukces",
        description: "Użytkownik został usunięty",
      })
    } catch (error) {
      console.error('Error deleting user:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się usunąć użytkownika",
        variant: "destructive"
      })
    }
  }

  const handleSendMessage = async () => {
    if (!messageData.channelId || (!messageData.message && !messageData.title && !messageData.description)) {
      toast({
        title: "Błąd",
        description: "Wybierz kanał i wprowadź treść wiadomości",
        variant: "destructive"
      })
      return
    }

    try {
      setIsSendingMessage(true)
      const token = await getToken()
      if (!token) {
        toast({
          title: "Błąd",
          description: "Brak tokenu autoryzacji",
          variant: "destructive"
        })
        return
      }

      const messagePayload: any = {
        channelId: messageData.channelId
      }

      if (messageData.message) {
        messagePayload.message = messageData.message
      }

      if (messageData.title || messageData.description) {
        messagePayload.embed = {
          title: messageData.title || undefined,
          description: messageData.description || undefined,
          color: messageData.color,
          timestamp: true
        }
      }

      await api.sendDiscordMessage(messagePayload, token)
      
      toast({
        title: "Sukces",
        description: "Wiadomość została wysłana na Discord",
      })

      // Reset form
      setMessageData({
        channelId: "",
        message: "",
        title: "",
        description: "",
        color: "#0099ff"
      })
      setIsMessageDialogOpen(false)
      
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się wysłać wiadomości",
        variant: "destructive"
      })
    } finally {
      setIsSendingMessage(false)
    }
  }

  const loadMessageTemplate = (template: typeof messageTemplates[0]) => {
    setMessageData(prev => ({
      ...prev,
      title: template.title,
      description: template.description,
      color: template.color,
      message: template.message
    }))
  }

  const loadDMTemplate = (template: typeof messageTemplates[0]) => {
    setDMData(prev => ({
      ...prev,
      title: template.title,
      description: template.description,
      color: template.color,
      message: template.message
    }))
  }

  const handleSendDM = async () => {
    if (dmData.selectedUsers.length === 0 || (!dmData.message && !dmData.title && !dmData.description)) {
      toast({
        title: "Błąd",
        description: "Wybierz użytkowników i wprowadź treść wiadomości",
        variant: "destructive"
      })
      return
    }

    try {
      setIsSendingDM(true)
      const token = await getToken()
      if (!token) {
        toast({
          title: "Błąd",
          description: "Brak tokenu autoryzacji",
          variant: "destructive"
        })
        return
      }

      const messagePayload: any = {
        userIds: dmData.selectedUsers
      }

      if (dmData.message) {
        messagePayload.message = dmData.message
      }

      if (dmData.title || dmData.description) {
        messagePayload.embed = {
          title: dmData.title || undefined,
          description: dmData.description || undefined,
          color: dmData.color,
          timestamp: true
        }
      }

      const result = await api.sendDiscordDM(messagePayload, token) as any
      
      toast({
        title: "Sukces",
        description: `Wiadomość wysłana do ${result.sent} użytkowników${result.failed > 0 ? `, ${result.failed} nie powiodło się` : ''}`,
      })

      // Reset form
      setDMData({
        selectedUsers: [],
        message: "",
        title: "",
        description: "",
        color: "#0099ff"
      })
      setIsDMDialogOpen(false)
      
    } catch (error) {
      console.error('Error sending DM:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się wysłać wiadomości prywatnych",
        variant: "destructive"
      })
    } finally {
      setIsSendingDM(false)
    }
  }

  const toggleUserSelection = (userId: string) => {
    setDMData(prev => ({
      ...prev,
      selectedUsers: prev.selectedUsers.includes(userId)
        ? prev.selectedUsers.filter(id => id !== userId)
        : [...prev.selectedUsers, userId]
    }))
  }

  const selectAllEmployees = () => {
    const employeeDiscordIds = users
      .filter(user => user.role === 'EMPLOYEE' && user.discordId)
      .map(user => user.discordId!)
    
    setDMData(prev => ({
      ...prev,
      selectedUsers: employeeDiscordIds
    }))
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'destructive'
      case 'EMPLOYEE': return 'default'
      case 'NONE': return 'secondary'
      default: return 'outline'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'Administrator'
      case 'EMPLOYEE': return 'Pracownik'
      case 'NONE': return 'Brak roli'
      default: return role
    }
  }

  // Jeśli nie ma userProfile, layout już przekieruje użytkownika
  if (!userProfile) {
    return null
  }

  // Sprawdź czy użytkownik jest administratorem
  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Brak dostępu</h3>
              <p className="text-muted-foreground">
                Tylko administratorzy mogą zarządzać użytkownikami.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
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

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Zarządzanie Użytkownikami</h1>
            <p className="text-muted-foreground">
              Zarządzaj kontami użytkowników i ich uprawnieniami
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto sm:justify-end">
            <Dialog open={isDMDialogOpen} onOpenChange={setIsDMDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Wyślij DM
                </Button>
              </DialogTrigger>
            </Dialog>
            <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Wyślij Wiadomość
                </Button>
              </DialogTrigger>
            </Dialog>
            <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Dodaj Użytkownika
                </Button>
              </DialogTrigger>
              <DialogContent>
              <DialogHeader>
                <DialogTitle>Dodaj nowego użytkownika</DialogTitle>
                <DialogDescription>
                  Wprowadź dane nowego użytkownika.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Imię</Label>
                    <Input
                      id="firstName"
                      value={newUser.firstName}
                      onChange={(e) => setNewUser(prev => ({ ...prev, firstName: e.target.value }))}
                      placeholder="Imię"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nazwisko</Label>
                    <Input
                      id="lastName"
                      value={newUser.lastName}
                      onChange={(e) => setNewUser(prev => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Nazwisko"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discordId">Discord ID (opcjonalnie)</Label>
                  <Input
                    id="discordId"
                    value={newUser.discordId || ""}
                    onChange={(e) => setNewUser(prev => ({ ...prev, discordId: e.target.value }))}
                    placeholder="123456789012345678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rola</Label>
                  <Select value={newUser.role} onValueChange={(value: any) => setNewUser(prev => ({ ...prev, role: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Brak roli</SelectItem>
                      <SelectItem value="EMPLOYEE">Pracownik</SelectItem>
                      <SelectItem value="ADMIN">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>
                  Anuluj
                </Button>
                <Button onClick={handleAddUser}>
                  Dodaj Użytkownika
                </Button>
              </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Wszyscy Użytkownicy</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
              <p className="text-xs text-muted-foreground">
                Łączna liczba kont
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
              <CardTitle className="text-sm font-medium">Pracownicy</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.role === 'EMPLOYEE').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Konta pracowników
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
              <CardTitle className="text-sm font-medium">Administratorzy</CardTitle>
              <Shield className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.role === 'ADMIN').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Konta administratorów
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
              <CardTitle className="text-sm font-medium">Bez roli</CardTitle>
              <Calendar className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.role === 'NONE').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Konta bez przypisanej roli
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filtry i wyszukiwanie</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="search">Wyszukaj</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Imię, nazwisko"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="roleFilter">Rola</Label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie role</SelectItem>
                    <SelectItem value="ADMIN">Administrator</SelectItem>
                    <SelectItem value="EMPLOYEE">Pracownik</SelectItem>
                    <SelectItem value="NONE">Brak roli</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Users List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Lista Użytkowników</CardTitle>
            <CardDescription>
              {filteredUsers.length} z {users.length} użytkowników
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex flex-col items-center gap-4 rounded-lg border p-4 text-center transition-colors hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between sm:text-left"
                >
                  <div className="flex w-full flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-4">
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarImage src={user.imageUrl} />
                      <AvatarFallback>
                        {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex w-full flex-1 flex-col space-y-1 text-center sm:text-left">
                      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                        <p className="font-medium">
                          {user.firstName} {user.lastName}
                        </p>
                        {user.clerkId === userProfile?.clerkId && (
                          <Badge variant="outline" className="text-xs">
                            Ty
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground sm:justify-start">
                        <Calendar className="h-3 w-3" />
                        <span>Dołączono: {new Date(user.createdAt).toLocaleDateString()}</span>
                        {user.updatedAt && (
                          <>
                            <span>•</span>
                            <span>Ostatnia aktualizacja: {new Date(user.updatedAt).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                      {user.discordId && (
                        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground sm:justify-start">
                          <Gamepad2 className="h-3 w-3" />
                          <span>Discord: {user.discordId}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto sm:flex-nowrap sm:justify-end sm:text-left">
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {getRoleLabel(user.role)}
                    </Badge>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full sm:w-auto">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[180px]">
                        <DropdownMenuLabel>Akcje</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUser(user)
                            setIsEditUserOpen(true)
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edytuj
                        </DropdownMenuItem>
                        {user.clerkId !== userProfile?.clerkId && (
                          <DropdownMenuItem
                            onClick={() => handleDeleteUser(user.clerkId)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Usuń
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              ))}

              {filteredUsers.length === 0 && (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold">Brak użytkowników</h3>
                  <p className="text-muted-foreground">
                    {searchTerm || roleFilter !== "all" 
                      ? "Spróbuj zmienić filtry lub wyszukiwanie"
                      : "Nie ma jeszcze żadnych użytkowników"
                    }
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Send DM Dialog */}
      <Dialog open={isDMDialogOpen} onOpenChange={setIsDMDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Wyślij Prywatną Wiadomość</DialogTitle>
            <DialogDescription>
              Wyślij prywatną wiadomość do wybranych pracowników na Discord
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Szablony wiadomości</Label>
              <div className="flex flex-wrap gap-2">
                {messageTemplates.map((template) => (
                  <Button
                    key={template.name}
                    variant="outline"
                    size="sm"
                    onClick={() => loadDMTemplate(template)}
                    className="text-xs"
                  >
                    {template.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Wybierz pracowników ({dmData.selectedUsers.length} wybranych)</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllEmployees}
                    disabled={isSendingDM}
                  >
                    Wszyscy pracownicy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDMData(prev => ({ ...prev, selectedUsers: [] }))}
                    disabled={isSendingDM}
                  >
                    Wyczyść wybór
                  </Button>
                </div>
              </div>
              <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
                <div className="grid grid-cols-1 gap-2">
                  {users
                    .filter(user => user.discordId && user.role !== 'NONE')
                    .map((user) => (
                      <div
                        key={user.id}
                        className={`flex items-center space-x-3 p-2 rounded-md cursor-pointer transition-colors ${
                          dmData.selectedUsers.includes(user.discordId!)
                            ? 'bg-primary/10 border border-primary'
                            : 'hover:bg-accent'
                        }`}
                        onClick={() => toggleUserSelection(user.discordId!)}
                      >
                        <input
                          type="checkbox"
                          checked={dmData.selectedUsers.includes(user.discordId!)}
                          onChange={() => toggleUserSelection(user.discordId!)}
                          className="rounded"
                        />
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.imageUrl} />
                          <AvatarFallback className="text-xs">
                            {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {user.firstName} {user.lastName}
                          </p>
                        </div>
                        <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                          {getRoleLabel(user.role)}
                        </Badge>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dmMessage">Wiadomość tekstowa (opcjonalnie)</Label>
              <Textarea
                id="dmMessage"
                value={dmData.message}
                onChange={(e) => setDMData(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Wprowadź treść wiadomości..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dmTitle">Tytuł embed (opcjonalnie)</Label>
                <Input
                  id="dmTitle"
                  value={dmData.title}
                  onChange={(e) => setDMData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Tytuł..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dmColor">Kolor embed</Label>
                <Input
                  id="dmColor"
                  type="color"
                  value={dmData.color}
                  onChange={(e) => setDMData(prev => ({ ...prev, color: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dmDescription">Opis embed (opcjonalnie)</Label>
              <Textarea
                id="dmDescription"
                value={dmData.description}
                onChange={(e) => setDMData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Wprowadź opis embed..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDMDialogOpen(false)}
              disabled={isSendingDM}
            >
              Anuluj
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setDMData({
                selectedUsers: [],
                message: "",
                title: "",
                description: "",
                color: "#0099ff"
              })}
              disabled={isSendingDM}
            >
              <X className="mr-2 h-4 w-4" />
              Wyczyść
            </Button>
            <Button 
              onClick={handleSendDM}
              disabled={isSendingDM}
            >
              {isSendingDM ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Wysyłanie...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Wyślij DM
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Message Dialog */}
      <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Wyślij Wiadomość na Discord</DialogTitle>
            <DialogDescription>
              Wyślij wiadomość jako bot na wybrany kanał Discord
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Szablony wiadomości</Label>
              <div className="flex flex-wrap gap-2">
                {messageTemplates.map((template) => (
                  <Button
                    key={template.name}
                    variant="outline"
                    size="sm"
                    onClick={() => loadMessageTemplate(template)}
                    className="text-xs"
                  >
                    {template.name}
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="channel">Kanał</Label>
              <Select 
                value={messageData.channelId} 
                onValueChange={(value) => setMessageData(prev => ({ ...prev, channelId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz kanał..." />
                </SelectTrigger>
                <SelectContent>
                  {channels.map(channel => (
                    <SelectItem key={channel.id} value={channel.id}>
                      #{channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="message">Wiadomość tekstowa (opcjonalnie)</Label>
              <Textarea
                id="message"
                value={messageData.message}
                onChange={(e) => setMessageData(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Wprowadź treść wiadomości..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Tytuł embed (opcjonalnie)</Label>
                <Input
                  id="title"
                  value={messageData.title}
                  onChange={(e) => setMessageData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Tytuł..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Kolor embed</Label>
                <Input
                  id="color"
                  type="color"
                  value={messageData.color}
                  onChange={(e) => setMessageData(prev => ({ ...prev, color: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Opis embed (opcjonalnie)</Label>
              <Textarea
                id="description"
                value={messageData.description}
                onChange={(e) => setMessageData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Wprowadź opis embed..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsMessageDialogOpen(false)}
              disabled={isSendingMessage}
            >
              Anuluj
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setMessageData({
                channelId: "",
                message: "",
                title: "",
                description: "",
                color: "#0099ff"
              })}
              disabled={isSendingMessage}
            >
              <X className="mr-2 h-4 w-4" />
              Wyczyść
            </Button>
            <Button 
              onClick={handleSendMessage}
              disabled={isSendingMessage}
            >
              {isSendingMessage ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Wysyłanie...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Wyślij
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj użytkownika</DialogTitle>
            <DialogDescription>
              Zmień dane użytkownika {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editFirstName">Imię</Label>
                  <Input
                    id="editFirstName"
                    value={selectedUser.firstName}
                    onChange={(e) => setSelectedUser(prev => prev ? { ...prev, firstName: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editLastName">Nazwisko</Label>
                  <Input
                    id="editLastName"
                    value={selectedUser.lastName}
                    onChange={(e) => setSelectedUser(prev => prev ? { ...prev, lastName: e.target.value } : null)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editRole">Rola</Label>
                <Select 
                  value={selectedUser.role} 
                  onValueChange={(value: any) => setSelectedUser(prev => prev ? { ...prev, role: value } : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Brak roli</SelectItem>
                    <SelectItem value="EMPLOYEE">Pracownik</SelectItem>
                    <SelectItem value="ADMIN">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editClerkId">Clerk ID</Label>
                <Input
                  id="editClerkId"
                  value={selectedUser.clerkId}
                  onChange={(e) => setSelectedUser(prev => prev ? { ...prev, clerkId: e.target.value } : null)}
                  placeholder="user_1234567890"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editDiscordId">Discord ID</Label>
                <Input
                  id="editDiscordId"
                  value={selectedUser.discordId || ""}
                  onChange={(e) => setSelectedUser(prev => prev ? { ...prev, discordId: e.target.value } : null)}
                  placeholder="123456789012345678"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleEditUser}>
              Zapisz zmiany
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
