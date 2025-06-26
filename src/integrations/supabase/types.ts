export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      allowed_locations: {
        Row: {
          address: string
          created_at: string
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          name: string
          range_meters: number
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          name: string
          range_meters?: number
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          name?: string
          range_meters?: number
          updated_at?: string
        }
        Relationships: []
      }
      announcement_recipients: {
        Row: {
          announcement_id: string
          created_at: string
          employee_id: string
          id: string
          is_read: boolean
          read_at: string | null
        }
        Insert: {
          announcement_id: string
          created_at?: string
          employee_id: string
          id?: string
          is_read?: boolean
          read_at?: string | null
        }
        Update: {
          announcement_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_recipients_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_recipients_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          priority: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          priority?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          priority?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          changed_fields: string[] | null
          created_at: string
          id: string
          ip_address: unknown | null
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          operation: string
          record_id: string
          session_id: string | null
          table_name: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          record_id: string
          session_id?: string | null
          table_name: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          record_id?: string
          session_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      auto_obras_values: {
        Row: {
          auto_value: number
          created_at: string
          department_id: string
          id: string
          is_active: boolean
          job_function_id: string
          updated_at: string
        }
        Insert: {
          auto_value: number
          created_at?: string
          department_id: string
          id?: string
          is_active?: boolean
          job_function_id: string
          updated_at?: string
        }
        Update: {
          auto_value?: number
          created_at?: string
          department_id?: string
          id?: string
          is_active?: boolean
          job_function_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_obras_values_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auto_obras_values_job_function_id_fkey"
            columns: ["job_function_id"]
            isOneToOne: false
            referencedRelation: "job_functions"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_periods: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          name: string
          start_date: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          name: string
          start_date: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          start_date?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      edit_requests: {
        Row: {
          created_at: string
          date: string
          employee_id: string
          employee_name: string
          field: string
          id: string
          location: Json | null
          location_name: string | null
          new_value: string
          old_value: string | null
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          date: string
          employee_id: string
          employee_name: string
          field: string
          id?: string
          location?: Json | null
          location_name?: string | null
          new_value: string
          old_value?: string | null
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          date?: string
          employee_id?: string
          employee_name?: string
          field?: string
          id?: string
          location?: Json | null
          location_name?: string | null
          new_value?: string
          old_value?: string | null
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "edit_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edit_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_analytics: {
        Row: {
          anomaly_flags: Json | null
          average_daily_hours: number | null
          created_at: string | null
          days_worked: number | null
          employee_id: string
          id: string
          month: number
          productivity_score: number | null
          total_hours_worked: number | null
          total_overtime_hours: number | null
          updated_at: string | null
          year: number
        }
        Insert: {
          anomaly_flags?: Json | null
          average_daily_hours?: number | null
          created_at?: string | null
          days_worked?: number | null
          employee_id: string
          id?: string
          month: number
          productivity_score?: number | null
          total_hours_worked?: number | null
          total_overtime_hours?: number | null
          updated_at?: string | null
          year: number
        }
        Update: {
          anomaly_flags?: Json | null
          average_daily_hours?: number | null
          created_at?: string | null
          days_worked?: number | null
          employee_id?: string
          id?: string
          month?: number
          productivity_score?: number | null
          total_hours_worked?: number | null
          total_overtime_hours?: number | null
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          category: string | null
          description: string | null
          employee_id: string
          expires_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          is_read: boolean | null
          read_at: string | null
          title: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          description?: string | null
          employee_id: string
          expires_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          title: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          description?: string | null
          employee_id?: string
          expires_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          title?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_work_schedules: {
        Row: {
          created_at: string
          daily_hours: number
          employee_id: string
          id: string
          is_active: boolean
          shift_id: string | null
          updated_at: string
          weekly_hours: number | null
        }
        Insert: {
          created_at?: string
          daily_hours?: number
          employee_id: string
          id?: string
          is_active?: boolean
          shift_id?: string | null
          updated_at?: string
          weekly_hours?: number | null
        }
        Update: {
          created_at?: string
          daily_hours?: number
          employee_id?: string
          id?: string
          is_active?: boolean
          shift_id?: string | null
          updated_at?: string
          weekly_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_work_schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_work_schedules_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "work_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      hour_bank_balances: {
        Row: {
          created_at: string
          current_balance: number
          employee_id: string
          id: string
          last_updated: string
        }
        Insert: {
          created_at?: string
          current_balance?: number
          employee_id: string
          id?: string
          last_updated?: string
        }
        Update: {
          created_at?: string
          current_balance?: number
          employee_id?: string
          id?: string
          last_updated?: string
        }
        Relationships: [
          {
            foreignKeyName: "hour_bank_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hour_bank_transactions: {
        Row: {
          admin_user_id: string | null
          created_at: string
          description: string | null
          employee_id: string
          expiration_date: string | null
          hours_amount: number
          id: string
          new_balance: number
          previous_balance: number
          time_record_id: string | null
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          admin_user_id?: string | null
          created_at?: string
          description?: string | null
          employee_id: string
          expiration_date?: string | null
          hours_amount: number
          id?: string
          new_balance: number
          previous_balance: number
          time_record_id?: string | null
          transaction_date?: string
          transaction_type: string
        }
        Update: {
          admin_user_id?: string | null
          created_at?: string
          description?: string | null
          employee_id?: string
          expiration_date?: string | null
          hours_amount?: number
          id?: string
          new_balance?: number
          previous_balance?: number
          time_record_id?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "hour_bank_transactions_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_transactions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_transactions_time_record_id_fkey"
            columns: ["time_record_id"]
            isOneToOne: false
            referencedRelation: "time_records"
            referencedColumns: ["id"]
          },
        ]
      }
      job_functions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      mapbox_settings: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          mapbox_token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mapbox_token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          mapbox_token?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          created_at: string | null
          email_body: string | null
          email_subject: string | null
          employee_id: string
          error_message: string | null
          id: string
          metadata: Json | null
          notification_type: string
          sent_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          email_body?: string | null
          email_subject?: string | null
          employee_id: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notification_type: string
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          email_body?: string | null
          email_subject?: string | null
          employee_id?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          notification_type?: string
          sent_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          created_at: string | null
          employee_id: string
          frequency: string | null
          id: string
          is_enabled: boolean | null
          notification_type: string
          push_enabled: boolean | null
          push_incomplete_records: boolean | null
          push_reminder_entry: boolean | null
          push_reminder_exit: boolean | null
          push_reminder_lunch_end: boolean | null
          push_reminder_lunch_start: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          frequency?: string | null
          id?: string
          is_enabled?: boolean | null
          notification_type: string
          push_enabled?: boolean | null
          push_incomplete_records?: boolean | null
          push_reminder_entry?: boolean | null
          push_reminder_exit?: boolean | null
          push_reminder_lunch_end?: boolean | null
          push_reminder_lunch_start?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          frequency?: string | null
          id?: string
          is_enabled?: boolean | null
          notification_type?: string
          push_enabled?: boolean | null
          push_incomplete_records?: boolean | null
          push_reminder_entry?: boolean | null
          push_reminder_exit?: boolean | null
          push_reminder_lunch_end?: boolean | null
          push_reminder_lunch_start?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          can_access_tcobras: boolean
          can_register_time: boolean
          created_at: string
          department_id: string | null
          email: string
          employee_code: string | null
          hourly_rate: number
          id: string
          job_function_id: string | null
          name: string
          overtime_rate: number | null
          role: string
          shift_id: string | null
          status: Database["public"]["Enums"]["employee_status"] | null
          termination_date: string | null
          updated_at: string
        }
        Insert: {
          can_access_tcobras?: boolean
          can_register_time?: boolean
          created_at?: string
          department_id?: string | null
          email: string
          employee_code?: string | null
          hourly_rate?: number
          id: string
          job_function_id?: string | null
          name: string
          overtime_rate?: number | null
          role?: string
          shift_id?: string | null
          status?: Database["public"]["Enums"]["employee_status"] | null
          termination_date?: string | null
          updated_at?: string
        }
        Update: {
          can_access_tcobras?: boolean
          can_register_time?: boolean
          created_at?: string
          department_id?: string | null
          email?: string
          employee_code?: string | null
          hourly_rate?: number
          id?: string
          job_function_id?: string | null
          name?: string
          overtime_rate?: number | null
          role?: string
          shift_id?: string | null
          status?: Database["public"]["Enums"]["employee_status"] | null
          termination_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_job_function_id_fkey"
            columns: ["job_function_id"]
            isOneToOne: false
            referencedRelation: "job_functions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "work_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string | null
          device_info: Json | null
          employee_id: string
          id: string
          is_active: boolean | null
          platform: string
          token: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          employee_id: string
          id?: string
          is_active?: boolean | null
          platform: string
          token: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          employee_id?: string
          id?: string
          is_active?: boolean | null
          platform?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          employee_id: string | null
          expires_at: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          severity: string | null
          title: string
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          employee_id?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          severity?: string | null
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          employee_id?: string | null
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          severity?: string | null
          title?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      tcrh_api_keys: {
        Row: {
          api_key: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          key_name: string
          last_used_at: string | null
          permissions: Json | null
        }
        Insert: {
          api_key: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_name: string
          last_used_at?: string | null
          permissions?: Json | null
        }
        Update: {
          api_key?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_name?: string
          last_used_at?: string | null
          permissions?: Json | null
        }
        Relationships: []
      }
      time_records: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          clock_in: string | null
          clock_out: string | null
          created_at: string
          date: string
          id: string
          is_pending_approval: boolean | null
          locations: Json | null
          lunch_end: string | null
          lunch_start: string | null
          normal_hours: number
          normal_pay: number
          overtime_hours: number
          overtime_pay: number
          status: string | null
          total_hours: number
          total_pay: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date: string
          id?: string
          is_pending_approval?: boolean | null
          locations?: Json | null
          lunch_end?: string | null
          lunch_start?: string | null
          normal_hours?: number
          normal_pay?: number
          overtime_hours?: number
          overtime_pay?: number
          status?: string | null
          total_hours?: number
          total_pay?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date?: string
          id?: string
          is_pending_approval?: boolean | null
          locations?: Json | null
          lunch_end?: string | null
          lunch_start?: string | null
          normal_hours?: number
          normal_pay?: number
          overtime_hours?: number
          overtime_pay?: number
          status?: string | null
          total_hours?: number
          total_pay?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_records_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          api_key_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_permanent: boolean | null
          session_token: string
          user_id: string
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_permanent?: boolean | null
          session_token: string
          user_id: string
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_permanent?: boolean | null
          session_token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "tcrh_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_balances: {
        Row: {
          available_days: number
          employee_id: string
          id: string
          total_days: number
          updated_at: string | null
          used_days: number
          year: number
        }
        Insert: {
          available_days?: number
          employee_id: string
          id?: string
          total_days?: number
          updated_at?: string | null
          used_days?: number
          year: number
        }
        Update: {
          available_days?: number
          employee_id?: string
          id?: string
          total_days?: number
          updated_at?: string | null
          used_days?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_vb_employee"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_policies: {
        Row: {
          allow_retroactive: boolean
          created_at: string | null
          id: string
          max_days_per_year: number
          max_split: number
          min_period_days: number
          updated_at: string | null
        }
        Insert: {
          allow_retroactive?: boolean
          created_at?: string | null
          id?: string
          max_days_per_year?: number
          max_split?: number
          min_period_days?: number
          updated_at?: string | null
        }
        Update: {
          allow_retroactive?: boolean
          created_at?: string | null
          id?: string
          max_days_per_year?: number
          max_split?: number
          min_period_days?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      vacation_request_history: {
        Row: {
          action: string
          action_at: string | null
          action_by: string | null
          id: string
          justification: string | null
          vacation_request_id: string
        }
        Insert: {
          action: string
          action_at?: string | null
          action_by?: string | null
          id?: string
          justification?: string | null
          vacation_request_id: string
        }
        Update: {
          action?: string
          action_at?: string | null
          action_by?: string | null
          id?: string
          justification?: string | null
          vacation_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vacation_request_history_vacation_request_id_fkey"
            columns: ["vacation_request_id"]
            isOneToOne: false
            referencedRelation: "vacation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      vacation_requests: {
        Row: {
          adjust_reason: string | null
          approver_id: string | null
          days: number
          decided_at: string | null
          decision_justification: string | null
          department_id: string | null
          employee_id: string
          end_date: string
          id: string
          job_function_id: string | null
          previous_end_date: string | null
          previous_start_date: string | null
          requested_at: string
          start_date: string
          status: string
        }
        Insert: {
          adjust_reason?: string | null
          approver_id?: string | null
          days: number
          decided_at?: string | null
          decision_justification?: string | null
          department_id?: string | null
          employee_id: string
          end_date: string
          id?: string
          job_function_id?: string | null
          previous_end_date?: string | null
          previous_start_date?: string | null
          requested_at?: string
          start_date: string
          status?: string
        }
        Update: {
          adjust_reason?: string | null
          approver_id?: string | null
          days?: number
          decided_at?: string | null
          decision_justification?: string | null
          department_id?: string | null
          employee_id?: string
          end_date?: string
          id?: string
          job_function_id?: string | null
          previous_end_date?: string | null
          previous_start_date?: string | null
          requested_at?: string
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_department"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_employee"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_function"
            columns: ["job_function_id"]
            isOneToOne: false
            referencedRelation: "job_functions"
            referencedColumns: ["id"]
          },
        ]
      }
      work_shift_schedules: {
        Row: {
          break_end_time: string | null
          break_start_time: string | null
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          shift_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          break_end_time?: string | null
          break_start_time?: string | null
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          shift_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          break_end_time?: string | null
          break_start_time?: string | null
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          shift_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_shift_schedules_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "work_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      work_shifts: {
        Row: {
          break_tolerance_minutes: number | null
          created_at: string
          description: string | null
          early_tolerance_minutes: number | null
          id: string
          is_active: boolean
          late_tolerance_minutes: number | null
          name: string
          updated_at: string
        }
        Insert: {
          break_tolerance_minutes?: number | null
          created_at?: string
          description?: string | null
          early_tolerance_minutes?: number | null
          id?: string
          is_active?: boolean
          late_tolerance_minutes?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          break_tolerance_minutes?: number | null
          created_at?: string
          description?: string | null
          early_tolerance_minutes?: number | null
          id?: string
          is_active?: boolean
          late_tolerance_minutes?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_monthly_analytics: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      check_excessive_overtime: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      check_incomplete_records: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_sessions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      expire_old_hour_bank_hours: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_audit_logs: {
        Args: {
          p_table_name?: string
          p_record_id?: string
          p_start_date?: string
          p_end_date?: string
          p_limit?: number
        }
        Returns: {
          id: string
          table_name: string
          operation: string
          record_id: string
          old_values: Json
          new_values: Json
          changed_fields: string[]
          user_email: string
          user_role: string
          created_at: string
        }[]
      }
      get_audit_statistics: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
          total_operations: number
          inserts: number
          updates: number
          deletes: number
          last_activity: string
        }[]
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_admin_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      process_hour_bank: {
        Args: {
          p_employee_id: string
          p_time_record_id: string
          p_worked_hours: number
          p_work_date: string
        }
        Returns: undefined
      }
      send_scheduled_push_notifications: {
        Args: { notification_type: string; check_time: string }
        Returns: undefined
      }
    }
    Enums: {
      employee_status: "active" | "inactive"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      employee_status: ["active", "inactive"],
    },
  },
} as const
