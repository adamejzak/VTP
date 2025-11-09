"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import {
  Bot,
  Calendar,
  CheckSquare,
  Home,
  Settings,
  Users,
  Shield,
  BarChart3,
  UserCog,
  Building2,
  Gamepad2,
  FileText,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { useUserRole } from "@/hooks/use-user-role"
import { Button } from "@/components/ui/button"


interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles?: ('ADMIN' | 'EMPLOYEE')[]
  description?: string
}

const navigation: NavItem[] = [
  {
    title: "Panel Główny",
    href: "/dashboard",
    icon: Home,
    description: "Przegląd i statystyki",
  },
  {
    title: "Harmonogram",
    href: "/dashboard/schedule",
    icon: Calendar,
    description: "Harmonogram pracy i zmiany",
    roles: ['ADMIN', 'EMPLOYEE'],
  },
  {
    title: "Bot DC",
    href: "/dashboard/bot-dc",
    icon: Gamepad2,
    description: "Zarządzanie botem Discord",
    roles: ['ADMIN', 'EMPLOYEE'],
  },
]

const adminNavigation: NavItem[] = [
  {
    title: "Sklepy",
    href: "/dashboard/stores",
    icon: Building2,
    description: "Zarządzanie sklepami",
    roles: ['ADMIN'],
  },
  {
    title: "Pracownicy",
    href: "/dashboard/users",
    icon: Users,
    description: "Zarządzanie pracownikami",
    roles: ['ADMIN'],
  },
  {
    title: "Logi Systemowe",
    href: "/dashboard/logs",
    icon: FileText,
    description: "Logi systemowe i audyt",
    roles: ['ADMIN'],
  },
]

interface SidebarProps {
  className?: string
  onNavigate?: () => void
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const { userProfile, isAdmin } = useUserRole()

  const filteredNavigation = navigation.filter(item => {
    if (!item.roles) return true
    if (!userProfile?.role || userProfile.role === 'NONE') return false
    return item.roles.includes(userProfile.role)
  })

  const filteredAdminNavigation = adminNavigation.filter(item => {
    if (!item.roles) return true
    if (!userProfile?.role || userProfile.role === 'NONE') return false
    return item.roles.includes(userProfile.role)
  })

  return (
    <div className={cn("flex h-full w-64 flex-col border-r bg-background", className)}>
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center">
          <svg 
            className="h-3 w-6 text-white mr-4 self-start mt-1" 
            viewBox="0 0 430 223" 
            xmlns="http://www.w3.org/2000/svg"
            style={{ overflow: 'visible' }}
          >
            <path 
              d="M430.26,16.52l-186.68,203.71V19.09c0-10.54-8.54-19.09-19.09-19.09H0v223.41c0,11.14,9.03,20.17,20.17,20.17h208.22c8.39,0,15.19,6.81,15.19,15.2v162.29h180.41c14.14,0,27.65-5.88,37.29-16.24l185.94-199.83V0h-179.41c-14.28,0-27.9,6-37.55,16.52"
              fill="currentColor"
            />
          </svg>
          <span className="text-xl font-bold">VTP Panel</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        <div className="space-y-1">
          {filteredNavigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <motion.div
                key={item.href}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link href={item.href} onClick={onNavigate} className="block">
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start",
                      isActive && "bg-secondary text-secondary-foreground"
                    )}
                  >
                    <item.icon className="mr-3 h-4 w-4" />
                    {item.title}
                  </Button>
                </Link>
              </motion.div>
            )
          })}
        </div>

        {/* Admin Section */}
        {isAdmin && filteredAdminNavigation.length > 0 && (
          <>
            <div className="my-4 border-t" />
            <div className="space-y-1">
              <div className="px-3 py-2">
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Administrator
                  </span>
                </div>
              </div>
              {filteredAdminNavigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <motion.div
                    key={item.href}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Link href={item.href} onClick={onNavigate} className="block">
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-start",
                          isActive && "bg-secondary text-secondary-foreground"
                        )}
                      >
                        <item.icon className="mr-3 h-4 w-4" />
                        {item.title}
                      </Button>
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          </>
        )}
      </nav>

    </div>
  )
}
