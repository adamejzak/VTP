"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { 
  Plus, 
  Edit, 
  Trash2, 
  Building2, 
  Clock,
  MapPin,
  Users,
  Calendar
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useUserRole } from "@/hooks/use-user-role"
import { useAuth } from "@clerk/nextjs"
import { useApi } from "@/lib/api"

interface Store {
  id: string
  name: string
  workingHoursPerDay: {
    monday: number
    tuesday: number
    wednesday: number
    thursday: number
    friday: number
    saturday: number
    sunday: number
  }
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface StoreFormData {
  name: string
  workingHoursPerDay: {
    monday: number
    tuesday: number
    wednesday: number
    thursday: number
    friday: number
    saturday: number
    sunday: number
  }
}

const dayNames = [
  { key: 'monday', label: 'Poniedziałek' },
  { key: 'tuesday', label: 'Wtorek' },
  { key: 'wednesday', label: 'Środa' },
  { key: 'thursday', label: 'Czwartek' },
  { key: 'friday', label: 'Piątek' },
  { key: 'saturday', label: 'Sobota' },
  { key: 'sunday', label: 'Niedziela' }
]

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingStore, setEditingStore] = useState<Store | null>(null)
  const [formData, setFormData] = useState<StoreFormData>({
    name: '',
    workingHoursPerDay: {
      monday: 8,
      tuesday: 8,
      wednesday: 8,
      thursday: 8,
      friday: 8,
      saturday: 4,
      sunday: 0
    }
  })
  const { toast } = useToast()
  const { isAdmin } = useUserRole()
  const { getToken } = useAuth()
  const api = useApi()

  useEffect(() => {
    fetchStores()
  }, [])

  const fetchStores = async () => {
    try {
      const token = await getToken()
      const data: any = await api.getStores(false, token || undefined)
      if (data.success) {
        setStores(data.data)
      } else {
        toast({
          title: "Błąd",
          description: "Nie udało się pobrać listy sklepów",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Wystąpił błąd podczas pobierania sklepów",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const token = await getToken()
      let data: any
      if (editingStore) {
        data = await api.updateStore(editingStore.id, formData as any, token || undefined)
      } else {
        data = await api.createStore(formData as any, token || undefined)
      }
      
      if (data.success) {
        toast({
          title: "Sukces",
          description: editingStore ? "Sklep został zaktualizowany" : "Sklep został utworzony"
        })
        fetchStores()
        resetForm()
      } else {
        toast({
          title: "Błąd",
          description: data.message || "Nie udało się zapisać sklepu",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Wystąpił błąd podczas zapisywania sklepu",
        variant: "destructive"
      })
    }
  }

  const handleDelete = async (storeId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten sklep?')) return
    
    try {
      const token = await getToken()
      const data: any = await api.deleteStore(storeId, token || undefined)
      
      if (data.success) {
        toast({
          title: "Sukces",
          description: "Sklep został usunięty"
        })
        fetchStores()
      } else {
        toast({
          title: "Błąd",
          description: data.message || "Nie udało się usunąć sklepu",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Wystąpił błąd podczas usuwania sklepu",
        variant: "destructive"
      })
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      workingHoursPerDay: {
        monday: 8,
        tuesday: 8,
        wednesday: 8,
        thursday: 8,
        friday: 8,
        saturday: 4,
        sunday: 0
      }
    })
    setEditingStore(null)
    setIsDialogOpen(false)
  }

  const openEditDialog = (store: Store) => {
    setEditingStore(store)
    setFormData({
      name: store.name,
      workingHoursPerDay: store.workingHoursPerDay
    })
    setIsDialogOpen(true)
  }

  const calculateTotalHours = (workingHours: Store['workingHoursPerDay']) => {
    return Object.values(workingHours).reduce((sum, hours) => sum + hours, 0)
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              Nie masz uprawnień do zarządzania sklepami
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Zarządzanie Sklepami</h1>
            <p className="text-muted-foreground">
              Twórz i zarządzaj sklepami oraz ich godzinami pracy
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj Sklep
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingStore ? 'Edytuj Sklep' : 'Dodaj Nowy Sklep'}
                </DialogTitle>
                <DialogDescription>
                  {editingStore 
                    ? 'Zaktualizuj informacje o sklepie' 
                    : 'Wprowadź dane nowego sklepu'
                  }
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nazwa Sklepu</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="np. Olsztyn Śródmieście"
                    required
                  />
                </div>
                
                <div>
                  <Label>Godziny Pracy (na dzień)</Label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    {dayNames.map((day) => (
                      <div key={day.key} className="space-y-2">
                        <Label htmlFor={day.key} className="text-sm">
                          {day.label}
                        </Label>
                        <Input
                          id={day.key}
                          type="number"
                          min="0"
                          max="24"
                          step="0.5"
                          value={formData.workingHoursPerDay[day.key as keyof typeof formData.workingHoursPerDay]}
                          onChange={(e) => setFormData({
                            ...formData,
                            workingHoursPerDay: {
                              ...formData.workingHoursPerDay,
                              [day.key]: parseFloat(e.target.value) || 0
                            }
                          })}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Anuluj
                  </Button>
                  <Button type="submit">
                    {editingStore ? 'Zaktualizuj' : 'Utwórz'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Stores Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((store, index) => (
            <motion.div
              key={store.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * index }}
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{store.name}</CardTitle>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(store)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(store.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    {store.isActive ? 'Aktywny' : 'Nieaktywny'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Łącznie: {calculateTotalHours(store.workingHoursPerDay)}h/tydzień
                      </span>
                    </div>
                    
                    <div className="space-y-1">
                      {dayNames.map((day) => {
                        const hours = store.workingHoursPerDay[day.key as keyof typeof store.workingHoursPerDay]
                        return (
                          <div key={day.key} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{day.label}:</span>
                            <span className="font-medium">{hours}h</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {stores.length === 0 && !loading && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Brak sklepów</h3>
              <p className="text-muted-foreground mb-4">
                Dodaj pierwszy sklep, aby rozpocząć zarządzanie harmonogramem
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj Sklep
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
