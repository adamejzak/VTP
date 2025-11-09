"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Bell, 
  X, 
  CheckCheck, 
  Trash2, 
  Info, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Calendar,
  MessageSquare,
  Settings
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@clerk/nextjs"
import { useApi } from "@/lib/api"

interface Notification {
  id: string
  title: string
  message?: string
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'TASK' | 'SCHEDULE' | 'MESSAGE'
  read: boolean
  actionUrl?: string
  createdAt: string
}

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'SUCCESS': return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'WARNING': return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    case 'ERROR': return <XCircle className="h-4 w-4 text-red-500" />
    case 'TASK': return <CheckCircle className="h-4 w-4 text-blue-500" />
    case 'SCHEDULE': return <Calendar className="h-4 w-4 text-purple-500" />
    case 'MESSAGE': return <MessageSquare className="h-4 w-4 text-indigo-500" />
    default: return <Info className="h-4 w-4 text-blue-500" />
  }
}

const getNotificationColor = (type: Notification['type']) => {
  switch (type) {
    case 'SUCCESS': return 'border-l-green-500'
    case 'WARNING': return 'border-l-yellow-500'
    case 'ERROR': return 'border-l-red-500'
    case 'TASK': return 'border-l-blue-500'
    case 'SCHEDULE': return 'border-l-purple-500'
    case 'MESSAGE': return 'border-l-indigo-500'
    default: return 'border-l-blue-500'
  }
}

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'Przed chwilą'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min temu`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} godz. temu`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} dni temu`
  
  return date.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const isMarkingRef = useRef(false)
  const { toast } = useToast()
  const { getToken } = useAuth()
  const api = useApi()

  const HIDE_AFTER_HOURS = 24 // Hide notifications older than 24 hours

  const isNotificationOld = (createdAt: string) => {
    const notificationDate = new Date(createdAt)
    const now = new Date()
    const hoursDiff = (now.getTime() - notificationDate.getTime()) / (1000 * 60 * 60)
    return hoursDiff > HIDE_AFTER_HOURS
  }

  const fetchNotifications = async () => {
    try {
      setIsLoading(true)
      const token = await getToken()
      if (!token) return

      const [notificationsResponse, countResponse] = await Promise.all([
        api.getNotifications({ limit: 20 }, token) as Promise<{ notifications: Notification[] }>,
        api.getNotificationCount(token) as Promise<{ count: number }>
      ])

      // Filter out old notifications and read notifications
      const filteredNotifications = (notificationsResponse.notifications || [])
        .filter(notification => !isNotificationOld(notification.createdAt))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      setNotifications(filteredNotifications)
      setUnreadCount(countResponse.count || 0)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const notification = notifications.find(n => n.id === notificationId)
      if (notification?.read) {
        return
      }

      const token = await getToken()
      if (!token) return

      await api.markNotificationAsRead(notificationId, token)
      
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się oznaczyć powiadomienia jako przeczytane",
        variant: "destructive"
      })
    }
  }

  const markAllAsRead = async () => {
    try {
      if (isMarkingRef.current) {
        return
      }
      isMarkingRef.current = true

      const token = await getToken()
      if (!token) return

      await api.markAllNotificationsAsRead(token)
      
      setNotifications(prev => prev.map(notification => ({
        ...notification,
        read: true,
      })))
      setUnreadCount(0)
      
      toast({
        title: "Sukces",
        description: "Wszystkie powiadomienia zostały oznaczone jako przeczytane",
      })
    } catch (error) {
      console.error('Error marking all as read:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się oznaczyć powiadomień jako przeczytane",
        variant: "destructive"
      })
    } finally {
      isMarkingRef.current = false
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      const token = await getToken()
      if (!token) return

      await api.deleteNotification(notificationId, token)
      
      const wasUnread = notifications.find(n => n.id === notificationId)?.read === false
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
      
      toast({
        title: "Sukces",
        description: "Powiadomienie zostało usunięte",
      })
    } catch (error) {
      console.error('Error deleting notification:', error)
      toast({
        title: "Błąd",
        description: "Nie udało się usunąć powiadomienia",
        variant: "destructive"
      })
    }
  }


  useEffect(() => {
    fetchNotifications()
    
    // Refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])


  // Remove old notifications from display
  useEffect(() => {
    const interval = setInterval(() => {
      setNotifications(prev => 
        prev.filter(notification => !isNotificationOld(notification.createdAt))
      )
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!isOpen || isMarkingRef.current) {
      return
    }

    const unreadNotifications = notifications.filter(notification => !notification.read)
    if (unreadNotifications.length === 0) {
      return
    }

    let isActive = true

    const markNotifications = async () => {
      try {
        isMarkingRef.current = true
        const token = await getToken()
        if (!token) return

        await api.markAllNotificationsAsRead(token)
        if (!isActive) return

        setNotifications(prev => prev.map(notification => ({
          ...notification,
          read: true,
        })))
        setUnreadCount(0)
      } catch (error) {
        console.error('Error marking notifications as read:', error)
      } finally {
        isMarkingRef.current = false
      }
    }

    markNotifications()

    return () => {
      isActive = false
    }
  }, [isOpen, notifications, api, getToken])


  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id)
    
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl
    }
  }


  return (
    <HoverCard open={isOpen} onOpenChange={setIsOpen} openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          onClick={() => setIsOpen(prev => !prev)}
          aria-expanded={isOpen}
          aria-label="Powiadomienia"
        >
          <Bell className="h-5 w-5" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-[10px] text-destructive-foreground flex items-center justify-center font-medium"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </HoverCardTrigger>
      <HoverCardContent
        align="end"
        sideOffset={8}
        className="w-[min(90vw,24rem)] p-0 sm:w-96"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-base font-semibold">
            Powiadomienia
          </h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-8 text-xs"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Oznacz wszystkie
            </Button>
          )}
        </div>

        <ScrollArea
          className="w-full min-h-[8rem] max-h-[65vh] sm:max-h-[28rem]"
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center p-4">
              <Bell className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Brak powiadomień
              </p>
            </div>
          ) : (
            <div className="p-2">
              {notifications.map((notification) => {
                const isUnread = !notification.read

                return (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "group relative mb-2 rounded-lg border-l-4 p-3 transition-all duration-200 cursor-pointer",
                      getNotificationColor(notification.type),
                      isUnread ? "bg-accent/50 hover:bg-accent/70" : "bg-muted/40 hover:bg-muted/60"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="mt-0.5 flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium break-words">
                            {notification.title}
                          </p>
                          <div className="flex items-center gap-1">
                            <Badge
                              variant={isUnread ? "default" : "outline"}
                              className="text-[10px] uppercase tracking-wide flex-shrink-0"
                            >
                              {isUnread ? "Nowe" : "Wyświetlone"}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteNotification(notification.id)
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {notification.message && (
                          <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line break-words">
                            {notification.message}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </ScrollArea>

      </HoverCardContent>
    </HoverCard>
  )
}
