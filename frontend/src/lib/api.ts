const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (process.env.NODE_ENV === 'production' ? 'https://panelvtp.xyz' : 'http://localhost:8080')

class ApiClient {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private getAuthHeaders(token?: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    }
  }

  private async request<T>(
    endpoint: string,
    token?: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const headers = this.getAuthHeaders(token)

    const config: RequestInit = {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    }

    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }

  // Health endpoint
  async getHealth() {
    return this.request('/api/health')
  }

  // Auth endpoints
  async getCurrentUser(token?: string) {
    return this.request('/api/auth/me', token)
  }

  async syncUser(token?: string) {
    return this.request('/api/auth/sync', token, { method: 'POST' })
  }

  async getAllUsers(token?: string) {
    return this.request('/api/auth/users', token)
  }

  async createUser(userData: {
    firstName: string
    lastName: string
    role: 'ADMIN' | 'EMPLOYEE' | 'NONE'
    discordId?: string
  }, token?: string) {
    return this.request('/api/auth/users/create', token, {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  }

  async updateUserRole(clerkId: string, role: 'ADMIN' | 'EMPLOYEE' | 'NONE', token?: string) {
    return this.request(`/api/auth/users/${clerkId}/role`, token, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    })
  }

  async updateUserDiscord(clerkId: string, discordId: string, token?: string) {
    return this.request(`/api/auth/users/${clerkId}/discord`, token, {
      method: 'PUT',
      body: JSON.stringify({ discordId }),
    })
  }

  async deactivateUser(clerkId: string, token?: string) {
    return this.request(`/api/auth/users/${clerkId}/deactivate`, token, {
      method: 'PUT',
    })
  }

  async activateUser(clerkId: string, token?: string) {
    return this.request(`/api/auth/users/${clerkId}/activate`, token, {
      method: 'PUT',
    })
  }

  async updateUser(clerkId: string, userData: {
    role?: 'ADMIN' | 'EMPLOYEE' | 'NONE'
    discordId?: string
    isActive?: boolean
    clerkId?: string
    firstName?: string
    lastName?: string
  }, token?: string) {
    return this.request(`/api/auth/users/${clerkId}`, token, {
      method: 'PUT',
      body: JSON.stringify(userData),
    })
  }

  async deleteUser(clerkId: string, token?: string) {
    return this.request(`/api/auth/users/${clerkId}`, token, {
      method: 'DELETE',
    })
  }

  // Server endpoints
  async getServer(token?: string) {
    return this.request('/api/server', token)
  }

  async getServerDetails(token?: string) {
    return this.request('/api/server/details', token)
  }

  async getServerMembers(limit = 50, offset = 0, token?: string) {
    return this.request(`/api/server/members?limit=${limit}&offset=${offset}`, token)
  }

  async getServerChannels(token?: string) {
    return this.request('/api/server/channels', token)
  }

  async getBotPermissions(token?: string) {
    return this.request('/api/server/permissions', token)
  }

  // Bot endpoints
  async getBotInfo(token?: string) {
    return this.request('/api/bot/info', token)
  }

  async updateBotStatus(status: {
    type: 'PLAYING' | 'WATCHING' | 'LISTENING' | 'STREAMING' | 'COMPETING'
    name: string
    url?: string
  }, token?: string) {
    return this.request('/api/bot/status', token, {
      method: 'PUT',
      body: JSON.stringify(status),
    })
  }

  async clearBotStatus(token?: string) {
    return this.request('/api/bot/status', token, {
      method: 'DELETE',
    })
  }

  async getBotLogs(limit: number = 100, level: string = 'all', token?: string) {
    return this.request(`/api/bot/logs?limit=${limit}&level=${level}`, token)
  }

  async getDickRanking(period: 'all' | 'week' | 'month' = 'all', token?: string) {
    return this.request(`/api/bot/ranking?period=${period}`, token)
  }

  async sendDiscordMessage(messageData: {
    channelId: string
    message?: string
    embed?: {
      title?: string
      description?: string
      color?: string
      fields?: Array<{ name: string; value: string; inline?: boolean }>
      footer?: string
      timestamp?: boolean
    }
  }, token?: string) {
    return this.request('/api/bot/send-message', token, {
      method: 'POST',
      body: JSON.stringify(messageData),
    })
  }

  async sendDiscordDM(messageData: {
    userIds: string[]
    message?: string
    embed?: {
      title?: string
      description?: string
      color?: string
      fields?: Array<{ name: string; value: string; inline?: boolean }>
      footer?: string
      timestamp?: boolean
    }
  }, token?: string) {
    return this.request('/api/bot/send-dm', token, {
      method: 'POST',
      body: JSON.stringify(messageData),
    })
  }

  // Task endpoints
  async getTasks(token?: string) {
    return this.request('/api/tasks', token)
  }

  async createTask(task: any, token?: string) {
    return this.request('/api/tasks', token, {
      method: 'POST',
      body: JSON.stringify(task),
    })
  }

  async updateTask(id: number, task: any, token?: string) {
    return this.request(`/api/tasks/${id}`, token, {
      method: 'PUT',
      body: JSON.stringify(task),
    })
  }

  async deleteTask(id: number, token?: string) {
    return this.request(`/api/tasks/${id}`, token, {
      method: 'DELETE',
    })
  }

  // Schedule endpoints
  async getSchedules(token?: string) {
    return this.request('/api/schedules', token)
  }

  async createSchedule(schedule: any, token?: string) {
    return this.request('/api/schedules', token, {
      method: 'POST',
      body: JSON.stringify(schedule),
    })
  }

  async updateSchedule(id: number, schedule: any, token?: string) {
    return this.request(`/api/schedules/${id}`, token, {
      method: 'PUT',
      body: JSON.stringify(schedule),
    })
  }

  async deleteSchedule(id: number, token?: string) {
    return this.request(`/api/schedules/${id}`, token, {
      method: 'DELETE',
    })
  }

  async exportSchedule(id: number, token?: string) {
    return this.request(`/api/schedules/${id}/export`, token)
  }

  // Employee endpoints
  async getEmployees(token?: string) {
    return this.request('/api/employees', token)
  }

  async createEmployee(employee: any, token?: string) {
    return this.request('/api/employees', token, {
      method: 'POST',
      body: JSON.stringify(employee),
    })
  }

  async updateEmployee(id: string, employee: any, token?: string) {
    return this.request(`/api/employees/${id}`, token, {
      method: 'PUT',
      body: JSON.stringify(employee),
    })
  }

  async deleteEmployee(id: string, token?: string) {
    return this.request(`/api/employees/${id}`, token, {
      method: 'DELETE',
    })
  }

  // Store endpoints
  async getStores(activeOnly = false, token?: string) {
    const endpoint = activeOnly ? '/api/stores?activeOnly=true' : '/api/stores'
    return this.request(endpoint, token)
  }

  async createStore(store: any, token?: string) {
    return this.request('/api/stores', token, {
      method: 'POST',
      body: JSON.stringify(store),
    })
  }

  async updateStore(id: string, store: any, token?: string) {
    return this.request(`/api/stores/${id}`, token, {
      method: 'PUT',
      body: JSON.stringify(store),
    })
  }

  async deleteStore(id: string, token?: string) {
    return this.request(`/api/stores/${id}`, token, {
      method: 'DELETE',
    })
  }

  // Notification endpoints
  async getNotifications(options: {
    limit?: number
    offset?: number
    unreadOnly?: boolean
    type?: string
  } = {}, token?: string) {
    const params = new URLSearchParams()
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.offset) params.append('offset', options.offset.toString())
    if (options.unreadOnly) params.append('unreadOnly', 'true')
    if (options.type) params.append('type', options.type)
    
    const queryString = params.toString()
    const endpoint = queryString ? `/api/notifications?${queryString}` : '/api/notifications'
    return this.request(endpoint, token)
  }

  async getNotificationCount(token?: string) {
    return this.request('/api/notifications/count', token)
  }

  async markNotificationAsRead(notificationId: string, token?: string) {
    return this.request(`/api/notifications/${notificationId}/read`, token, {
      method: 'PUT',
    })
  }

  async markAllNotificationsAsRead(token?: string) {
    return this.request('/api/notifications/read-all', token, {
      method: 'PUT',
    })
  }

  async deleteNotification(notificationId: string, token?: string) {
    return this.request(`/api/notifications/${notificationId}`, token, {
      method: 'DELETE',
    })
  }

  async createNotification(notificationData: {
    userId: string
    title: string
    message?: string
    type?: string
    actionUrl?: string
  }, token?: string) {
    return this.request('/api/notifications', token, {
      method: 'POST',
      body: JSON.stringify(notificationData),
    })
  }

  async createBulkNotifications(notificationData: {
    userIds: string[]
    title: string
    message?: string
    type?: string
    actionUrl?: string
  }, token?: string) {
    return this.request('/api/notifications/bulk', token, {
      method: 'POST',
      body: JSON.stringify(notificationData),
    })
  }

  async createTestNotifications(token?: string) {
    return this.request('/api/notifications/test', token, {
      method: 'POST',
    })
  }
}

// Create a singleton instance
export const apiClient = new ApiClient(API_BASE_URL)

// Hook for using the API client
export function useApi() {
  return apiClient
}
