// User types
export interface User {
  id: string
  clerkId: string
  firstName?: string
  lastName?: string
  role: 'admin' | 'employee'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface UserProfile {
  clerkId: string
  firstName?: string
  lastName?: string
  role: 'ADMIN' | 'EMPLOYEE' | 'NONE'
  isAuthenticated: boolean
  imageUrl?: string // Avatar URL from Clerk
}

// Server types
export interface DiscordServer {
  id: string
  name: string
  icon?: string
  memberCount: number
  ownerId: string
  joinedAt: string
  features: string[]
  permissions: string[]
}

export interface ServerDetails extends DiscordServer {
  description?: string
  banner?: string
  channels: Channel[]
  roles: Role[]
  verificationLevel: number
  explicitContentFilter: number
  defaultMessageNotifications: number
  mfaLevel: number
  premiumTier: number
  premiumSubscriptionCount: number
}

export interface Channel {
  id: string
  name: string
  type: number
  position: number
  parentId?: string
  topic?: string
  nsfw: boolean
  bitrate?: number
  userLimit?: number
  permissionOverwrites: PermissionOverwrite[]
}

export interface Role {
  id: string
  name: string
  color: number
  position: number
  permissions: string[]
  mentionable: boolean
  hoist: boolean
}

export interface PermissionOverwrite {
  id: string
  type: number
  allow: string[]
  deny: string[]
}

export interface ServerMember {
  id: string
  username: string
  displayName: string
  avatar?: string
  joinedAt: string
  roles: Role[]
  permissions: string[]
  isBot: boolean
}

export interface BotPermissions {
  has: string[]
  missing: string[]
  canManageServer: boolean
  canManageChannels: boolean
  canManageRoles: boolean
  canManageMessages: boolean
  canSendMessages: boolean
  canEmbedLinks: boolean
  canAttachFiles: boolean
  canUseSlashCommands: boolean
}

// Discord Bot types
export interface DiscordBotStatus {
  type: 'PLAYING' | 'WATCHING' | 'LISTENING' | 'STREAMING' | 'COMPETING'
  name: string
  url?: string
}

export interface DiscordBotInfo {
  id: string
  username: string
  avatar?: string
  status: 'online' | 'idle' | 'dnd' | 'offline'
  activity: DiscordBotStatus | null
  guilds: number
  users: number
  uptime: string
  version: string
}

export interface UpdateBotStatusRequest {
  type: 'PLAYING' | 'WATCHING' | 'LISTENING' | 'STREAMING' | 'COMPETING'
  name: string
  url?: string
}

export interface DickRankingEntry {
  rank: number
  userId: string
  username: string
  displayName: string
  avatar?: string
  averageSize: number
  totalMeasurements: number
  measurements: number[]
}

export interface DickRankingResponse {
  rankings: DickRankingEntry[]
  period: string
  totalUsers: number
  totalMeasurements: number
  message?: string
}

export interface BotLogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  service?: string
  stack?: string
}

export interface BotLogsResponse {
  logs: BotLogEntry[]
  total: number
  level: string
  limit: number
}

// Task types
export interface Task {
  id: number
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high'
  assignedTo?: string
  completed: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTaskRequest {
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high'
  assignedTo?: string
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  assignedTo?: string
  completed?: boolean
}

// Schedule types
export interface Schedule {
  id: number
  month: number
  year: number
  shifts: Record<string, any>
  isReady: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}

// Employee types
export interface Employee {
  id: string
  name: string
  discordId?: string
  createdAt: string
  updatedAt: string
}

// API Response types
export interface ApiResponse<T = any> {
  data?: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}

// Error types
export interface ApiError {
  error: string
  message: string
  statusCode?: number
}

// Navigation types
export interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles?: ('ADMIN' | 'EMPLOYEE')[]
  description?: string
}

// Form types
export interface FormState {
  isLoading: boolean
  error?: string
  success?: string
}
