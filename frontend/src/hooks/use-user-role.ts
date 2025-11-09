"use client"

import { useAuth, useUser } from '@clerk/nextjs'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { UserProfile } from '@/types'
import { apiClient } from '@/lib/api'

export function useUserRole() {
  const { isSignedIn, isLoaded, getToken } = useAuth()
  const { user } = useUser()
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUserRole = useCallback(async () => {
    if (!isLoaded) return

    if (!isSignedIn || !user) {
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Get JWT token from Clerk
      const token = await getToken()
      
      if (!token) {
        setUserProfile(null)
        return
      }
      
      try {
        // First try to get existing user profile from database
        const userData = await apiClient.getCurrentUser(token) as UserProfile
        
        // Check if user has a valid role from database (not 'NONE')
        if (userData.role && userData.role !== 'NONE') {
          // User has valid role from database, create enhanced profile with Clerk data
          const enhancedProfile: UserProfile = {
            ...userData,
            // Override with fresh data from Clerk
            firstName: user.firstName || userData.firstName,
            lastName: user.lastName || userData.lastName,
            imageUrl: user.imageUrl, // Avatar from Clerk
            isAuthenticated: true
          }
          setUserProfile(enhancedProfile)
        } else {
          // User has no valid role, don't set profile and redirect
          setUserProfile(null)
          router.push('/denied')
        }
      } catch (getUserErr) {
        // If user doesn't exist, try to sync them
        try {
          const syncData = await apiClient.syncUser(token) as { user: UserProfile }
          // Only set profile if user has valid role
          if (syncData.user.role && syncData.user.role !== 'NONE') {
            // Create enhanced profile with Clerk data
            const enhancedProfile: UserProfile = {
              ...syncData.user,
              // Override with fresh data from Clerk
              firstName: user.firstName || syncData.user.firstName,
              lastName: user.lastName || syncData.user.lastName,
              imageUrl: user.imageUrl, // Avatar from Clerk
              isAuthenticated: true
            }
            setUserProfile(enhancedProfile)
          } else {
            setUserProfile(null)
            router.push('/denied')
          }
        } catch (syncErr) {
          console.error('Failed to sync user:', syncErr)
          setError(syncErr instanceof Error ? syncErr.message : 'Failed to sync user')
          setUserProfile(null)
          router.push('/denied')
        }
      }
    } catch (err) {
      console.error('Failed to fetch user role:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch user role')
      setUserProfile(null)
      router.push('/denied')
    } finally {
      setIsLoading(false)
    }
  }, [isLoaded, isSignedIn, user, getToken, router])

  useEffect(() => {
    fetchUserRole()
  }, [fetchUserRole])

  const syncUser = async () => {
    if (!user) return

    try {
      const token = await getToken()
      if (!token) return
      
      const userData = await apiClient.syncUser(token) as { user: UserProfile }
      setUserProfile(userData.user)
    } catch (err) {
      console.error('Failed to sync user:', err)
    }
  }

  const checkAccess = (requiredRoles?: ('ADMIN' | 'EMPLOYEE')[]) => {
    if (!userProfile || userProfile.role === 'NONE') return false
    if (!requiredRoles) return true
    return requiredRoles.includes(userProfile.role as 'ADMIN' | 'EMPLOYEE')
  }

  const redirectIfNoAccess = (requiredRoles?: ('ADMIN' | 'EMPLOYEE')[]) => {
    if (!isLoading && (userProfile?.role === 'NONE' || !checkAccess(requiredRoles))) {
      router.push('/denied')
    }
  }

  return {
    userProfile: userProfile?.role === 'NONE' ? null : userProfile,
    isLoading,
    error,
    isSignedIn,
    isLoaded,
    getToken,
    syncUser,
    checkAccess,
    redirectIfNoAccess,
    isAdmin: userProfile?.role === 'ADMIN',
    isEmployee: userProfile?.role === 'EMPLOYEE',
  }
}
