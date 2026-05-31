export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          complement: string | null
          created_at: string | null
          id: string
          label: string | null
          latitude: number | null
          longitude: number | null
          neighborhood: string
          number: string
          reference: string | null
          street: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          city: string
          complement?: string | null
          created_at?: string | null
          id?: string
          label?: string | null
          latitude?: number | null
          longitude?: number | null
          neighborhood: string
          number: string
          reference?: string | null
          street: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          city?: string
          complement?: string | null
          created_at?: string | null
          id?: string
          label?: string | null
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string
          number?: string
          reference?: string | null
          street?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          context: Json | null
          created_at: string | null
          error_code: string | null
          error_message: string | null
          event: string
          http_status: number | null
          id: string
          payload: Json | null
          request_id: string
          source: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          event: string
          http_status?: number | null
          id?: string
          payload?: Json | null
          request_id: string
          source?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          event?: string
          http_status?: number | null
          id?: string
          payload?: Json | null
          request_id?: string
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      chat_message_logs: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          sender_id: string | null
          session_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          sender_id?: string | null
          session_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          sender_id?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string | null
          delivery_id: string
          id: string
          message: string
          read: boolean | null
          sender_id: string
          sender_role: string
        }
        Insert: {
          created_at?: string | null
          delivery_id: string
          id?: string
          message: string
          read?: boolean | null
          sender_id: string
          sender_role: string
        }
        Update: {
          created_at?: string | null
          delivery_id?: string
          id?: string
          message?: string
          read?: boolean | null
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "available_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          company_id: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          status: string | null
          topic: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          status?: string | null
          topic: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          status?: string | null
          topic?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "store_public_info"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          active: boolean | null
          address: string | null
          banner_url: string | null
          business_hours: string | null
          category: string | null
          city: string | null
          city_id: string | null
          commission_percentage: number
          cover_url: string | null
          created_at: string | null
          created_by_admin_id: string | null
          delivery_fee: number | null
          delivery_mode: string | null
          description: string | null
          document: string | null
          email: string | null
          gallery: Json | null
          id: string
          is_active: boolean | null
          is_open: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          opening_hours: Json | null
          phone: string | null
          rating: number | null
          region_id: string | null
          show_in_marketplace: boolean
          state: string | null
          updated_at: string | null
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          banner_url?: string | null
          business_hours?: string | null
          category?: string | null
          city?: string | null
          city_id?: string | null
          commission_percentage?: number
          cover_url?: string | null
          created_at?: string | null
          created_by_admin_id?: string | null
          delivery_fee?: number | null
          delivery_mode?: string | null
          description?: string | null
          document?: string | null
          email?: string | null
          gallery?: Json | null
          id?: string
          is_active?: boolean | null
          is_open?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          opening_hours?: Json | null
          phone?: string | null
          rating?: number | null
          region_id?: string | null
          show_in_marketplace?: boolean
          state?: string | null
          updated_at?: string | null
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          banner_url?: string | null
          business_hours?: string | null
          category?: string | null
          city?: string | null
          city_id?: string | null
          commission_percentage?: number
          cover_url?: string | null
          created_at?: string | null
          created_by_admin_id?: string | null
          delivery_fee?: number | null
          delivery_mode?: string | null
          description?: string | null
          document?: string | null
          email?: string | null
          gallery?: Json | null
          id?: string
          is_active?: boolean | null
          is_open?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          opening_hours?: Json | null
          phone?: string | null
          rating?: number | null
          region_id?: string | null
          show_in_marketplace?: boolean
          state?: string | null
          updated_at?: string | null
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          order_id: string | null
          participants: string[]
          title: string | null
          topic: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          participants: string[]
          title?: string | null
          topic?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          participants?: string[]
          title?: string | null
          topic?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean | null
          code: string
          company_id: string | null
          created_at: string | null
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          max_discount_value: number | null
          min_order_value: number | null
          usage_limit: number | null
          used_count: number | null
        }
        Insert: {
          active?: boolean | null
          code: string
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          max_discount_value?: number | null
          min_order_value?: number | null
          usage_limit?: number | null
          used_count?: number | null
        }
        Update: {
          active?: boolean | null
          code?: string
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_discount_value?: number | null
          min_order_value?: number | null
          usage_limit?: number | null
          used_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "store_public_info"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          cpf: string | null
          created_at: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          accepted_at: string | null
          address: string | null
          assignment_type: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          city_id: string | null
          collected_at: string | null
          commission: number
          company_id: string | null
          created_at: string | null
          customer_cpf: string | null
          customer_name: string | null
          customer_phone: string | null
          delivered_at: string | null
          delivery_address: string | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          difficulty: string | null
          distance_km: number | null
          driver_id: string | null
          dropoff_address: string | null
          dropoff_latitude: number | null
          dropoff_longitude: number | null
          estimated_time_minutes: number | null
          estimated_value: number | null
          id: string
          motoboy_id: string | null
          notes: string | null
          order_id: string | null
          picked_up_at: string | null
          pickup_address: string | null
          pickup_latitude: number | null
          pickup_longitude: number | null
          price: number | null
          proof_photo_url: string | null
          region_id: string | null
          signature_url: string | null
          status: Database["public"]["Enums"]["delivery_status"] | null
          updated_at: string | null
          value: number
        }
        Insert: {
          accepted_at?: string | null
          address?: string | null
          assignment_type?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          city_id?: string | null
          collected_at?: string | null
          commission?: number
          company_id?: string | null
          created_at?: string | null
          customer_cpf?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          difficulty?: string | null
          distance_km?: number | null
          driver_id?: string | null
          dropoff_address?: string | null
          dropoff_latitude?: number | null
          dropoff_longitude?: number | null
          estimated_time_minutes?: number | null
          estimated_value?: number | null
          id?: string
          motoboy_id?: string | null
          notes?: string | null
          order_id?: string | null
          picked_up_at?: string | null
          pickup_address?: string | null
          pickup_latitude?: number | null
          pickup_longitude?: number | null
          price?: number | null
          proof_photo_url?: string | null
          region_id?: string | null
          signature_url?: string | null
          status?: Database["public"]["Enums"]["delivery_status"] | null
          updated_at?: string | null
          value?: number
        }
        Update: {
          accepted_at?: string | null
          address?: string | null
          assignment_type?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          city_id?: string | null
          collected_at?: string | null
          commission?: number
          company_id?: string | null
          created_at?: string | null
          customer_cpf?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          difficulty?: string | null
          distance_km?: number | null
          driver_id?: string | null
          dropoff_address?: string | null
          dropoff_latitude?: number | null
          dropoff_longitude?: number | null
          estimated_time_minutes?: number | null
          estimated_value?: number | null
          id?: string
          motoboy_id?: string | null
          notes?: string | null
          order_id?: string | null
          picked_up_at?: string | null
          pickup_address?: string | null
          pickup_latitude?: number | null
          pickup_longitude?: number | null
          price?: number | null
          proof_photo_url?: string | null
          region_id?: string | null
          signature_url?: string | null
          status?: Database["public"]["Enums"]["delivery_status"] | null
          updated_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "store_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_motoboy_id_fkey"
            columns: ["motoboy_id"]
            isOneToOne: false
            referencedRelation: "motoboys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_drivers: {
        Row: {
          avatar_url: string | null
          city_id: string | null
          commission_rate: number
          company_id: string | null
          created_at: string | null
          created_by_admin_id: string | null
          current_latitude: number | null
          current_longitude: number | null
          document: string | null
          full_name: string
          id: string
          is_online: boolean | null
          last_location_update: string | null
          latitude: number | null
          license_plate: string | null
          location_updated_at: string | null
          longitude: number | null
          online: boolean | null
          phone: string | null
          rating: number | null
          status: Database["public"]["Enums"]["driver_status"] | null
          terms_accepted_at: string | null
          total_deliveries: number | null
          updated_at: string | null
          user_id: string
          vehicle: string | null
          vehicle_plate: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Insert: {
          avatar_url?: string | null
          city_id?: string | null
          commission_rate?: number
          company_id?: string | null
          created_at?: string | null
          created_by_admin_id?: string | null
          current_latitude?: number | null
          current_longitude?: number | null
          document?: string | null
          full_name: string
          id?: string
          is_online?: boolean | null
          last_location_update?: string | null
          latitude?: number | null
          license_plate?: string | null
          location_updated_at?: string | null
          longitude?: number | null
          online?: boolean | null
          phone?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["driver_status"] | null
          terms_accepted_at?: string | null
          total_deliveries?: number | null
          updated_at?: string | null
          user_id: string
          vehicle?: string | null
          vehicle_plate?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Update: {
          avatar_url?: string | null
          city_id?: string | null
          commission_rate?: number
          company_id?: string | null
          created_at?: string | null
          created_by_admin_id?: string | null
          current_latitude?: number | null
          current_longitude?: number | null
          document?: string | null
          full_name?: string
          id?: string
          is_online?: boolean | null
          last_location_update?: string | null
          latitude?: number | null
          license_plate?: string | null
          location_updated_at?: string | null
          longitude?: number | null
          online?: boolean | null
          phone?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["driver_status"] | null
          terms_accepted_at?: string | null
          total_deliveries?: number | null
          updated_at?: string | null
          user_id?: string
          vehicle?: string | null
          vehicle_plate?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "store_public_info"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_occurrences: {
        Row: {
          created_at: string | null
          delivery_id: string
          description: string
          driver_id: string
          id: string
          photo_url: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          type: Database["public"]["Enums"]["occurrence_type"] | null
        }
        Insert: {
          created_at?: string | null
          delivery_id: string
          description: string
          driver_id: string
          id?: string
          photo_url?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          type?: Database["public"]["Enums"]["occurrence_type"] | null
        }
        Update: {
          created_at?: string | null
          delivery_id?: string
          description?: string
          driver_id?: string
          id?: string
          photo_url?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          type?: Database["public"]["Enums"]["occurrence_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_occurrences_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "available_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_occurrences_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_occurrences_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          delivery_id: string
          driver_id: string
          id: string
          rating: number
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          delivery_id: string
          driver_id: string
          id?: string
          rating: number
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          delivery_id?: string
          driver_id?: string
          id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_ratings_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: true
            referencedRelation: "available_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_ratings_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: true
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_earnings: {
        Row: {
          amount: number
          created_at: string | null
          delivery_id: string | null
          description: string | null
          driver_id: string
          id: string
          paid: boolean | null
          paid_at: string | null
          type: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          delivery_id?: string | null
          description?: string | null
          driver_id: string
          id?: string
          paid?: boolean | null
          paid_at?: string | null
          type?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          delivery_id?: string | null
          description?: string | null
          driver_id?: string
          id?: string
          paid?: boolean | null
          paid_at?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_earnings_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "available_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_earnings_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_earnings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_location_history: {
        Row: {
          created_at: string | null
          delivery_id: string | null
          driver_id: string
          heading: number | null
          id: string
          latitude: number
          longitude: number
          recorded_at: string | null
          speed: number | null
        }
        Insert: {
          created_at?: string | null
          delivery_id?: string | null
          driver_id: string
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string | null
          speed?: number | null
        }
        Update: {
          created_at?: string | null
          delivery_id?: string | null
          driver_id?: string
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string | null
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_location_history_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "available_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_location_history_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_location_history_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_login_attempts: {
        Row: {
          app_name: string
          created_at: string
          email: string
          id: string
          ip_address: string | null
        }
        Insert: {
          app_name: string
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
        }
        Update: {
          app_name?: string
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          read_at: string | null
          sender_id: string | null
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      motoboys: {
        Row: {
          created_at: string | null
          id: string
          is_online: boolean | null
          name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_online?: boolean | null
          name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_online?: boolean | null
          name?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          data: Json | null
          id: string
          read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      occurrences: {
        Row: {
          created_at: string | null
          delivery_id: string | null
          description: string
          driver_id: string | null
          id: string
          status: string | null
          type: Database["public"]["Enums"]["occurrence_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_id?: string | null
          description: string
          driver_id?: string | null
          id?: string
          status?: string | null
          type?: Database["public"]["Enums"]["occurrence_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_id?: string | null
          description?: string
          driver_id?: string | null
          id?: string
          status?: string | null
          type?: Database["public"]["Enums"]["occurrence_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "occurrences_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "available_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          notes: string | null
          options: Json | null
          order_id: string
          price: number | null
          product_id: string
          product_image: string | null
          product_name: string | null
          quantity: number
          unit_price: number | null
        }
        Insert: {
          id?: string
          notes?: string | null
          options?: Json | null
          order_id: string
          price?: number | null
          product_id: string
          product_image?: string | null
          product_name?: string | null
          quantity?: number
          unit_price?: number | null
        }
        Update: {
          id?: string
          notes?: string | null
          options?: Json | null
          order_id?: string
          price?: number | null
          product_id?: string
          product_image?: string | null
          product_name?: string | null
          quantity?: number
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_id: string | null
          city_id: string | null
          company_id: string
          created_at: string | null
          customer_id: string
          delivery_address: string | null
          delivery_fee: number | null
          delivery_id: string | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          id: string
          idempotency_key: string | null
          notes: string | null
          payment_method: string | null
          region_id: string | null
          status: string
          total: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address_id?: string | null
          city_id?: string | null
          company_id: string
          created_at?: string | null
          customer_id: string
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_id?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          payment_method?: string | null
          region_id?: string | null
          status?: string
          total?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address_id?: string | null
          city_id?: string | null
          company_id?: string
          created_at?: string | null
          customer_id?: string
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_id?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          payment_method?: string | null
          region_id?: string | null
          status?: string
          total?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "store_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          status: Database["public"]["Enums"]["payment_status"]
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          status?: Database["public"]["Enums"]["payment_status"]
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          status?: Database["public"]["Enums"]["payment_status"]
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      product_option_groups: {
        Row: {
          created_at: string
          id: string
          max_options: number
          min_options: number
          name: string
          product_id: string
          required: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_options?: number
          min_options?: number
          name: string
          product_id: string
          required?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_options?: number
          min_options?: number
          name?: string
          product_id?: string
          required?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "product_option_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          category: string
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          image_urls: Json | null
          is_active: boolean | null
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          category?: string
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          image_urls?: Json | null
          is_active?: boolean | null
          name: string
          price: number
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          image_urls?: Json | null
          is_active?: boolean | null
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "store_public_info"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          document: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: string | null
          status: Database["public"]["Enums"]["user_status"] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          document?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          document?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      regions: {
        Row: {
          active: boolean
          city: string | null
          color: string | null
          created_at: string
          delivery_fee: number | null
          description: string | null
          geometry: Json | null
          id: string
          name: string
          price: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          city?: string | null
          color?: string | null
          created_at?: string
          delivery_fee?: number | null
          description?: string | null
          geometry?: Json | null
          id?: string
          name: string
          price?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string | null
          color?: string | null
          created_at?: string
          delivery_fee?: number | null
          description?: string | null
          geometry?: Json | null
          id?: string
          name?: string
          price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          company_id: string | null
          created_at: string | null
          driver_id: string | null
          id: string
          order_id: string | null
          rating: number
          type: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          company_id?: string | null
          created_at?: string | null
          driver_id?: string | null
          id?: string
          order_id?: string | null
          rating: number
          type?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          company_id?: string | null
          created_at?: string | null
          driver_id?: string | null
          id?: string
          order_id?: string | null
          rating?: number
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "store_public_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          description: string
          event_type: string
          id: string
          metadata: Json | null
          severity: string
        }
        Insert: {
          created_at?: string
          description: string
          event_type: string
          id?: string
          metadata?: Json | null
          severity: string
        }
        Update: {
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          severity?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          level: string
          message: string
          metadata: Json | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          level?: string
          message: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      user_coupons: {
        Row: {
          coupon_id: string | null
          created_at: string | null
          id: string
          order_id: string | null
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          coupon_id?: string | null
          created_at?: string | null
          id?: string
          order_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          coupon_id?: string | null
          created_at?: string | null
          id?: string
          order_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_coupons_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_coupons_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          id: string
          total_earned: number
          total_withdrawn: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number
          id?: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number
          id?: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          pix_key: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          notes?: string | null
          pix_key?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          pix_key?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      available_deliveries: {
        Row: {
          commission: number | null
          company_id: string | null
          created_at: string | null
          customer_cpf: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_address: string | null
          delivery_latitude: number | null
          delivery_longitude: number | null
          id: string | null
          notes: string | null
          status: Database["public"]["Enums"]["delivery_status"] | null
          value: number | null
        }
        Insert: {
          commission?: number | null
          company_id?: string | null
          created_at?: string | null
          customer_cpf?: never
          customer_name?: never
          customer_phone?: never
          delivery_address?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          id?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["delivery_status"] | null
          value?: number | null
        }
        Update: {
          commission?: number | null
          company_id?: string | null
          created_at?: string | null
          customer_cpf?: never
          customer_name?: never
          customer_phone?: never
          delivery_address?: string | null
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          id?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["delivery_status"] | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "store_public_info"
            referencedColumns: ["id"]
          },
        ]
      }
      store_public_info: {
        Row: {
          address: string | null
          cover_url: string | null
          created_at: string | null
          description: string | null
          id: string | null
          is_active: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string | null
        }
        Insert: {
          address?: string | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string | null
        }
        Update: {
          address?: string | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invitation_by_token: {
        Args: { p_token: string }
        Returns: boolean
      }
      assign_invitation_role: {
        Args: { _role: string; _user_id: string }
        Returns: undefined
      }
      can_view_profile: {
        Args: { _profile_user_id: string; _viewer_id: string }
        Returns: boolean
      }
      can_write_order_items: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      create_order_v3: {
        Args: {
          p_address_id: string
          p_change_for?: number
          p_company_id: string
          p_coupon_code?: string
          p_idempotency_key?: string
          p_items: Json
          p_needs_change?: boolean
          p_notes?: string
          p_payment_method: string
        }
        Returns: Json
      }
      find_region_for_point: {
        Args: { _lat: number; _lng: number }
        Returns: {
          region_color: string
          region_id: string
          region_name: string
          region_price: number
        }[]
      }
      fix_user_permissions: { Args: never; Returns: Json }
      generate_daily_report: { Args: never; Returns: string }
      get_business_orders_v2: { Args: { p_company_id: string }; Returns: Json }
      get_company_for_current_user: {
        Args: never
        Returns: {
          active: boolean | null
          address: string | null
          banner_url: string | null
          business_hours: string | null
          category: string | null
          city: string | null
          city_id: string | null
          commission_percentage: number
          cover_url: string | null
          created_at: string | null
          created_by_admin_id: string | null
          delivery_fee: number | null
          delivery_mode: string | null
          description: string | null
          document: string | null
          email: string | null
          gallery: Json | null
          id: string
          is_active: boolean | null
          is_open: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          opening_hours: Json | null
          phone: string | null
          rating: number | null
          region_id: string | null
          show_in_marketplace: boolean
          state: string | null
          updated_at: string | null
          user_id: string | null
          zip_code: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_delivery_price: {
        Args: { lat: number; lng: number }
        Returns: number
      }
      get_driver_id: { Args: { _user_id: string }; Returns: string }
      get_invitation_by_token: { Args: { _token: string }; Returns: Json }
      get_user_id_by_email: { Args: { p_email: string }; Returns: string }
      has_profile_role: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_owner: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_delivery_visible_to_user: {
        Args: { _delivery_id: string; _user_id: string }
        Returns: boolean
      }
      is_driver: { Args: { _user_id: string }; Returns: string }
      is_order_visible_to_user: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      log_failed_login: {
        Args: { p_app_name: string; p_email: string }
        Returns: boolean
      }
      process_delivery_payment: {
        Args: { p_delivery_id: string }
        Returns: undefined
      }
      process_payment_split: {
        Args: { p_payment_id: string }
        Returns: undefined
      }
      request_wallet_withdrawal: { Args: { _amount: number }; Returns: Json }
      safe_delete_customer: { Args: { p_user_id: string }; Returns: undefined }
      safe_delete_driver: { Args: { p_driver_id: string }; Returns: undefined }
      update_delivery_status_safe: {
        Args: { p_delivery_id: string; p_driver_id?: string; p_status: string }
        Returns: Json
      }
      update_order_status_v4: {
        Args: {
          p_new_status: Database["public"]["Enums"]["order_status"]
          p_order_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "driver"
        | "company"
        | "customer"
      assignment_type: "broadcast" | "direct"
      delivery_status:
        | "pending"
        | "broadcasted"
        | "accepted"
        | "collecting"
        | "in_transit"
        | "delivered"
        | "cancelled"
        | "returned"
        | "completed"
      driver_status: "pending" | "active" | "rejected" | "suspended"
      invitation_status: "pending" | "accepted" | "expired"
      occurrence_type:
        | "delay"
        | "damage"
        | "absence"
        | "other"
        | "motorcycle_issue"
        | "accident"
        | "robbery"
      order_status:
        | "pending"
        | "preparing"
        | "ready"
        | "delivered"
        | "cancelled"
      payment_method_type: "pix" | "card" | "cash"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      transaction_type: "earning" | "fee" | "withdrawal" | "refund"
      user_status: "pending" | "active" | "rejected"
      vehicle_type: "motorcycle" | "bicycle" | "car" | "van" | "truck"
      withdrawal_status: "pending" | "approved" | "rejected" | "completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user", "driver", "company", "customer"],
      assignment_type: ["broadcast", "direct"],
      delivery_status: [
        "pending",
        "broadcasted",
        "accepted",
        "collecting",
        "in_transit",
        "delivered",
        "cancelled",
        "returned",
        "completed",
      ],
      driver_status: ["pending", "active", "rejected", "suspended"],
      invitation_status: ["pending", "accepted", "expired"],
      occurrence_type: [
        "delay",
        "damage",
        "absence",
        "other",
        "motorcycle_issue",
        "accident",
        "robbery",
      ],
      order_status: ["pending", "preparing", "ready", "delivered", "cancelled"],
      payment_method_type: ["pix", "card", "cash"],
      payment_status: ["pending", "paid", "failed", "refunded"],
      transaction_type: ["earning", "fee", "withdrawal", "refund"],
      user_status: ["pending", "active", "rejected"],
      vehicle_type: ["motorcycle", "bicycle", "car", "van", "truck"],
      withdrawal_status: ["pending", "approved", "rejected", "completed"],
    },
  },
} as const
