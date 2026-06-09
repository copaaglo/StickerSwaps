export interface Profile {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  location_lat: number | null
  location_lng: number | null
  location_city: string | null
  bio: string | null
  created_at: string
}

export interface Sticker {
  id: number
  sticker_code: string
  name: string
  team: string
  team_code: string
  position: number
  type: string
  is_foil: boolean
  group_letter: string
}

export interface UserSticker {
  id: string
  user_id: string
  sticker_id: number
  quantity_have: number
  quantity_duplicate: number
  wants: boolean
  sticker?: Sticker
}

export interface Post {
  id: string
  user_id: string
  tags: string[]
  content: string
  created_at: string
  profile?: Profile
}

export interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  trade_id: string | null
  read: boolean
  created_at: string
  sender?: Profile
  receiver?: Profile
}

export interface Conversation {
  other_user: Profile
  last_message: Message
  unread_count: number
}

