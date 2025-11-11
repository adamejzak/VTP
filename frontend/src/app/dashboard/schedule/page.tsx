"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Download,
  Filter,
  Users,
  Building2,
  Clock,
  Bot,
  Edit,
  Trash2,
  Table,
  Check,
  X,
  MoreVertical,
  Loader2
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useUserRole } from "@/hooks/use-user-role"
import { useAuth } from "@clerk/nextjs"
import { apiClient } from "@/lib/api"
import { cn } from "@/lib/utils"

const API_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? 'https://api.panelvtp.xyz' : 'http://localhost:8080')

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
}

interface Employee {
  id: string
  clerkId: string
  email: string
  firstName?: string
  lastName?: string
  employeeCode?: string
  role: 'ADMIN' | 'EMPLOYEE' | 'NONE'
  discordId?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface Assignment {
  id: string
  date: string
  storeId: string
  employeeId: string
  hours: number
  Store: Store
}

interface Schedule {
  id: number
  month: number
  year: number
  isReady: boolean
  assignmentsByDate: Record<string, Record<string, {
    storeId: string
    storeName: string
    hours: number
  }>>
  Assignments: Assignment[]
  employees: Employee[]
  stores: Store[]
}

type PendingAssignmentAction = 'create' | 'update' | 'delete'

interface PendingAssignmentChange {
  storeId: string
  storeName: string
  hours: number
  action: PendingAssignmentAction
  tempAssignmentId?: string
  previousStoreId?: string
  previousStoreName?: string
  previousHours?: number
  requestId: number
}

interface BulkAssignmentChange {
  action: PendingAssignmentAction
  employeeId: string
  day: number
  dateKey: string
  storeId: string
  storeName: string
  hours: number
  assignmentId?: string
  previousAssignment?: {
    storeId: string
    storeName: string
    hours: number
    assignmentId?: string
  }
}

const buildAssignmentKey = (employeeId: string, dateKey: string) => `${employeeId}-${dateKey}`

type FetchScheduleOptions = {
  silent?: boolean
  token?: string
  month?: number
  year?: number
}

const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota']
const monthNames = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
]

const defaultWorkingHoursPerDay: Store['workingHoursPerDay'] = {
  monday: 0,
  tuesday: 0,
  wednesday: 0,
  thursday: 0,
  friday: 0,
  saturday: 0,
  sunday: 0,
}

function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "shimmer-skeleton relative overflow-hidden rounded-md bg-muted/60 dark:bg-muted/30",
        className
      )}
      aria-hidden="true"
    />
  )
}


export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedEmployee, setSelectedEmployee] = useState<string>('none')
  const [selectedStore, setSelectedStore] = useState<string>('none')
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([])
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([])
  const [isRangeDialogOpen, setIsRangeDialogOpen] = useState(false)
  const [rangeStart, setRangeStart] = useState<number>(1)
  const [rangeEnd, setRangeEnd] = useState<number>(1)
  const [rangeEmployee, setRangeEmployee] = useState<string>('none')
  const [rangeStore, setRangeStore] = useState<string>('none')
  const [skipSundays, setSkipSundays] = useState<boolean>(true)
  const [showAllAssignments, setShowAllAssignments] = useState<{day: number, assignments: [string, any][]} | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<{employeeId: string, assignment: any, day: number} | null>(null)
  const [editStoreId, setEditStoreId] = useState<string>('')
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar')
  const [isDaysOffDialogOpen, setIsDaysOffDialogOpen] = useState(false)
  const [selectedEmployeeForDaysOff, setSelectedEmployeeForDaysOff] = useState<string>('')
  const [employeeDaysOff, setEmployeeDaysOff] = useState<{[key: string]: number[]}>({})
  const [notificationSent, setNotificationSent] = useState<boolean>(false)
  const [sendingNotification, setSendingNotification] = useState<boolean>(false)
  const [pendingAssignmentChanges, setPendingAssignmentChanges] = useState<Record<string, PendingAssignmentChange>>({})
  const [isBulkEditMode, setIsBulkEditMode] = useState(false)
  const [bulkAssignmentChanges, setBulkAssignmentChanges] = useState<Record<string, BulkAssignmentChange>>({})
  const [isSavingBulkChanges, setIsSavingBulkChanges] = useState(false)
  const assignmentRequestControllersRef = useRef<Record<string, AbortController>>({})
  const assignmentRequestIdsRef = useRef<Record<string, number>>({})
  const { toast } = useToast()
  const { isAdmin } = useUserRole()
  const { getToken } = useAuth()

  const currentMonth = useMemo(() => currentDate.getMonth(), [currentDate])
  const currentYear = useMemo(() => currentDate.getFullYear(), [currentDate])
  
  const getDaysInMonth = () => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
    const firstDay = new Date(currentYear, currentMonth, 1).getDay()
    const days = []

    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day)
    }

    return days
  }
  
  const daysInCurrentMonth = useMemo(() => getDaysInMonth(), [currentMonth, currentYear])
  const tableDays = useMemo(
    () => daysInCurrentMonth.filter((day): day is number => day !== null),
    [daysInCurrentMonth]
  )
  const assignmentsByDate = schedule?.assignmentsByDate ?? {}
  const assignmentByKey = useMemo(() => {
    if (!schedule?.Assignments) {
      return {}
    }

    return schedule.Assignments.reduce<Record<string, Assignment>>((acc, assignment) => {
      const dateKey = new Date(assignment.date).toISOString().split('T')[0]
      const key = buildAssignmentKey(assignment.employeeId, dateKey)
      acc[key] = assignment
      return acc
    }, {})
  }, [schedule?.Assignments])
  const storesById = useMemo(() => {
    return stores.reduce<Record<string, Store>>((acc, store) => {
      acc[store.id] = store
      return acc
    }, {})
  }, [stores])
  const employeesById = useMemo(() => {
    return employees.reduce<Record<string, Employee>>((acc, employee) => {
      acc[employee.id] = employee
      return acc
    }, {})
  }, [employees])
  const bulkChangesCount = useMemo(
    () => Object.keys(bulkAssignmentChanges).length,
    [bulkAssignmentChanges]
  )

  const fetchSchedule = useCallback(async (options?: FetchScheduleOptions) => {
    const silent = options?.silent ?? false
    const targetMonth = options?.month ?? currentMonth + 1
    const targetYear = options?.year ?? currentYear
    const token = options?.token ?? (await getToken())

    if (!token) {
      if (!silent) {
        setLoading(false)
      }
      return
    }

    const shouldHandleLoadingState = !silent

    if (shouldHandleLoadingState) {
      setLoading(true)
    }

    try {
      const response = await fetch(`${API_URL}/api/schedules/${targetMonth}/${targetYear}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.status === 404) {
        setSchedule(null)
        setNotificationSent(false)
        return
      }
      
      const data = await response.json()
      if (data.success) {
        setSchedule(data.data)
        setNotificationSent(false)
      } else {
        setSchedule(null)
        setNotificationSent(false)
      }
    } catch (error) {
      console.error('Error fetching schedule:', error)
      setSchedule(null)
      setNotificationSent(false)
    } finally {
      if (shouldHandleLoadingState) {
        setLoading(false)
      }
    }
  }, [currentMonth, currentYear, getToken])

  const fetchScheduleForMonth = useCallback(
    async (month: number, year: number, token?: string) => {
      await fetchSchedule({ month, year, token })
    },
    [fetchSchedule]
  )

  const fetchStores = useCallback(
    async (tokenParam?: string) => {
      try {
        const token = tokenParam ?? (await getToken())
        if (!token) return
        
        const data = await apiClient.getStores(true, token) as { success: boolean; data: Store[] }
        if (data.success) {
          setStores(data.data)
        }
      } catch (error) {
        console.error('Error fetching stores:', error)
      }
    },
    [getToken]
  )

  const fetchEmployees = useCallback(
    async (tokenParam?: string) => {
      try {
        const token = tokenParam ?? (await getToken())
        if (!token) return

        const response = await fetch(`${API_URL}/api/auth/employees`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (!response.ok) {
          console.error('Failed to fetch users:', response.status, response.statusText)
          return
        }
        
        const data = await response.json()
        
        if (data.users && Array.isArray(data.users)) {
          setEmployees(data.users)
        } else {
          console.error('Unexpected employees response format:', data)
          setEmployees([])
        }
      } catch (error) {
        console.error('Error fetching users:', error)
        setEmployees([])
      }
    },
    [getToken]
  )

  useEffect(() => {
    let isCancelled = false

    const loadData = async () => {
      const token = await getToken()

      if (!token) {
        if (!isCancelled) {
          setLoading(false)
        }
        return
      }

      if (!isCancelled) {
        setLoading(true)
      }

      try {
        await Promise.all([
          fetchSchedule({
            silent: true,
            token,
            month: currentMonth + 1,
            year: currentYear,
          }),
          fetchStores(token),
          fetchEmployees(token),
        ])
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      isCancelled = true
    }
  }, [currentMonth, currentYear, fetchEmployees, fetchSchedule, fetchStores, getToken])

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setMonth(currentMonth - 1)
    } else {
      newDate.setMonth(currentMonth + 1)
    }
    setCurrentDate(newDate)
  }

  const getAssignmentForDate = (day: number) => {
    const dateKey = new Date(Date.UTC(currentYear, currentMonth, day)).toISOString().split('T')[0]
    return assignmentsByDate[dateKey] || {}
  }

  const handleAddAssignment = async () => {
    if (!selectedDate || selectedEmployee === 'none' || selectedStore === 'none') {
      toast({
        title: "Błąd",
        description: "Wszystkie pola są wymagane",
        variant: "destructive"
      })
      return
    }

    try {
      const hours = getStoreHoursForDate(selectedStore, selectedDate)
      
      const assignments = schedule?.Assignments || []
      const newAssignment = {
        date: selectedDate,
        storeId: selectedStore,
        employeeId: selectedEmployee,
        hours: hours
      }
      

      const token = await getToken()
      const url = `${API_URL}/api/schedules`
        
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          month: currentMonth,
          year: currentYear,
          assignments: [...assignments, newAssignment]
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Add assignment error:', response.status, errorText)
        toast({
          title: "Błąd",
          description: `Nie udało się dodać przypisania: ${response.status} ${errorText}`,
          variant: "destructive"
        })
        return
      }
      
      const data = await response.json()
      if (data.success) {
        toast({
          title: "Sukces",
          description: "Przypisanie zostało dodane"
        })
        fetchSchedule()
        setIsDialogOpen(false)
        resetForm()
      } else {
        toast({
          title: "Błąd",
          description: data.message,
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Wystąpił błąd podczas dodawania przypisania",
        variant: "destructive"
      })
    }
  }

  const resetForm = () => {
    setSelectedDate('')
    setSelectedEmployee('none')
    setSelectedStore('none')
  }

  const openAddDialog = (day: number) => {
    const date = new Date(Date.UTC(currentYear, currentMonth, day))
    setSelectedDate(date.toISOString().split('T')[0])
    setIsDialogOpen(true)
  }

  const exportSchedule = async () => {
    if (!schedule) return

    try {
      const token = await getToken()
      const response = await fetch(`${API_URL}/api/schedules/${schedule.id}/export`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Export failed:', errorText)
        toast({
          title: "Błąd eksportu",
          description: "Nie udało się wyeksportować harmonogramu",
          variant: "destructive",
        })
        return
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `harmonogram-${currentMonth + 1}-${currentYear}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Nie udało się wyeksportować harmonogramu",
        variant: "destructive"
      })
    }
  }

  const exportEmployeeTimesheet = async (employeeId: string, employeeName: string) => {
    if (!schedule) return

    try {
      const token = await getToken()
      const response = await fetch(`${API_URL}/api/schedules/${schedule.id}/timesheet/${employeeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Timesheet export failed:', errorText)
        toast({
          title: "Błąd eksportu",
          description: "Nie udało się wyeksportować godzinówki",
          variant: "destructive",
        })
        return
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const contentDisposition = response.headers.get('Content-Disposition')
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          a.download = filenameMatch[1]
        } else {
          a.download = `godzinowka-${employeeName}-${currentMonth + 1}-${currentYear}.xlsx`
        }
      } else {
        a.download = `godzinowka-${employeeName}-${currentMonth + 1}-${currentYear}.xlsx`
      }
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({
        title: "Sukces",
        description: `Godzinówka dla ${employeeName} została pobrana`,
        variant: "default",
      })
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Nie udało się wyeksportować godzinówki",
        variant: "destructive"
      })
    }
  }

  const generateAISchedule = async () => {
    try {
      const token = await getToken()
      if (!token) return

      toast({
        title: "Generowanie harmonogramu AI",
        description: "Trwa generowanie harmonogramu...",
      })

      const response = await fetch(
        `${API_URL}/api/schedules/${currentMonth + 1}/${currentYear}/ai-generate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            employeeDaysOff: employeeDaysOff
          })
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('AI generation failed:', response.status, errorText)
        throw new Error(`Failed to generate AI schedule: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      
      if (result.success) {
        toast({
          title: "Sukces!",
          description: `Harmonogram AI został wygenerowany (pewność: ${Math.round(result.data.confidence * 100)}%)`,
        })
        
        await fetchScheduleForMonth(currentMonth + 1, currentYear)
      } else {
        throw new Error(result.message || 'Failed to generate AI schedule')
      }
    } catch (error) {
      console.error('Error generating AI schedule:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się wygenerować harmonogramu AI",
        variant: "destructive"
      })
    }
  }

  const handleConfirmGenerateAI = async () => {
    setIsDaysOffDialogOpen(false)
    await generateAISchedule()
  }

  const markScheduleAsReady = async () => {
    try {
      const token = await getToken()
      if (!token) return

      toast({
        title: "Oznaczanie grafiku jako gotowy",
        description: "Trwa przetwarzanie...",
      })

      const response = await fetch(
        `${API_URL}/api/schedules/${currentMonth + 1}/${currentYear}/ready`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Mark as ready failed:', response.status, errorText)
        throw new Error(`Failed to mark schedule as ready: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      
      if (result.success) {
        toast({
          title: "Sukces!",
          description: "Grafik został oznaczony jako gotowy i wysłano powiadomienia!",
        })
        
        await fetchScheduleForMonth(currentMonth + 1, currentYear)
      } else {
        throw new Error(result.message || 'Failed to mark schedule as ready')
      }
    } catch (error) {
      console.error('Error marking schedule as ready:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się oznaczyć grafiku jako gotowy",
        variant: "destructive"
      })
    }
  }

  const markScheduleAsNotReady = async () => {
    try {
      const token = await getToken()
      if (!token) return

      toast({
        title: "Oznaczanie grafiku jako niegotowy",
        description: "Trwa przetwarzanie...",
      })

      const response = await fetch(
        `${API_URL}/api/schedules/${currentMonth + 1}/${currentYear}/ready`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Mark as not ready failed:', response.status, errorText)
        throw new Error(`Failed to mark schedule as not ready: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      
      if (result.success) {
        toast({
          title: "Sukces!",
          description: "Grafik został oznaczony jako niegotowy",
        })
        
        await fetchScheduleForMonth(currentMonth + 1, currentYear)
      } else {
        throw new Error(result.message || 'Failed to mark schedule as not ready')
      }
    } catch (error) {
      console.error('Error marking schedule as not ready:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się oznaczyć grafiku jako niegotowy",
        variant: "destructive"
      })
    }
  }

  const deleteSchedule = async () => {
    if (!schedule) return

    const confirmed = window.confirm('Czy na pewno chcesz usunąć ten harmonogram? Tej operacji nie można cofnąć.')
    if (!confirmed) return

    try {
      const token = await getToken()
      if (!token) return

      toast({
        title: "Usuwanie harmonogramu",
        description: "Trwa usuwanie harmonogramu...",
      })

      const scheduleId = Number.isInteger(schedule.id) ? schedule.id : Number(schedule.id)

      const response = await fetch(
        `${API_URL}/api/schedules/${scheduleId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Delete schedule failed:', response.status, errorText)
        throw new Error(`Failed to delete schedule: ${response.status} ${errorText}`)
      }

      toast({
        title: "Usunięto",
        description: "Harmonogram został usunięty",
      })

      await fetchSchedule()
    } catch (error) {
      console.error('Error deleting schedule:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się usunąć harmonogramu",
        variant: "destructive"
      })
    }
  }

  const toggleDayOff = (day: number) => {
    const currentDaysOff = employeeDaysOff[selectedEmployeeForDaysOff] || []
    const isDayOff = currentDaysOff.includes(day)
    
    if (isDayOff) {
      setEmployeeDaysOff(prev => ({
        ...prev,
        [selectedEmployeeForDaysOff]: currentDaysOff.filter(d => d !== day)
      }))
    } else {
      setEmployeeDaysOff(prev => ({
        ...prev,
        [selectedEmployeeForDaysOff]: [...currentDaysOff, day]
      }))
    }
  }

  const getEmployeeDaysOff = (employeeId: string) => {
    return employeeDaysOff[employeeId] || []
  }

  const createEmptySchedule = async () => {
    try {
      const token = await getToken()
      if (!token) return

      const response = await fetch(`${API_URL}/api/schedules`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          month: currentMonth,
          year: currentYear,
          assignments: []
        })
      })

      const data = await response.json()
      if (data.success) {
        toast({
          title: "Sukces",
          description: "Harmonogram został utworzony"
        })
        await fetchSchedule()
      } else {
        toast({
          title: "Błąd",
          description: data.message,
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error creating schedule:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się utworzyć harmonogramu",
        variant: "destructive"
      })
    }
  }

  const sendScheduleNotification = async () => {
    if (!schedule) {
      toast({
        title: "Błąd",
        description: "Brak harmonogramu do powiadomienia",
        variant: "destructive"
      })
      return
    }

    try {
      setSendingNotification(true)
      const token = await getToken()
      if (!token) return

      const response = await fetch(
        `${API_URL}/api/schedules/${schedule.id}/notify`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Notification failed:', response.status, errorText)
        throw new Error(`Failed to send notification: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      
      if (result.success) {
        setNotificationSent(true)
        const summary = result.summary
        const message = summary 
          ? `Powiadomienia wysłane do ${summary.notified} pracowników (${summary.skipped} bez Discord)`
          : "Powiadomienia zostały wysłane na Discord"
        toast({
          title: "Sukces!",
          description: message,
        })
      } else {
        throw new Error(result.message || 'Failed to send notification')
      }
    } catch (error) {
      console.error('Error sending notification:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się wysłać powiadomień",
        variant: "destructive"
      })
    } finally {
      setSendingNotification(false)
    }
  }

  const handleRangeAssignment = async () => {
    if (rangeEmployee === 'none' || rangeStore === 'none' || rangeStart > rangeEnd) {
      toast({
        title: "Błąd",
        description: "Wszystkie pola są wymagane i zakres musi być poprawny",
        variant: "destructive"
      })
      return
    }

    try {
      const token = await getToken()
      const assignments = schedule?.Assignments || []
      const newAssignments = []

      for (let day = rangeStart; day <= rangeEnd; day++) {
        const date = new Date(Date.UTC(currentYear, currentMonth, day))
        const dayOfWeek = date.getDay() 
        
        if (skipSundays && dayOfWeek === 0) {
          continue
        }
        
        const dateString = date.toISOString().split('T')[0]
        
        const hours = getStoreHoursForDate(rangeStore, dateString)
        
        newAssignments.push({
          date: dateString,
          storeId: rangeStore,
          employeeId: rangeEmployee,
          hours: hours
        })
      }

      const url = `${API_URL}/api/schedules`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          month: currentMonth,
          year: currentYear,
          assignments: [...assignments, ...newAssignments]
        })
      })

      const data = await response.json()
      if (data.success) {
        toast({
          title: "Sukces",
          description: `Dodano przypisania dla ${rangeEnd - rangeStart + 1} dni`
        })
        fetchSchedule()
        setIsRangeDialogOpen(false)
        resetRangeForm()
      } else {
        toast({
          title: "Błąd",
          description: data.message,
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Wystąpił błąd podczas dodawania przypisań",
        variant: "destructive"
      })
    }
  }

  const resetRangeForm = () => {
    setRangeStart(1)
    setRangeEnd(1)
    setRangeEmployee('none')
    setRangeStore('none')
    setSkipSundays(true)
  }

  const showAllAssignmentsForDay = (day: number, assignments: [string, any][]) => {
    setShowAllAssignments({ day, assignments })
  }

  const openEditDialog = (employeeId: string, assignment: any, day: number) => {
    setEditingAssignment({ employeeId, assignment, day })
    setEditStoreId(assignment.storeId)
    setIsEditDialogOpen(true)
  }

  const handleEditAssignment = async () => {
    if (!editingAssignment || !editStoreId) return

    try {
      const token = await getToken()
      if (!token) return

      const newHours = getStoreHoursForDay(editStoreId, editingAssignment.day)
      
      const dateKey = new Date(Date.UTC(currentYear, currentMonth, editingAssignment.day)).toISOString().split('T')[0]
      const realAssignment = schedule?.Assignments?.find(ass => {
        const assDate = new Date(ass.date).toISOString().split('T')[0]
        return ass.employeeId === editingAssignment.employeeId && 
               assDate === dateKey && 
               ass.storeId === editingAssignment.assignment.storeId
      })

      if (!realAssignment) {
        toast({
          title: "Błąd",
          description: "Nie znaleziono przypisania do edycji",
          variant: "destructive"
        })
        return
      }

      const url = `${API_URL}/api/schedules/${currentMonth + 1}/${currentYear}/assignments/${realAssignment.id}`;
      const body = JSON.stringify({
        storeId: editStoreId,
        hours: newHours
      });
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: body
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Update assignment error:', response.status, errorText)
        throw new Error(`Failed to update assignment: ${response.status} ${errorText}`)
      }
      
      toast({
        title: "Sukces",
        description: "Przypisanie zostało zaktualizowane",
      })
      
      // Odśwież dane
      await fetchSchedule()
      
      setIsEditDialogOpen(false)
      setEditingAssignment(null)
      setEditStoreId('')
    } catch (error) {
      console.error('Error editing assignment:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się zaktualizować przypisania",
        variant: "destructive"
      })
    }
  }

  const getStoreHoursForDay = (storeId: string, day: number) => {
    const store = storesById[storeId]
    if (!store || !store.workingHoursPerDay) return 0
    
    const date = new Date(Date.UTC(currentYear, currentMonth, day))
    const dayOfWeek = date.getDay()
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
    const dayName = dayNames[dayOfWeek]
    
    return store.workingHoursPerDay[dayName] || 0
  }

  const getStoreHoursForDate = (storeId: string, dateString: string) => {
    const store = storesById[storeId]
    if (!store || !store.workingHoursPerDay) return 0
    
    const date = new Date(dateString)
    const dayOfWeek = date.getDay()
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
    const dayName = dayNames[dayOfWeek]
    
    return store.workingHoursPerDay[dayName] || 0
  }

  const getEmployeeHoursSummary = () => {
    if (!schedule || !schedule.Assignments) return []

    const employeeHours: Record<string, { employee: Employee; totalHours: number; workDays: Set<string> }> = {}

    schedule.Assignments.forEach(assignment => {
      if (!employeeHours[assignment.employeeId]) {
        const employee = employees.find(emp => emp.id === assignment.employeeId)
        if (!employee) {
          return
        }

        employeeHours[assignment.employeeId] = {
          employee,
          totalHours: 0,
          workDays: new Set<string>()
        }
      }

      const employeeSummary = employeeHours[assignment.employeeId]
      if (!employeeSummary) {
        return
      }

      employeeSummary.totalHours += assignment.hours
      const assignmentDate = new Date(assignment.date).toISOString().split('T')[0]
      employeeSummary.workDays.add(assignmentDate)
    })

    return Object.values(employeeHours)
      .map(({ employee, totalHours, workDays }) => ({
        employee,
        totalHours,
        totalWorkingDays: workDays.size
      }))
      .sort((a, b) => b.totalHours - a.totalHours)
  }

  const addAssignmentToScheduleState = ({
    assignmentId,
    employeeId,
    dateKey,
    day,
    storeId,
    storeName,
    hours,
  }: {
    assignmentId: string
    employeeId: string
    dateKey: string
    day: number
    storeId: string
    storeName: string
    hours: number
  }) => {
    const store = storesById[storeId]
    const resolvedStore: Store = store ?? {
      id: storeId,
      name: storeName || 'Sklep',
      workingHoursPerDay: {
        ...defaultWorkingHoursPerDay,
      },
      isActive: true,
    }
    const assignmentDateIso = new Date(dateKey).toISOString()

    setSchedule(prev => {
      if (!prev) return prev

      const newAssignment: Assignment = {
        id: assignmentId,
        date: assignmentDateIso,
        storeId,
        employeeId,
        hours,
        Store: resolvedStore,
      }

      const existingIndex = prev.Assignments.findIndex(assignment => assignment.id === assignmentId)
      const updatedAssignments =
        existingIndex >= 0
          ? prev.Assignments.map((assignment, index) => (index === existingIndex ? newAssignment : assignment))
          : [...prev.Assignments, newAssignment]

      const updatedAssignmentsByDate = { ...prev.assignmentsByDate }
      const dayAssignments = { ...(updatedAssignmentsByDate[dateKey] || {}) }
      dayAssignments[employeeId] = {
        storeId,
        storeName: resolvedStore.name,
        hours,
      }
      updatedAssignmentsByDate[dateKey] = dayAssignments

      return {
        ...prev,
        Assignments: updatedAssignments,
        assignmentsByDate: updatedAssignmentsByDate,
      }
    })

    setShowAllAssignments(prev => {
      if (!prev || prev.day !== day) return prev

      const updatedEntries = prev.assignments.filter(([entryEmployeeId]) => entryEmployeeId !== employeeId)
      return {
        ...prev,
        assignments: [
          ...updatedEntries,
          [
            employeeId,
            {
              storeId,
              storeName: storeName || 'Sklep',
              hours,
            },
          ],
        ],
      }
    })
  }

  const updateScheduleAssignmentState = ({
    assignmentId,
    employeeId,
    dateKey,
    day,
    storeId,
    hours,
  }: {
    assignmentId: string
    employeeId: string
    dateKey: string
    day: number
    storeId: string
    hours: number
  }) => {
    const store = storesById[storeId]

    setSchedule(prev => {
      if (!prev) return prev

      const updatedAssignments = prev.Assignments.map(assignment =>
        assignment.id === assignmentId
          ? {
              ...assignment,
              storeId,
              hours,
              Store: store ?? assignment.Store,
            }
          : assignment
      )

      const updatedAssignmentsByDate = { ...prev.assignmentsByDate }
      const dayAssignments = { ...(updatedAssignmentsByDate[dateKey] || {}) }
      const previousEntry = dayAssignments[employeeId] || {}
      dayAssignments[employeeId] = {
        ...previousEntry,
        storeId,
        storeName: store?.name ?? previousEntry.storeName ?? 'Sklep',
        hours,
      }
      updatedAssignmentsByDate[dateKey] = dayAssignments

      return {
        ...prev,
        Assignments: updatedAssignments,
        assignmentsByDate: updatedAssignmentsByDate,
      }
    })

    setShowAllAssignments(prev => {
      if (!prev || prev.day !== day) return prev

      const updatedEntries = prev.assignments.map(([entryEmployeeId, entryAssignment]): [string, any] => {
        if (entryEmployeeId !== employeeId) {
          return [entryEmployeeId, entryAssignment]
        }

        const storeName = store?.name ?? entryAssignment?.storeName ?? 'Sklep'

        return [
          entryEmployeeId,
          {
            ...entryAssignment,
            storeId,
            storeName,
            hours,
          },
        ]
      })

      return {
        ...prev,
        assignments: updatedEntries,
      }
    })
  }

  const removeAssignmentFromScheduleState = ({
    assignmentId,
    employeeId,
    dateKey,
    day,
  }: {
    assignmentId: string
    employeeId: string
    dateKey: string
    day: number
  }) => {
    setSchedule(prev => {
      if (!prev) return prev

      const updatedAssignments = prev.Assignments.filter(assignment => assignment.id !== assignmentId)
      const updatedAssignmentsByDate = { ...prev.assignmentsByDate }

      if (updatedAssignmentsByDate[dateKey]) {
        const dayAssignments = { ...updatedAssignmentsByDate[dateKey] }
        delete dayAssignments[employeeId]

        if (Object.keys(dayAssignments).length === 0) {
          delete updatedAssignmentsByDate[dateKey]
        } else {
          updatedAssignmentsByDate[dateKey] = dayAssignments
        }
      }

      return {
        ...prev,
        Assignments: updatedAssignments,
        assignmentsByDate: updatedAssignmentsByDate,
      }
    })

    setShowAllAssignments(prev => {
      if (!prev || prev.day !== day) return prev

      const updatedEntries = prev.assignments.filter(([entryEmployeeId]) => entryEmployeeId !== employeeId)

      return {
        ...prev,
        assignments: updatedEntries,
      }
    })
  }

  const handleBulkAssignmentDraftChange = (employeeId: string, day: number, nextStoreId: string) => {
    const date = new Date(Date.UTC(currentYear, currentMonth, day))
    const dateKey = date.toISOString().split('T')[0]
    const assignmentKey = buildAssignmentKey(employeeId, dateKey)
    const existingAssignment = assignmentByKey[assignmentKey]
    const normalizedStoreId = nextStoreId ?? ''

    setBulkAssignmentChanges(prev => {
      const updated = { ...prev }

      if (normalizedStoreId === '' || normalizedStoreId === 'none') {
        if (!existingAssignment) {
          delete updated[assignmentKey]
          return updated
        }

        updated[assignmentKey] = {
          action: 'delete',
          employeeId,
          day,
          dateKey,
          storeId: '',
          storeName: '',
          hours: 0,
          assignmentId: existingAssignment.id,
          previousAssignment: {
            storeId: existingAssignment.storeId,
            storeName: existingAssignment.Store?.name ?? 'Sklep',
            hours: existingAssignment.hours,
            assignmentId: existingAssignment.id,
          },
        }

        return updated
      }

      const storeName = storesById[normalizedStoreId]?.name ?? 'Sklep'
      const hours = getStoreHoursForDate(normalizedStoreId, dateKey)

      if (existingAssignment) {
        if (existingAssignment.storeId === normalizedStoreId) {
          delete updated[assignmentKey]
          return updated
        }

        updated[assignmentKey] = {
          action: 'update',
          employeeId,
          day,
          dateKey,
          storeId: normalizedStoreId,
          storeName,
          hours,
          assignmentId: existingAssignment.id,
          previousAssignment: {
            storeId: existingAssignment.storeId,
            storeName: existingAssignment.Store?.name ?? storeName,
            hours: existingAssignment.hours,
            assignmentId: existingAssignment.id,
          },
        }

        return updated
      }

      updated[assignmentKey] = {
        action: 'create',
        employeeId,
        day,
        dateKey,
        storeId: normalizedStoreId,
        storeName,
        hours,
      }

      return updated
    })
  }

  const handleStartBulkAssignmentChanges = () => {
    Object.values(assignmentRequestControllersRef.current).forEach(controller => {
      controller.abort()
    })
    assignmentRequestControllersRef.current = {}
    assignmentRequestIdsRef.current = {}
    setPendingAssignmentChanges({})
    setBulkAssignmentChanges({})
    setIsBulkEditMode(true)
  }

  const handleCancelBulkAssignmentChanges = () => {
    setBulkAssignmentChanges({})
    setIsBulkEditMode(false)
  }

  const handleSaveBulkAssignmentChanges = async () => {
    const changes = Object.values(bulkAssignmentChanges)

    if (changes.length === 0) {
      toast({
        title: "Brak zmian",
        description: "Nie wprowadzono żadnych zmian do zapisania",
      })
      return
    }

    try {
      setIsSavingBulkChanges(true)
      const token = await getToken()

      if (!token) {
        throw new Error('Brak tokenu uwierzytelniającego')
      }

      if (!schedule && changes.some(change => change.action !== 'create')) {
        throw new Error('Nie można zaktualizować nieistniejącego harmonogramu')
      }

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }

      const deleteChanges = changes.filter(change => change.action === 'delete')
      const updateChanges = changes.filter(change => change.action === 'update')
      const createChanges = changes.filter(change => change.action === 'create')

      const deleteIds = new Set(
        deleteChanges
          .map(change => change.assignmentId)
          .filter((value): value is string => Boolean(value))
      )
      const updatesMap = new Map(
        updateChanges
          .filter(change => change.assignmentId)
          .map(change => [change.assignmentId as string, change])
      )

      const finalAssignments = (schedule?.Assignments ?? [])
        .filter(assignment => !deleteIds.has(assignment.id))
        .map(assignment => {
          const update = assignment.id ? updatesMap.get(assignment.id) : undefined
          const dateKey = new Date(assignment.date).toISOString().split('T')[0]

          return {
            date: dateKey,
            storeId: update?.storeId ?? assignment.storeId,
            employeeId: assignment.employeeId,
            hours: update?.hours ?? assignment.hours,
          }
        })
        .concat(
          createChanges.map(change => ({
            date: change.dateKey,
            storeId: change.storeId,
            employeeId: change.employeeId,
            hours: change.hours,
          }))
        )

      let response: Response | null = null

      if (schedule) {
        response = await fetch(
          `${API_URL}/api/schedules/${currentMonth + 1}/${currentYear}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              assignments: finalAssignments,
            }),
            signal: AbortSignal.timeout(30000), // 30 second timeout
          }
        )

        if (!response.ok && response.status === 404) {
          response = await fetch(`${API_URL}/api/schedules`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              month: currentMonth,
              year: currentYear,
              assignments: finalAssignments,
            }),
            signal: AbortSignal.timeout(30000),
          })
        }
      } else {
        response = await fetch(`${API_URL}/api/schedules`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            month: currentMonth,
            year: currentYear,
            assignments: finalAssignments,
          }),
          signal: AbortSignal.timeout(30000),
        })
      }

      if (!response || !response.ok) {
        const errorText = response ? await response.text() : 'Brak odpowiedzi serwera'
        const status = response?.status ?? 0
        throw new Error(
          `Nie udało się zapisać zmian: ${status} ${errorText}`.trim()
        )
      }

      try {
        const data = await response.json()
        if (data && data.success === false) {
          throw new Error(data.message || 'Nie udało się zapisać zmian')
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'SyntaxError') {
          throw error
        }
      }

      toast({
        title: "Zapisano zmiany",
      description: `Zapisano ${changes.length} ${changes.length === 1 ? 'zmianę' : 'zmiany'} w harmonogramie`,
      })

      setBulkAssignmentChanges({})
      setIsBulkEditMode(false)
      await fetchSchedule({ silent: true })
    } catch (error) {
      console.error('Error saving bulk assignment changes:', error)
      toast({
        title: "Błąd",
        description:
          error instanceof Error
            ? `${error.message}. Spróbuj ponownie lub wprowadź mniej zmian jednocześnie.`
            : "Nie udało się zapisać zmian",
        variant: "destructive",
      })
    } finally {
      setIsSavingBulkChanges(false)
    }
  }

  const handleTableAssignmentChange = (employeeId: string, day: number, newStoreId: string) => {
    if (isBulkEditMode) {
      handleBulkAssignmentDraftChange(employeeId, day, newStoreId)
      return
    }

    const date = new Date(Date.UTC(currentYear, currentMonth, day))
    const dateString = date.toISOString().split('T')[0]
    const assignmentKey = buildAssignmentKey(employeeId, dateString)

    const existingAssignment = schedule?.Assignments?.find(ass => {
      const assDate = new Date(ass.date).toISOString().split('T')[0]
      return ass.employeeId === employeeId && assDate === dateString
    })

    const previousSnapshot = existingAssignment
      ? {
          assignmentId: existingAssignment.id,
          storeId: existingAssignment.storeId,
          storeName: existingAssignment.Store?.name ?? 'Sklep',
          hours: existingAssignment.hours,
        }
      : null

    const previousStoreId = existingAssignment?.storeId ?? 'none'
    if (newStoreId === previousStoreId) {
      return
    }

    const requestId = (assignmentRequestIdsRef.current[assignmentKey] ?? 0) + 1
    assignmentRequestIdsRef.current[assignmentKey] = requestId

    const previousController = assignmentRequestControllersRef.current[assignmentKey]
    if (previousController) {
      previousController.abort()
      delete assignmentRequestControllersRef.current[assignmentKey]
    }

    if (newStoreId === 'none') {
      if (!existingAssignment) {
        return
      }

      setPendingAssignmentChanges(prev => ({
        ...prev,
        [assignmentKey]: {
          storeId: 'none',
          storeName: '',
          hours: 0,
          action: 'delete',
          previousStoreId: previousSnapshot?.storeId,
          previousStoreName: previousSnapshot?.storeName,
          previousHours: previousSnapshot?.hours,
          requestId,
        },
      }))

      removeAssignmentFromScheduleState({
        assignmentId: existingAssignment.id,
        employeeId,
        dateKey: dateString,
        day,
      })

      handleDeleteAssignment(employeeId, existingAssignment, day, {
        skipStateUpdate: true,
        onSuccess: () => {
          if (assignmentRequestIdsRef.current[assignmentKey] !== requestId) {
            return
          }
          setPendingAssignmentChanges(prev => {
            const current = prev[assignmentKey]
            if (!current || current.requestId !== requestId) {
              return prev
            }
            const { [assignmentKey]: _, ...rest } = prev
            return rest
          })
        },
        onError: () => {
          if (assignmentRequestIdsRef.current[assignmentKey] !== requestId) {
            return
          }
          if (previousSnapshot) {
            addAssignmentToScheduleState({
              assignmentId: previousSnapshot.assignmentId,
              employeeId,
              dateKey: dateString,
              day,
              storeId: previousSnapshot.storeId,
              storeName: previousSnapshot.storeName,
              hours: previousSnapshot.hours,
            })
          }
          setPendingAssignmentChanges(prev => {
            const current = prev[assignmentKey]
            if (!current || current.requestId !== requestId) {
              return prev
            }
            const { [assignmentKey]: _, ...rest } = prev
            return rest
          })
        },
      })
      return
    }

    if (!schedule) {
      toast({
        title: "Błąd",
        description: "Harmonogram nie został załadowany",
        variant: "destructive",
      })
      return
    }

    const targetStore = storesById[newStoreId]
    const hours = getStoreHoursForDate(newStoreId, dateString)
    const storeName = targetStore?.name ?? 'Sklep'
    const tempAssignmentId = existingAssignment ? undefined : `temp-${employeeId}-${dateString}-${Date.now()}`

    const controller = new AbortController()
    assignmentRequestControllersRef.current[assignmentKey] = controller

    setPendingAssignmentChanges(prev => ({
      ...prev,
      [assignmentKey]: {
        storeId: newStoreId,
        storeName,
        hours,
        action: existingAssignment ? 'update' : 'create',
        tempAssignmentId,
        previousStoreId: previousSnapshot?.storeId,
        previousStoreName: previousSnapshot?.storeName,
        previousHours: previousSnapshot?.hours,
        requestId,
      },
    }))

    if (existingAssignment) {
      updateScheduleAssignmentState({
        assignmentId: existingAssignment.id,
        employeeId,
        dateKey: dateString,
        day,
        storeId: newStoreId,
        hours,
      })
    } else if (tempAssignmentId) {
      addAssignmentToScheduleState({
        assignmentId: tempAssignmentId,
        employeeId,
        dateKey: dateString,
        day,
        storeId: newStoreId,
        storeName,
        hours,
      })
    }

    const performUpdate = async () => {
      try {
        const token = await getToken()
        if (!token) {
          throw new Error('Brak tokenu uwierzytelniającego')
        }

        if (existingAssignment) {
          const url = `${API_URL}/api/schedules/${currentMonth + 1}/${currentYear}/assignments/${existingAssignment.id}`
          const body = JSON.stringify({
            storeId: newStoreId,
            hours,
          })

          const response = await fetch(url, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body,
            signal: controller.signal,
          })

          if (!response.ok) {
            const errorText = await response.text()
            console.error('Update assignment error:', response.status, errorText)
            throw new Error(`Failed to update assignment: ${response.status} ${errorText}`)
          }

          let responseData: any = null
          try {
            responseData = await response.json()
          } catch {
            responseData = null
          }

          if (responseData && responseData.success === false) {
            throw new Error(responseData.message || 'Failed to update assignment')
          }

          if (assignmentRequestIdsRef.current[assignmentKey] !== requestId) {
            return
          }

          const updatedAssignment = responseData?.data
          if (updatedAssignment) {
            updateScheduleAssignmentState({
              assignmentId: updatedAssignment.id ?? existingAssignment.id,
              employeeId,
              dateKey: dateString,
              day,
              storeId: updatedAssignment.storeId ?? newStoreId,
              hours: updatedAssignment.hours ?? hours,
            })
          }
        } else {
          const assignments = schedule.Assignments || []
          const newAssignment = {
            date: dateString,
            storeId: newStoreId,
            employeeId,
            hours,
          }

          let response = await fetch(
            `${API_URL}/api/schedules/${currentMonth + 1}/${currentYear}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                assignments: [...assignments, newAssignment],
              }),
              signal: controller.signal,
            }
          )

          if (!response.ok && response.status === 400) {
            const errorText = await response.text()
            if (assignmentRequestIdsRef.current[assignmentKey] !== requestId) {
              return
            }
            if (errorText.includes('not found')) {
              response = await fetch(
                `${API_URL}/api/schedules`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    month: currentMonth,
                    year: currentYear,
                    assignments: [...assignments, newAssignment],
                  }),
                  signal: controller.signal,
                }
              )
            } else {
              console.error('Add assignment error:', response.status, errorText)
              throw new Error(`Failed to add assignment: ${response.status} ${errorText}`)
            }
          }

          if (!response.ok) {
            const errorText = await response.text()
            console.error('Add assignment error:', response.status, errorText)
            throw new Error(`Failed to add assignment: ${response.status} ${errorText}`)
          }

          let data: any = null
          try {
            data = await response.json()
          } catch {
            data = null
          }

          if (data && data.success === false) {
            throw new Error(data.message || 'Failed to add assignment')
          }

          if (assignmentRequestIdsRef.current[assignmentKey] !== requestId) {
            return
          }

          await fetchSchedule({ silent: true })
        }
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'name' in error &&
          (error as { name?: string }).name === 'AbortError'
        ) {
          return
        }

        console.error('Error updating table assignment:', error)
        if (assignmentRequestIdsRef.current[assignmentKey] !== requestId) {
          return
        }

        toast({
          title: "Błąd",
          description: error instanceof Error ? error.message : "Nie udało się zaktualizować przypisania",
          variant: "destructive",
        })

        if (existingAssignment && previousSnapshot) {
          updateScheduleAssignmentState({
            assignmentId: previousSnapshot.assignmentId,
            employeeId,
            dateKey: dateString,
            day,
            storeId: previousSnapshot.storeId,
            hours: previousSnapshot.hours,
          })
        }

        if (!existingAssignment && tempAssignmentId) {
          removeAssignmentFromScheduleState({
            assignmentId: tempAssignmentId,
            employeeId,
            dateKey: dateString,
            day,
          })
        }
      } finally {
        setPendingAssignmentChanges(prev => {
          const current = prev[assignmentKey]
          if (!current || current.requestId !== requestId) {
            return prev
          }
          const { [assignmentKey]: _, ...rest } = prev
          return rest
        })

        if (assignmentRequestControllersRef.current[assignmentKey] === controller) {
          delete assignmentRequestControllersRef.current[assignmentKey]
        }
      }
    }

    void performUpdate()
  }

  const handleDeleteAssignment = async (
    employeeId: string,
    assignment: any,
    day: number,
    options?: { onSuccess?: () => void; onError?: () => void; skipStateUpdate?: boolean }
  ) => {
    try {
      const token = await getToken()
      if (!token) {
        options?.onError?.()
        return
      }

      const dateKey = new Date(Date.UTC(currentYear, currentMonth, day)).toISOString().split('T')[0]
      
      let realAssignment = schedule?.Assignments?.find(ass => {
        const assDate = new Date(ass.date).toISOString().split('T')[0]
        return ass.employeeId === employeeId && 
               assDate === dateKey && 
               ass.storeId === assignment.storeId
      })

      if (!realAssignment) {
        realAssignment = schedule?.Assignments?.find(ass => {
          const assDate = new Date(ass.date).toISOString().split('T')[0]
          return assDate === dateKey && ass.storeId === assignment.storeId
        })
      }

      if (!realAssignment) {
        toast({
          title: "Błąd",
          description: "Nie znaleziono przypisania do usunięcia",
          variant: "destructive"
        })
        options?.onError?.()
        return
      }

      const response = await fetch(
        `${API_URL}/api/schedules/${currentMonth + 1}/${currentYear}/assignments/${realAssignment.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to delete assignment: ${response.status} ${errorText}`)
      }
      
      toast({
        title: "Sukces",
        description: "Przypisanie zostało usunięte",
      })

      if (!options?.skipStateUpdate) {
        removeAssignmentFromScheduleState({
          assignmentId: realAssignment.id,
          employeeId,
          dateKey,
          day,
        })
      }
      options?.onSuccess?.()
    } catch (error) {
      console.error('Error deleting assignment:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się usunąć przypisania",
        variant: "destructive"
      })
      options?.onError?.()
    }
  }

  const filteredEmployees = useMemo(() => {
    if (selectedEmployeeIds.length === 0) {
      return employees
    }

    return employees.filter(emp => selectedEmployeeIds.includes(emp.id))
  }, [employees, selectedEmployeeIds])


  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:gap-3 sm:text-left">
              <h1 className="text-3xl font-bold tracking-tight">Harmonogram Pracy</h1>
              <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto sm:justify-start">
                {loading ? (
                  <ShimmerSkeleton className="h-7 w-32 rounded-full" />
                ) : schedule ? (
                  <div
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                      schedule.isReady
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                        : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
                    }`}
                  >
                    {schedule.isReady ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {schedule.isReady ? 'Gotowy' : 'W przygotowaniu'}
                  </div>
                ) : (
                  <div className="rounded-full bg-muted/80 px-3 py-1 text-sm font-medium text-muted-foreground dark:bg-muted/40">
                    Harmonogram nieutworzony
                  </div>
                )}
                {isAdmin && (
                  loading ? (
                    <ShimmerSkeleton className="h-7 w-7 rounded-full" />
                  ) : schedule ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Zarządzaj harmonogramem</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {schedule.isReady ? (
                          <DropdownMenuItem onClick={markScheduleAsNotReady}>
                            <X className="h-4 w-4 mr-2" />
                            Oznacz jako niegotowy
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={markScheduleAsReady}>
                            <Check className="h-4 w-4 mr-2" />
                            Oznacz jako gotowy
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={deleteSchedule} className="text-red-600 focus:text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Usuń harmonogram
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null
                )}
              </div>
            </div>
            <p className="text-muted-foreground text-center sm:text-left">
              Zarządzaj harmonogramem pracowników w sklepach
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 sm:flex-nowrap lg:flex-shrink-0 lg:justify-end">
            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsRangeDialogOpen(true)}
                  className="whitespace-nowrap"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Szybkie wypełnienie
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsDaysOffDialogOpen(true)}
                  className="whitespace-nowrap"
                >
                  <Bot className="h-4 w-4 mr-2" />
                  Generuj grafik
                </Button>
              </>
            )}
            {schedule && (
              <>
                <Button
                  variant="outline"
                  onClick={exportSchedule}
                  className="whitespace-nowrap"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Eksportuj
                </Button>
                {isAdmin && !schedule.isReady && (
                  <Button
                    variant="default"
                    onClick={markScheduleAsReady}
                    className="whitespace-nowrap"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Oznacz jako gotowy
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Month Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center justify-center gap-2 sm:gap-4">
                <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')} className="shrink-0">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-2xl font-semibold">
                  {monthNames[currentMonth]} {currentYear}
                </h2>
                <Button variant="outline" size="sm" onClick={() => navigateMonth('next')} className="shrink-0">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            <div className="flex w-full flex-wrap justify-center gap-2 lg:w-auto lg:justify-center">
              <div className="flex w-full border rounded-lg sm:w-auto">
                <Button
                  variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('calendar')}
                  className="rounded-r-none flex-1 sm:flex-none"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Kalendarz
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="rounded-l-none flex-1 sm:flex-none"
                >
                  <Table className="h-4 w-4 mr-2" />
                  Tabela
                </Button>
              </div>
            </div>
              <div className="flex w-full flex-wrap items-center justify-center gap-2 lg:w-auto lg:justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="whitespace-nowrap">
                      <Users className="h-4 w-4 mr-2" />
                      {selectedEmployeeIds.length === 0
                        ? 'Pracownicy: wszyscy'
                        : `Pracownicy (${selectedEmployeeIds.length})`}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 max-h-64 overflow-auto">
                    <DropdownMenuItem
                      onClick={() => setSelectedEmployeeIds([])}
                      className="text-red-600"
                    >
                      Wyczyść filtr
                    </DropdownMenuItem>
                    
                    {employees.map(employee => (
                      <DropdownMenuCheckboxItem
                        key={employee.id}
                        checked={selectedEmployeeIds.includes(employee.id)}
                        onCheckedChange={(checked) => {
                          setSelectedEmployeeIds(prev => checked ? [...prev, employee.id] : prev.filter(id => id !== employee.id))
                        }}
                        className="capitalize"
                      >
                        {employee.firstName && employee.lastName 
                          ? `${employee.firstName} ${employee.lastName}` 
                          : employee.email}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="whitespace-nowrap">
                      <Building2 className="h-4 w-4 mr-2" />
                      {selectedStoreIds.length === 0
                        ? 'Sklepy: wszystkie'
                        : `Sklepy (${selectedStoreIds.length})`}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 max-h-64 overflow-auto">
                    <DropdownMenuItem
                      onClick={() => setSelectedStoreIds([])}
                      className="text-red-600"
                    >
                      Wyczyść filtr
                    </DropdownMenuItem>
                    
                    {stores.map(store => (
                      <DropdownMenuCheckboxItem
                        key={store.id}
                        checked={selectedStoreIds.includes(store.id)}
                        onCheckedChange={(checked) => {
                          setSelectedStoreIds(prev => checked ? [...prev, store.id] : prev.filter(id => id !== store.id))
                        }}
                      >
                        {store.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
        </Card>
      </motion.div>

      {/* Calendar Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card>
          <CardContent className="p-4 sm:p-6">
            {loading ? (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="grid min-w-[720px] grid-cols-7 gap-2">
                  {[...Array(35)].map((_, i) => (
                    <ShimmerSkeleton key={i} className="h-48 rounded-lg border border-border/40" />
                  ))}
                </div>
              </div>
            ) : viewMode === 'table' ? (
              <div className="space-y-4">
                {isAdmin && (
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      {!isBulkEditMode ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleStartBulkAssignmentChanges}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Włącz edycję zbiorczą
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelBulkAssignmentChanges}
                            disabled={isSavingBulkChanges}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Anuluj edycję
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveBulkAssignmentChanges}
                            disabled={isSavingBulkChanges || bulkChangesCount === 0}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            {isSavingBulkChanges ? 'Zapisywanie...' : 'Zapisz zmiany'}
                          </Button>
                        </>
                      )}
                    </div>
                    {isBulkEditMode && (
                      <div className="text-sm text-muted-foreground">
                        {bulkChangesCount > 0
                          ? `Niezapisane zmiany: ${bulkChangesCount}`
                          : 'Brak zmian do zapisania'}
                      </div>
                    )}
                  </div>
                )}
                {isBulkEditMode && (
                  <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-sm text-muted-foreground">
                    Tryb edycji zbiorczej aktywny. Wprowadź zmiany w tabeli, a następnie zapisz lub anuluj.
                  </div>
                )}
                <div className="relative">
                  {isSavingBulkChanges && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "overflow-x-auto -mx-4 sm:mx-0",
                      isSavingBulkChanges ? "pointer-events-none opacity-50" : ""
                    )}
                  >
                    <table className="w-full min-w-[720px] border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Pracownik</th>
                        {tableDays.map(day => {
                          const date = new Date(Date.UTC(currentYear, currentMonth, day))
                          const dayOfWeek = date.getDay()
                          const dayName = dayNames[dayOfWeek]
                          const isSaturday = dayOfWeek === 6
                          const isSunday = dayOfWeek === 0
                          const dayHighlightClass = isSaturday
                            ? 'bg-yellow-50 dark:bg-yellow-900/20 text-amber-700 dark:text-amber-200'
                            : isSunday
                              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200'
                              : ''
                          return (
                            <th
                              key={`table-header-${day}`}
                              className={`text-center p-2 font-medium min-w-[180px] ${dayHighlightClass}`}
                            >
                              <div className="flex flex-col">
                                <span className="text-sm font-bold">{day}</span>
                                <span className="text-xs text-muted-foreground">{dayName}</span>
                              </div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map(employee => (
                        <tr key={employee.id} className="border-b hover:bg-muted/50">
                          <td className="p-2">
                            <div>
                              <p className="font-medium">
                                {employee.firstName && employee.lastName 
                                  ? `${employee.firstName} ${employee.lastName}` 
                                  : employee.email}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {employee.employeeCode}
                              </p>
                            </div>
                          </td>
                          {tableDays.map(day => {
                            const date = new Date(Date.UTC(currentYear, currentMonth, day))
                            const dateString = date.toISOString().split('T')[0]
                            const dayOfWeek = date.getDay()
                            const isSaturday = dayOfWeek === 6
                            const isSunday = dayOfWeek === 0
                            const dayHighlightClass = isSaturday
                              ? 'bg-yellow-50 dark:bg-yellow-900/10'
                              : isSunday
                                ? 'bg-red-50 dark:bg-red-900/10'
                                : ''
                            const assignmentKey = buildAssignmentKey(employee.id, dateString)
                            const dayAssignments = assignmentsByDate[dateString] || {}
                            const baseAssignment = dayAssignments[employee.id]
                            const pendingChange = !isBulkEditMode ? pendingAssignmentChanges[assignmentKey] : undefined
                            const isPendingDelete = pendingChange?.action === 'delete'
                            const bulkChange = isBulkEditMode ? bulkAssignmentChanges[assignmentKey] : undefined
                            const isBulkDelete = bulkChange?.action === 'delete'

                            const pendingStoreName =
                              pendingChange?.storeName ||
                              (pendingChange?.storeId ? storesById[pendingChange.storeId]?.name : undefined)
                            const bulkStoreName =
                              bulkChange?.storeName ||
                              (bulkChange?.storeId ? storesById[bulkChange.storeId]?.name : undefined)

                            const displayAssignment = (() => {
                              if (isBulkEditMode) {
                                if (isBulkDelete) {
                                  return null
                                }
                                if (bulkChange) {
                                  return {
                                    storeId: bulkChange.storeId,
                                    storeName: bulkStoreName ?? baseAssignment?.storeName ?? 'Sklep',
                                    hours: bulkChange.hours ?? baseAssignment?.hours ?? 0,
                                  }
                                }
                                return baseAssignment ?? null
                              }

                              if (isPendingDelete) {
                                return null
                              }

                              if (pendingChange) {
                                return {
                                  storeId: pendingChange.storeId,
                                  storeName: pendingStoreName ?? baseAssignment?.storeName ?? 'Sklep',
                                  hours: pendingChange.hours ?? baseAssignment?.hours ?? 0,
                                }
                              }

                              return baseAssignment ?? null
                            })()

                            const selectValue = (() => {
                              if (isBulkEditMode) {
                                if (isBulkDelete) {
                                  return 'none'
                                }
                                return displayAssignment?.storeId ?? ''
                              }
                              return displayAssignment?.storeId ?? ''
                            })()

                            const selectLabel = displayAssignment
                              ? displayAssignment.storeName ||
                                storesById[displayAssignment.storeId]?.name ||
                                'Sklep'
                              : isBulkDelete
                                ? 'Do usunięcia'
                                : 'Sklep'

                            const cellClassNames = cn(
                              "p-2 min-w-[180px] align-top",
                              dayHighlightClass,
                              isBulkEditMode && bulkChange ? "border border-primary/60 bg-primary/10" : ""
                            )

                            return (
                              <td
                                key={`table-cell-${employee.id}-${day}`}
                                className={cellClassNames}
                                data-pending={pendingChange ? 'true' : 'false'}
                              >
                                {displayAssignment ? (
                                  isAdmin ? (
                                    <div className="text-xs bg-primary/10 rounded px-2 py-1">
                                      <Select
                                        value={selectValue}
                                        onValueChange={(nextStoreId) => {
                                          if (nextStoreId !== selectValue) {
                                            handleTableAssignmentChange(employee.id, day, nextStoreId)
                                          }
                                        }}
                                        disabled={isBulkEditMode ? isSavingBulkChanges : false}
                                      >
                                        <SelectTrigger className="h-6 text-xs border-0 bg-transparent p-0 focus:ring-0 pl-0">
                                          <SelectValue>
                                            {isBulkEditMode && isBulkDelete ? (
                                              <span className="font-medium text-destructive">
                                                Do usunięcia
                                              </span>
                                            ) : (
                                              <span className="font-medium">
                                                {selectLabel}
                                              </span>
                                            )}
                                          </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem key="delete" value="none" className="pl-2 text-red-600">
                                            🗑️ Usuń
                                          </SelectItem>
                                          {stores.map(store => (
                                            <SelectItem key={store.id} value={store.id} className="pl-2">
                                              {store.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  ) : (
                                    <div className="text-xs bg-primary/10 rounded px-2 py-1">
                                      <span className="font-medium">{selectLabel}</span>
                                    </div>
                                  )
                                ) : (
                                  isAdmin ? (
                                    <div className="text-xs bg-primary/10 rounded px-2 py-1">
                                      <Select
                                        value=""
                                        onValueChange={(nextStoreId) => {
                                          if (nextStoreId) {
                                            handleTableAssignmentChange(employee.id, day, nextStoreId)
                                          }
                                        }}
                                        disabled={isBulkEditMode ? isSavingBulkChanges : false}
                                      >
                                        <SelectTrigger className="h-6 text-xs border-0 bg-transparent p-0 focus:ring-0 pl-0">
                                          <SelectValue placeholder={
                                            isBulkEditMode
                                              ? bulkChange?.action === 'delete'
                                                ? 'Usunięto'
                                                : 'Dodaj'
                                              : isPendingDelete
                                                ? 'Usuwanie...'
                                                : 'Dodaj'
                                          } />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {stores.map(store => (
                                            <SelectItem key={store.id} value={store.id} className="pl-2">
                                              {store.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  ) : (
                                    <div className="text-xs bg-muted/50 text-muted-foreground rounded px-2 py-1">
                                      {isBulkEditMode
                                        ? isBulkDelete
                                          ? 'Do usunięcia'
                                          : 'Brak'
                                        : isPendingDelete
                                          ? 'Usuwanie...'
                                          : 'Brak'}
                                    </div>
                                  )
                                )}
                                {isBulkEditMode && bulkChange && (
                                  <div className="mt-1 text-[10px] font-medium text-primary">
                                    {bulkChange.action === 'delete'
                                      ? 'Zmiana oczekuje na usunięcie'
                                      : 'Zmiana oczekuje na zapis'}
                                  </div>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            ) : loading ? (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="grid min-w-[720px] grid-cols-7 gap-2">
                  {[...Array(35)].map((_, i) => (
                    <ShimmerSkeleton key={i} className="h-48 rounded-lg border border-border/40" />
                  ))}
                </div>
              </div>
            ) : !schedule ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <Calendar className="h-16 w-16 text-muted-foreground" />
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Brak harmonogramu</h3>
                  <p className="text-muted-foreground">
                    Harmonogram na {monthNames[currentMonth]} {currentYear} nie został jeszcze utworzony.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Utwórz harmonogram, aby móc dodawać przypisania i zarządzać grafikiem.
                  </p>
                </div>
                {isAdmin && (
                  <Button onClick={createEmptySchedule}>
                    <Plus className="h-4 w-4 mr-2" />
                    Utwórz harmonogram
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-[720px]">
                  <div className="grid grid-cols-7 gap-2">
                    {/* Day headers */}
                    {dayNames.map(day => (
                      <div key={day} className="p-2 text-center font-medium text-muted-foreground">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-7 gap-2">
                    {/* Calendar days */}
                    {getDaysInMonth().map((day, index) => {
                      if (day === null) {
                        return <div key={index} className="h-48"></div>
                      }

                      const date = new Date(Date.UTC(currentYear, currentMonth, day))
                      const dayOfWeek = date.getDay()
                      const isToday = date.toDateString() === new Date().toDateString()
                      const isSaturday = dayOfWeek === 6
                      const isSunday = dayOfWeek === 0
                      const weekendBackgroundClass = isSunday
                        ? 'bg-red-50 dark:bg-red-900/20'
                        : isSaturday
                          ? 'bg-yellow-50 dark:bg-yellow-900/20'
                          : ''
                      const weekendDayTextClass = isSunday
                        ? 'text-red-600 dark:text-red-200'
                        : isSaturday
                          ? 'text-amber-700 dark:text-amber-200'
                          : ''
                      const assignments = getAssignmentForDate(day)
                      const filteredAssignments = Object.entries(assignments).filter(([employeeId, assignment]) => {
                        const storeId = assignment.storeId
                        const employeePass = selectedEmployeeIds.length === 0 || selectedEmployeeIds.includes(employeeId)
                        const storePass = selectedStoreIds.length === 0 || selectedStoreIds.includes(storeId)
                        return employeePass && storePass
                      })

                      return (
                        <motion.div
                          key={`grid-${day}`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3, delay: 0.05 * index }}
                          className={`h-48 p-2 border rounded-lg flex flex-col ${isAdmin ? 'cursor-pointer hover:bg-accent' : 'cursor-default'} transition-colors ${weekendBackgroundClass} ${
                            isToday ? 'bg-primary/10 border-primary' : ''
                          }`}
                          onClick={isAdmin ? () => openAddDialog(day) : undefined}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className={`text-sm font-medium ${isToday ? 'text-primary' : weekendDayTextClass}`}>
                              {day}
                            </span>
                            {isAdmin && (
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                <Plus className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          <div className="space-y-1 flex-1 overflow-y-auto pr-1">
                            {filteredAssignments.map(([employeeId, assignment]) => {
                              const employee = employees.find(emp => emp.id === employeeId)
                              const store = storesById[assignment.storeId]
                              return (
                                <div 
                                  key={employeeId} 
                                  className="text-xs bg-primary/10 rounded px-1 py-0.5 hover:bg-primary/20 transition-colors cursor-pointer group relative"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                  }}
                                >
                                  <div className="font-medium truncate">
                                    {employee?.firstName && employee?.lastName 
                                      ? `${employee.firstName} ${employee.lastName}` 
                                      : employee?.email}
                                  </div>
                                  <div className="text-muted-foreground truncate">
                                    {store?.name} ({assignment.hours}h)
                                  </div>
                                  {/* Menu edycji - pokazuje się na hover */}
                                  {isAdmin && (
                                    <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <div className="flex space-x-1">
                                        <Button 
                                          size="sm" 
                                          variant="ghost" 
                                          className="h-6 w-6 p-0 hover:bg-primary/20"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            openEditDialog(employeeId, assignment, day)
                                          }}
                                          title="Edytuj przypisanie"
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="ghost" 
                                          className="h-6 w-6 p-0 text-destructive hover:bg-destructive/20"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleDeleteAssignment(employeeId, assignment, day)
                                          }}
                                          title="Usuń przypisanie"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
            

            {/* Employee Hours Summary */}
            {schedule && schedule.Assignments && schedule.Assignments.length > 0 && (
              <div className="mt-8 pt-6 border-t">
                <h3 className="text-lg font-semibold mb-4">Podsumowanie godzin - {monthNames[currentMonth]} {currentYear}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getEmployeeHoursSummary().map(({ employee, totalHours, totalWorkingDays }) => (
                    <div key={employee.id} className="bg-muted/50 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {employee.firstName && employee.lastName 
                              ? `${employee.firstName} ${employee.lastName}` 
                              : employee.email}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {employee.employeeCode}
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-2xl font-bold text-primary">
                            {totalHours}h
                          </p>
                          <p className="text-xs text-muted-foreground">
                            łącznie
                          </p>
                          <p className="text-xs text-muted-foreground">
                            dni pracujące: {totalWorkingDays}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="w-full"
                          onClick={() => exportEmployeeTimesheet(
                            employee.id, 
                            employee.firstName && employee.lastName 
                              ? `${employee.firstName} ${employee.lastName}` 
                              : employee.email
                          )}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Pobierz godzinówkę
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      

      {/* Add Assignment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj Przypisanie</DialogTitle>
            <DialogDescription>
              Przypisz pracownika do sklepu na wybrany dzień
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label
                id="add-assignment-employee-label"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Pracownik
              </label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger aria-labelledby="add-assignment-employee-label">
                  <SelectValue placeholder="Wybierz pracownika" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.firstName && employee.lastName 
                        ? `${employee.firstName} ${employee.lastName}` 
                        : employee.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label
                id="add-assignment-store-label"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Sklep
              </label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger aria-labelledby="add-assignment-store-label">
                  <SelectValue placeholder="Wybierz sklep" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map(store => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleAddAssignment}>
              Dodaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Range Assignment Dialog */}
      <Dialog open={isRangeDialogOpen} onOpenChange={setIsRangeDialogOpen}>
        <DialogContent className="w-full max-w-[calc(100vw-2.5rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Szybkie wypełnienie zakresu</DialogTitle>
            <DialogDescription>
              Przypisz pracownika do sklepu na wybrany zakres dni
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rangeStart">Dzień początkowy</Label>
                <Input
                  id="rangeStart"
                  type="number"
                  min="1"
                  max="31"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(parseInt(e.target.value) || 1)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="rangeEnd">Dzień końcowy</Label>
                <Input
                  id="rangeEnd"
                  type="number"
                  min="1"
                  max="31"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(parseInt(e.target.value) || 1)}
                  required
                />
              </div>
            </div>
            <div>
              <label
                id="range-assignment-employee-label"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Pracownik
              </label>
              <Select value={rangeEmployee} onValueChange={setRangeEmployee}>
                <SelectTrigger aria-labelledby="range-assignment-employee-label">
                  <SelectValue placeholder="Wybierz pracownika" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.firstName && employee.lastName 
                        ? `${employee.firstName} ${employee.lastName}` 
                        : employee.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label
                id="range-assignment-store-label"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Sklep
              </label>
              <Select value={rangeStore} onValueChange={setRangeStore}>
                <SelectTrigger aria-labelledby="range-assignment-store-label">
                  <SelectValue placeholder="Wybierz sklep" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map(store => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="skipSundays"
                checked={skipSundays}
                onChange={(e) => setSkipSundays(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="skipSundays" className="text-sm">
                Pomijaj niedziele
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRangeDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleRangeAssignment}>
              Dodaj zakres
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* All Assignments Modal */}
      <Dialog open={!!showAllAssignments} onOpenChange={() => setShowAllAssignments(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Wszystkie przypisania - {showAllAssignments?.day} {monthNames[currentMonth]} {currentYear}
            </DialogTitle>
            <DialogDescription>
              Pełna lista pracowników przypisanych do tego dnia
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {showAllAssignments?.assignments.map(([employeeId, assignment]) => {
              const employee = employees.find(emp => emp.id === employeeId)
              const store = storesById[assignment.storeId]
              return (
                <div key={employeeId} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">
                      {employee?.firstName && employee?.lastName 
                        ? `${employee.firstName} ${employee.lastName}` 
                        : employee?.email}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {store?.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{assignment.hours}h</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(assignment.date).toLocaleDateString('pl-PL')}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAllAssignments(null)}>
              Zamknij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Assignment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj Przypisanie</DialogTitle>
            <DialogDescription>
              Zmień szczegóły przypisania pracownika
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editDate">Data</Label>
              <Input
                id="editDate"
                type="date"
                value={editingAssignment ? new Date(currentYear, currentMonth, editingAssignment.day).toISOString().split('T')[0] : ''}
                disabled
              />
            </div>
            <div>
              <label
                id="edit-assignment-employee-label"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Pracownik
              </label>
              <Select value={editingAssignment?.employeeId || 'none'} disabled>
                <SelectTrigger aria-labelledby="edit-assignment-employee-label">
                  <SelectValue placeholder="Wybierz pracownika" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.firstName && employee.lastName 
                        ? `${employee.firstName} ${employee.lastName}` 
                        : employee.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label
                id="edit-assignment-store-label"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Sklep
              </label>
              <Select value={editStoreId} onValueChange={setEditStoreId}>
                <SelectTrigger aria-labelledby="edit-assignment-store-label">
                  <SelectValue placeholder="Wybierz sklep" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map(store => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="editHours">Godziny</Label>
              <Input
                id="editHours"
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={editingAssignment && editStoreId ? getStoreHoursForDay(editStoreId, editingAssignment.day) : 0}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Godziny są automatycznie pobierane ze sklepu dla tego dnia
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={handleEditAssignment}>
              Zapisz zmiany
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Days Off Dialog */}
      <Dialog open={isDaysOffDialogOpen} onOpenChange={setIsDaysOffDialogOpen}>
        <DialogContent className="w-full max-w-[calc(100vw-2.5rem)] max-h-[calc(100vh-3rem)] overflow-y-auto sm:max-w-4xl sm:max-h-[calc(100vh-4rem)]">
          <DialogHeader>
            <DialogTitle>Zarządzaj dniami wolnymi</DialogTitle>
            <DialogDescription>
              Wybierz dni wolne dla pracowników przed generowaniem harmonogramu
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label>Pracownik</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {employees.map(employee => {
                  const employeeLabel = employee.firstName && employee.lastName
                    ? `${employee.firstName} ${employee.lastName}`
                    : employee.email
                  const isSelected = selectedEmployeeForDaysOff === employee.id

                  return (
                    <Button
                      key={employee.id}
                      type="button"
                      size="sm"
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => setSelectedEmployeeForDaysOff(employee.id)}
                      aria-pressed={isSelected}
                      className="whitespace-nowrap"
                    >
                      {employeeLabel}
                    </Button>
                  )
                })}
              </div>
            </div>
            
            {selectedEmployeeForDaysOff && (
              <div>
                <Label>Dni wolne w {monthNames[currentMonth]} {currentYear}</Label>
                <div className="grid grid-cols-7 gap-2 mt-2">
                  {getDaysInMonth().map((day, index) => {
                    if (day === null) {
                      return <div key={index} className="h-10"></div>
                    }
                    
                    const date = new Date(Date.UTC(currentYear, currentMonth, day))
                    const dayOfWeek = date.getDay()
                    const isSaturday = dayOfWeek === 6
                    const isSunday = dayOfWeek === 0
                    const isDayOff = getEmployeeDaysOff(selectedEmployeeForDaysOff).includes(day)
                    
                    return (
                      <button
                        key={`dayoff-${day}`}
                        type="button"
                        onClick={() => toggleDayOff(day)}
                        className={`h-10 w-10 rounded border text-sm font-medium transition-colors ${
                          isDayOff
                            ? 'bg-red-500 text-white border-red-500'
                            : isSunday
                              ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-700 cursor-not-allowed'
                              : isSaturday
                                ? 'bg-yellow-50 text-amber-700 border-yellow-200 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-amber-200 dark:border-yellow-700'
                                : 'bg-background hover:bg-accent border-border'
                        }`}
                        disabled={isSunday}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Czerwone dni = wolne, żółte = soboty, czerwone wygaszone = niedziele (nie można wybrać)
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDaysOffDialogOpen(false)}
            >
              Anuluj
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsDaysOffDialogOpen(false)
                toast({
                  title: "Zapisano",
                  description: "Dni wolne zostały zapisane",
                })
              }}
            >
              Zapisz dni wolne
            </Button>
            <Button type="button" onClick={handleConfirmGenerateAI}>
              Potwierdź i generuj grafik
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
