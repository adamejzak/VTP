"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Menu, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NotificationBell } from "@/components/ui/notifications"

import { UserButton } from "@clerk/nextjs"
import { dark } from "@clerk/themes"

interface HeaderProps {
  onMenuClick?: () => void
  title?: string
  description?: string
}

export function Header({ onMenuClick, title, description }: HeaderProps) {

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-40 flex h-16 items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="flex w-full items-center justify-between px-4">
        {/* Left side */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div className="hidden md:block">
            {title && (
              <div>
                <h1 className="text-lg font-semibold">{title}</h1>
                {description && (
                  <p className="text-sm text-muted-foreground">{description}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-2">
          {/* Notifications */}
          <NotificationBell />

          {/* User Button */}
          <UserButton 
            appearance={{
              baseTheme: dark,
              elements: {
                avatarBox: "h-8 w-8",
                userButtonPopoverCard: "shadow-lg border",
                userButtonPopoverActionButton: "hover:bg-secondary",
                userButtonPopoverFooter: "hidden"
              }
            }}
          />
        </div>
      </div>
    </motion.header>
  )
}
