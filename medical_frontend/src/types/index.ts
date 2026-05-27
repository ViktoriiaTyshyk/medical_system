export type Role = 'PATIENT' | 'RADIOLOGIST' | 'FAMILY_DOCTOR' | 'ADMIN'

export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  phone?: string
  sex?: string
  date_of_birth?: string
  status?: 'ACTIVE' | 'INACTIVE'
  roles: Array<{ name: Role }>
}

export type CaseStatus = 'PENDING' | 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED'
export type Urgency    = 'NORMAL' | 'URGENT'

export interface AiResult {
  stage: 'healthy' | 'classified' | 'unclassifiable'
  urgency: Urgency
  binary_abnormal: boolean
  binary_prob: number
  top_class?: string
  top_label?: string
  top_prob?: number
  multiclass?: Record<string, number>
  labels?: Record<string, string>
  descriptions?: Record<string, string>
  heatmap_base64?: string
}

export interface Case {
  id: number
  title: string
  description?: string
  status: CaseStatus
  urgency: Urgency
  patient_id: number
  therapist_id?: number
  conclusion?: string
  therapist_note?: string
  ai_result?: AiResult
  created_at: string
  closed_at?: string
}

export interface CaseFile {
  file_id: number
  case_id: number
  uploaded_by: number
  file?: {
    id: number
    name: string
    mime_type: string
    size: number
    path: string
  }
}

export interface Message {
  id: number
  case_id: number
  sender_user_id: number
  text: string
  message_type: string
  created_at: string
}

export interface Radiologist {
  id: number
  first_name: string
  last_name: string
  department?: string
  years_of_experience?: number
  availability_status?: 'AVAILABLE' | 'BUSY' | 'OFF_DUTY'
  average_rating?: number
  review_count?: number
}

export interface FamilyDoctor {
  id: number
  first_name: string
  last_name: string
  email: string
  specialization?: string
}

export interface ReportTemplate {
  key: string
  name: string
  preview: string
}
