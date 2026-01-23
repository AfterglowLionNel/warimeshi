export interface User {
  id: string
  firebase_uid: string
  email: string | null
  nickname: string | null
  is_admin: boolean
  created_at: string
  updated_at: string
}

export interface Table {
  id: string
  owner_user_id: string | null
  name: string
  event_date: string
  invite_token: string
  is_archived: boolean
  archived_at: string | null
  is_locked: boolean
  auto_lock_at: string | null
  created_at: string
  updated_at: string
}

export interface TableMember {
  id: string
  table_id: string
  user_id: string | null
  display_name: string
  is_master: boolean
  is_guest: boolean
  added_by_user_id: string | null
  joined_at: string
  user?: User
}

export interface Order {
  id: string
  table_id: string
  created_by_user_id: string | null
  member_id: string
  item_name: string | null
  unit_price: number
  quantity: number
  line_total: number
  deleted_at: string | null
  created_at: string
  updated_at: string
  member?: TableMember
}

export interface TableWithMembers extends Table {
  members: TableMember[]
  member_count?: number
}
