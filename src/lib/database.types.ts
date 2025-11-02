export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          settings: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          settings?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          settings?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      roles: {
        Row: {
          id: string
          company_id: string
          name: string
          permissions: Json
          is_system: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          permissions?: Json
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          permissions?: Json
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_company_roles: {
        Row: {
          id: string
          user_id: string
          company_id: string
          role_id: string | null
          permission_overrides: Json
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id: string
          role_id?: string | null
          permission_overrides?: Json
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string
          role_id?: string | null
          permission_overrides?: Json
          is_active?: boolean
          created_at?: string
        }
      }
      teams: {
        Row: {
          id: string
          company_id: string
          name: string
          description: string | null
          manager_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          description?: string | null
          manager_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          description?: string | null
          manager_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      team_members: {
        Row: {
          id: string
          team_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          id?: string
          team_id: string
          user_id: string
          joined_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          user_id?: string
          joined_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          company_id: string
          name: string
          email: string | null
          phone: string | null
          company_name: string | null
          address: Json
          tags: string[]
          notes: string | null
          is_archived: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          email?: string | null
          phone?: string | null
          company_name?: string | null
          address?: Json
          tags?: string[]
          notes?: string | null
          is_archived?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          company_name?: string | null
          address?: Json
          tags?: string[]
          notes?: string | null
          is_archived?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      leads: {
        Row: {
          id: string
          company_id: string
          customer_id: string | null
          name: string | null
          email: string | null
          phone: string | null
          company_name: string | null
          stage: 'new' | 'qualified' | 'proposal' | 'won' | 'lost'
          stage_id: string | null
          value: number | null
          event_name: string | null
          event_date: string | null
          event_type: string | null
          event_value: number | null
          expected_pax: number | null
          source: string | null
          assigned_to: string | null
          notes: string | null
          converted_to_customer_id: string | null
          is_archived: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          customer_id?: string | null
          name?: string | null
          email?: string | null
          phone?: string | null
          company_name?: string | null
          stage?: 'new' | 'qualified' | 'proposal' | 'won' | 'lost'
          stage_id?: string | null
          value?: number | null
          event_name?: string | null
          event_date?: string | null
          event_type?: string | null
          event_value?: number | null
          expected_pax?: number | null
          source?: string | null
          assigned_to?: string | null
          notes?: string | null
          converted_to_customer_id?: string | null
          is_archived?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          customer_id?: string | null
          name?: string | null
          email?: string | null
          phone?: string | null
          company_name?: string | null
          stage?: 'new' | 'qualified' | 'proposal' | 'won' | 'lost'
          stage_id?: string | null
          value?: number | null
          event_name?: string | null
          event_date?: string | null
          event_type?: string | null
          event_value?: number | null
          expected_pax?: number | null
          source?: string | null
          assigned_to?: string | null
          notes?: string | null
          converted_to_customer_id?: string | null
          is_archived?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      pipeline_stages: {
        Row: {
          id: string
          company_id: string
          name: string
          color: string
          order: number
          probability: number | null
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          color?: string
          order?: number
          probability?: number | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          color?: string
          order?: number
          probability?: number | null
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      activities: {
        Row: {
          id: string
          company_id: string
          type: 'call' | 'email' | 'meeting' | 'note' | 'task'
          title: string
          description: string | null
          related_to_type: 'customer' | 'lead' | null
          related_to_id: string | null
          due_date: string | null
          completed: boolean
          assigned_to: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          type: 'call' | 'email' | 'meeting' | 'note' | 'task'
          title: string
          description?: string | null
          related_to_type?: 'customer' | 'lead' | null
          related_to_id?: string | null
          due_date?: string | null
          completed?: boolean
          assigned_to?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          type?: 'call' | 'email' | 'meeting' | 'note' | 'task'
          title?: string
          description?: string | null
          related_to_type?: 'customer' | 'lead' | null
          related_to_id?: string | null
          due_date?: string | null
          completed?: boolean
          assigned_to?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          company_id: string
          name: string
          description: string | null
          sku: string | null
          price: number
          currency: string
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          description?: string | null
          sku?: string | null
          price: number
          currency?: string
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          description?: string | null
          sku?: string | null
          price?: number
          currency?: string
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          company_id: string
          user_id: string
          entity_type: string
          entity_id: string
          action: string
          old_value: Json | null
          new_value: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          entity_type: string
          entity_id: string
          action: string
          old_value?: Json | null
          new_value?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          entity_type?: string
          entity_id?: string
          action?: string
          old_value?: Json | null
          new_value?: Json | null
          created_at?: string
        }
      }
      event_types: {
        Row: {
          id: string
          company_id: string
          name: string
          is_active: boolean
          order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          is_active?: boolean
          order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          is_active?: boolean
          order?: number
          created_at?: string
          updated_at?: string
        }
      }
      quotations: {
        Row: {
          id: string
          company_id: string
          lead_id: string
          customer_id: string
          quotation_no: string
          salesperson_id: string | null
          quotation_date: string
          expiration_date: string | null
          status: string
          subtotal: number
          vat_enabled: boolean
          vat_rate: number
          vat_amount: number
          total_amount: number
          signed_by: string | null
          signed_at: string | null
          signature_image: string | null
          signer_ip: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          lead_id: string
          customer_id: string
          quotation_no?: string
          salesperson_id?: string | null
          quotation_date?: string
          expiration_date?: string | null
          status?: string
          subtotal?: number
          vat_enabled?: boolean
          vat_rate?: number
          vat_amount?: number
          total_amount?: number
          signed_by?: string | null
          signed_at?: string | null
          signature_image?: string | null
          signer_ip?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          lead_id?: string
          customer_id?: string
          quotation_no?: string
          salesperson_id?: string | null
          quotation_date?: string
          expiration_date?: string | null
          status?: string
          subtotal?: number
          vat_enabled?: boolean
          vat_rate?: number
          vat_amount?: number
          total_amount?: number
          signed_by?: string | null
          signed_at?: string | null
          signature_image?: string | null
          signer_ip?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      quotation_lines: {
        Row: {
          id: string
          quotation_id: string
          product_id: string | null
          description: string
          quantity: number
          unit_price: number
          discount: number
          subtotal: number
          order: number
          created_at: string
        }
        Insert: {
          id?: string
          quotation_id: string
          product_id?: string | null
          description: string
          quantity?: number
          unit_price?: number
          discount?: number
          subtotal?: number
          order?: number
          created_at?: string
        }
        Update: {
          id?: string
          quotation_id?: string
          product_id?: string | null
          description?: string
          quantity?: number
          unit_price?: number
          discount?: number
          subtotal?: number
          order?: number
          created_at?: string
        }
      }
      quotation_templates: {
        Row: {
          id: string
          company_id: string
          name: string
          description: string | null
          logo_url: string | null
          template_data: Json
          is_active: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          name: string
          description?: string | null
          logo_url?: string | null
          template_data?: Json
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          name?: string
          description?: string | null
          logo_url?: string | null
          template_data?: Json
          is_active?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      email_configs: {
        Row: {
          id: string
          company_id: string
          provider: string
          config: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_id: string
          provider?: string
          config?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          provider?: string
          config?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      email_messages: {
        Row: {
          id: string
          company_id: string
          customer_id: string | null
          lead_id: string | null
          quotation_id: string | null
          sender_id: string | null
          recipient_email: string
          subject: string
          body: string | null
          status: string
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          customer_id?: string | null
          lead_id?: string | null
          quotation_id?: string | null
          sender_id?: string | null
          recipient_email: string
          subject: string
          body?: string | null
          status?: string
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          customer_id?: string | null
          lead_id?: string | null
          quotation_id?: string | null
          sender_id?: string | null
          recipient_email?: string
          subject?: string
          body?: string | null
          status?: string
          sent_at?: string | null
          created_at?: string
        }
      }
    }
  }
}

export type Company = Database['public']['Tables']['companies']['Row']
export type Role = Database['public']['Tables']['roles']['Row']
export type UserCompanyRole = Database['public']['Tables']['user_company_roles']['Row']
export type Team = Database['public']['Tables']['teams']['Row']
export type Customer = Database['public']['Tables']['customers']['Row']
export type Lead = Database['public']['Tables']['leads']['Row']
export type PipelineStage = Database['public']['Tables']['pipeline_stages']['Row']
export type EventType = Database['public']['Tables']['event_types']['Row']
export type Activity = Database['public']['Tables']['activities']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type Quotation = Database['public']['Tables']['quotations']['Row']
export type QuotationLine = Database['public']['Tables']['quotation_lines']['Row']
export type QuotationTemplate = Database['public']['Tables']['quotation_templates']['Row']
export type EmailConfig = Database['public']['Tables']['email_configs']['Row']
export type EmailMessage = Database['public']['Tables']['email_messages']['Row']

export interface Permissions {
  customers: ModulePermissions
  leads: ModulePermissions
  quotations: ModulePermissions
  activities: ModulePermissions
  products: ModulePermissions
  settings: ModulePermissions
}

export interface ModulePermissions {
  create: boolean
  read: boolean
  update: boolean
  delete: boolean
}
