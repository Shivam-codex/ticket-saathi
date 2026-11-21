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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          ip: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          ip?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          ip?: string | null
        }
        Relationships: []
      }
      consents: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          policy_version: string
          purpose: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          granted: boolean
          id?: string
          policy_version: string
          purpose: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          policy_version?: string
          purpose?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          category: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          evidence_deadline_at: string | null
          evidence_paths: string[]
          id: string
          order_id: string
          prior_order_status: string | null
          raised_by: string | null
          reason: string
          resolution_note: string | null
          response_due_at: string | null
          seller_responded_at: string | null
          seller_response: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence_deadline_at?: string | null
          evidence_paths?: string[]
          id?: string
          order_id: string
          prior_order_status?: string | null
          raised_by?: string | null
          reason: string
          resolution_note?: string | null
          response_due_at?: string | null
          seller_responded_at?: string | null
          seller_response?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence_deadline_at?: string | null
          evidence_paths?: string[]
          id?: string
          order_id?: string
          prior_order_status?: string | null
          raised_by?: string | null
          reason?: string
          resolution_note?: string | null
          response_due_at?: string | null
          seller_responded_at?: string | null
          seller_response?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_follows: {
        Row: {
          created_at: string
          event_id: string
          id: string
          max_price_paise: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          max_price_paise?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          max_price_paise?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_follows_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_follows_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          category: Database["public"]["Enums"]["event_category"]
          created_at: string
          description: string | null
          ends_at: string | null
          face_value_tiers: Json
          id: string
          image_url: string | null
          is_resellable: boolean
          min_face_value_paise: number | null
          organizer: string | null
          resale_max_percent: number | null
          starts_at: string
          title: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["event_category"]
          created_at?: string
          description?: string | null
          ends_at?: string | null
          face_value_tiers?: Json
          id?: string
          image_url?: string | null
          is_resellable?: boolean
          min_face_value_paise?: number | null
          organizer?: string | null
          resale_max_percent?: number | null
          starts_at: string
          title: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["event_category"]
          created_at?: string
          description?: string | null
          ends_at?: string | null
          face_value_tiers?: Json
          id?: string
          image_url?: string | null
          is_resellable?: boolean
          min_face_value_paise?: number | null
          organizer?: string | null
          resale_max_percent?: number | null
          starts_at?: string
          title?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "event_cards"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          description: string
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          description?: string
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          description?: string
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      fee_config: {
        Row: {
          buyer_fee_bps: number
          created_at: string
          created_by: string | null
          effective_from: string
          gst_bps: number
          id: string
          seller_fee_bps: number
        }
        Insert: {
          buyer_fee_bps: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          gst_bps: number
          id?: string
          seller_fee_bps: number
        }
        Update: {
          buyer_fee_bps?: number
          created_at?: string
          created_by?: string | null
          effective_from?: string
          gst_bps?: number
          id?: string
          seller_fee_bps?: number
        }
        Relationships: []
      }
      grievance_tickets: {
        Row: {
          created_at: string
          details: string
          due_at: string
          id: string
          order_id: string | null
          resolution_note: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details: string
          due_at?: string
          id?: string
          order_id?: string | null
          resolution_note?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: string
          due_at?: string
          id?: string
          order_id?: string | null
          resolution_note?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grievance_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grievance_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account: string
          amount_paise: number
          created_at: string
          direction: string
          entry_type: string
          id: string
          idempotency_key: string | null
          memo: string | null
          metadata: Json
          order_id: string | null
          provider_ref: string | null
          tcs_paise: number
          tds_paise: number
          transaction_group: string
          user_id: string | null
        }
        Insert: {
          account: string
          amount_paise: number
          created_at?: string
          direction: string
          entry_type?: string
          id?: string
          idempotency_key?: string | null
          memo?: string | null
          metadata?: Json
          order_id?: string | null
          provider_ref?: string | null
          tcs_paise?: number
          tds_paise?: number
          transaction_group?: string
          user_id?: string | null
        }
        Update: {
          account?: string
          amount_paise?: number
          created_at?: string
          direction?: string
          entry_type?: string
          id?: string
          idempotency_key?: string | null
          memo?: string | null
          metadata?: Json
          order_id?: string | null
          provider_ref?: string | null
          tcs_paise?: number
          tds_paise?: number
          transaction_group?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          listing_id: string
          reason: string
          reporter_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          listing_id: string
          reason: string
          reporter_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          listing_id?: string
          reason?: string
          reporter_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_risk_signals: {
        Row: {
          created_at: string
          details: Json
          id: string
          kind: string
          listing_id: string | null
          seller_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          kind: string
          listing_id?: string | null
          seller_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          kind?: string
          listing_id?: string | null
          seller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_risk_signals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_risk_signals_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_secrets: {
        Row: {
          checks: Json
          created_at: string
          extracted: Json
          file_mime: string
          file_path: string
          file_sha256: string | null
          listing_id: string
          listing_status_mirror: Database["public"]["Enums"]["listing_status"]
          qr_hash: string | null
          qr_source: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          seller_id: string
          updated_at: string
        }
        Insert: {
          checks?: Json
          created_at?: string
          extracted?: Json
          file_mime: string
          file_path: string
          file_sha256?: string | null
          listing_id: string
          listing_status_mirror?: Database["public"]["Enums"]["listing_status"]
          qr_hash?: string | null
          qr_source?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_id: string
          updated_at?: string
        }
        Update: {
          checks?: Json
          created_at?: string
          extracted?: Json
          file_mime?: string
          file_path?: string
          file_sha256?: string | null
          listing_id?: string
          listing_status_mirror?: Database["public"]["Enums"]["listing_status"]
          qr_hash?: string | null
          qr_source?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_secrets_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_secrets_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          auto_hidden: boolean
          block_reason: string | null
          created_at: string
          event_id: string
          face_value_paise: number
          held_until: string | null
          id: string
          is_paused: boolean
          price_paise: number
          quantity: number
          report_count: number
          seat_info: string | null
          section: string | null
          seller_id: string
          status: Database["public"]["Enums"]["listing_status"]
          ticket_proof_path: string | null
          trust_score: number | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          auto_hidden?: boolean
          block_reason?: string | null
          created_at?: string
          event_id: string
          face_value_paise: number
          held_until?: string | null
          id?: string
          is_paused?: boolean
          price_paise: number
          quantity?: number
          report_count?: number
          seat_info?: string | null
          section?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["listing_status"]
          ticket_proof_path?: string | null
          trust_score?: number | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          auto_hidden?: boolean
          block_reason?: string | null
          created_at?: string
          event_id?: string
          face_value_paise?: number
          held_until?: string | null
          id?: string
          is_paused?: boolean
          price_paise?: number
          quantity?: number
          report_count?: number
          seat_info?: string | null
          section?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["listing_status"]
          ticket_proof_path?: string | null
          trust_score?: number | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          metadata: Json
          note: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          metadata?: Json
          note?: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          metadata?: Json
          note?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_fee_gst_paise: number
          buyer_fee_paise: number
          buyer_id: string | null
          buyer_name: string | null
          buyer_phone: string | null
          buyer_state_code: string | null
          buyer_upi_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_due_at: string | null
          entry_confirmed_at: string | null
          fee_config_id: string | null
          hold_expires_at: string | null
          id: string
          idempotency_key: string | null
          invoice_issued_at: string | null
          invoice_number: string | null
          listing_id: string
          paid_at: string | null
          payment_method: string
          payment_provider: string
          payment_ref: string | null
          payout_released_at: string | null
          price_paise: number
          provider_order_ref: string | null
          quantity: number
          refund_provider_ref: string | null
          refunded_at: string | null
          seller_fee_gst_paise: number
          seller_fee_paise: number
          seller_id: string | null
          seller_net_paise: number
          status: Database["public"]["Enums"]["order_status"]
          tcs_paise: number
          tds_paise: number
          total_paise: number
          updated_at: string
        }
        Insert: {
          buyer_fee_gst_paise: number
          buyer_fee_paise: number
          buyer_id?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_state_code?: string | null
          buyer_upi_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_due_at?: string | null
          entry_confirmed_at?: string | null
          fee_config_id?: string | null
          hold_expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_issued_at?: string | null
          invoice_number?: string | null
          listing_id: string
          paid_at?: string | null
          payment_method?: string
          payment_provider?: string
          payment_ref?: string | null
          payout_released_at?: string | null
          price_paise: number
          provider_order_ref?: string | null
          quantity: number
          refund_provider_ref?: string | null
          refunded_at?: string | null
          seller_fee_gst_paise: number
          seller_fee_paise: number
          seller_id?: string | null
          seller_net_paise: number
          status?: Database["public"]["Enums"]["order_status"]
          tcs_paise?: number
          tds_paise?: number
          total_paise: number
          updated_at?: string
        }
        Update: {
          buyer_fee_gst_paise?: number
          buyer_fee_paise?: number
          buyer_id?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          buyer_state_code?: string | null
          buyer_upi_id?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_due_at?: string | null
          entry_confirmed_at?: string | null
          fee_config_id?: string | null
          hold_expires_at?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_issued_at?: string | null
          invoice_number?: string | null
          listing_id?: string
          paid_at?: string | null
          payment_method?: string
          payment_provider?: string
          payment_ref?: string | null
          payout_released_at?: string | null
          price_paise?: number
          provider_order_ref?: string | null
          quantity?: number
          refund_provider_ref?: string | null
          refunded_at?: string | null
          seller_fee_gst_paise?: number
          seller_fee_paise?: number
          seller_id?: string | null
          seller_net_paise?: number
          status?: Database["public"]["Enums"]["order_status"]
          tcs_paise?: number
          tds_paise?: number
          total_paise?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_fee_config_id_fkey"
            columns: ["fee_config_id"]
            isOneToOne: false
            referencedRelation: "fee_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_operations: {
        Row: {
          created_at: string
          error: string | null
          id: string
          operation: string
          order_id: string
          provider: string
          provider_ref: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          operation: string
          order_id: string
          provider: string
          provider_ref?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          operation?: string
          order_id?: string
          provider?: string
          provider_ref?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_operations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_webhook_events: {
        Row: {
          error: string | null
          event_id: string
          order_id: string | null
          payload_hash: string
          processed_at: string | null
          provider: string
          received_at: string
          status: string
        }
        Insert: {
          error?: string | null
          event_id: string
          order_id?: string | null
          payload_hash: string
          processed_at?: string | null
          provider: string
          received_at?: string
          status?: string
        }
        Update: {
          error?: string | null
          event_id?: string
          order_id?: string | null
          payload_hash?: string
          processed_at?: string | null
          provider?: string
          received_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_webhook_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount_paise: number
          created_at: string
          failure_reason: string | null
          id: string
          order_id: string | null
          provider: string
          provider_ref: string | null
          released_at: string | null
          scheduled_for: string | null
          seller_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          order_id?: string | null
          provider?: string
          provider_ref?: string | null
          released_at?: string | null
          scheduled_for?: string | null
          seller_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          order_id?: string | null
          provider?: string
          provider_ref?: string | null
          released_at?: string | null
          scheduled_for?: string | null
          seller_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          is_banned: boolean
          is_verified: boolean
          payout_account_holder: string | null
          payout_bank_account: string | null
          payout_bank_ifsc: string | null
          payout_upi_id: string | null
          preferred_lang: string
          preferred_payment_method: string
          profile_completed: boolean
          razorpay_route_account_id: string | null
          saved_upi_id: string | null
          state_code: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_banned?: boolean
          is_verified?: boolean
          payout_account_holder?: string | null
          payout_bank_account?: string | null
          payout_bank_ifsc?: string | null
          payout_upi_id?: string | null
          preferred_lang?: string
          preferred_payment_method?: string
          profile_completed?: boolean
          razorpay_route_account_id?: string | null
          saved_upi_id?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_banned?: boolean
          is_verified?: boolean
          payout_account_holder?: string | null
          payout_bank_account?: string | null
          payout_bank_ifsc?: string | null
          payout_upi_id?: string | null
          preferred_lang?: string
          preferred_payment_method?: string
          profile_completed?: boolean
          razorpay_route_account_id?: string | null
          saved_upi_id?: string | null
          state_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      resale_rules: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          max_price_bps_of_face: number
          note: string | null
          priority: number
          resale_allowed: boolean
          scope: string
          state_code: string | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          max_price_bps_of_face?: number
          note?: string | null
          priority?: number
          resale_allowed?: boolean
          scope: string
          state_code?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          max_price_bps_of_face?: number
          note?: string | null
          priority?: number
          resale_allowed?: boolean
          scope?: string
          state_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resale_rules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resale_rules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_device_signals: {
        Row: {
          created_at: string
          device_hash: string
          id: string
          seller_id: string
        }
        Insert: {
          created_at?: string
          device_hash: string
          id?: string
          seller_id: string
        }
        Update: {
          created_at?: string
          device_hash?: string
          id?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_device_signals_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_reviews: {
        Row: {
          buyer_id: string
          comment: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          seller_id: string
        }
        Insert: {
          buyer_id: string
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          seller_id: string
        }
        Update: {
          buyer_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_reviews_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_reviews_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_config: {
        Row: {
          created_at: string
          effective_from: string
          enabled: boolean
          id: string
          tcs_bps: number
          tds_bps: number
        }
        Insert: {
          created_at?: string
          effective_from?: string
          enabled?: boolean
          id?: string
          tcs_bps?: number
          tds_bps?: number
        }
        Update: {
          created_at?: string
          effective_from?: string
          enabled?: boolean
          id?: string
          tcs_bps?: number
          tds_bps?: number
        }
        Relationships: []
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
      venues: {
        Row: {
          address: string | null
          city: string
          created_at: string
          id: string
          name: string
          state_code: string
        }
        Insert: {
          address?: string | null
          city: string
          created_at?: string
          id?: string
          name: string
          state_code: string
        }
        Update: {
          address?: string | null
          city?: string
          created_at?: string
          id?: string
          name?: string
          state_code?: string
        }
        Relationships: []
      }
      waitlist_entries: {
        Row: {
          created_at: string
          event_id: string
          id: string
          max_price_paise: number
          quantity: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          max_price_paise: number
          quantity?: number
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          max_price_paise?: number
          quantity?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_offers: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          listing_id: string
          status: string
          waitlist_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          listing_id: string
          status?: string
          waitlist_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          listing_id?: string
          status?: string
          waitlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_offers_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_offers_waitlist_id_fkey"
            columns: ["waitlist_id"]
            isOneToOne: false
            referencedRelation: "waitlist_entries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      event_cards: {
        Row: {
          active_listings: number | null
          category: Database["public"]["Enums"]["event_category"] | null
          city: string | null
          from_price_paise: number | null
          id: string | null
          image_url: string | null
          is_resellable: boolean | null
          min_face_value_paise: number | null
          min_price_paise: number | null
          organizer: string | null
          resale_max_percent: number | null
          starts_at: string | null
          state_code: string | null
          title: string | null
          venue_id: string | null
          venue_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      become_seller: { Args: never; Returns: boolean }
      begin_webhook: {
        Args: {
          p_event_id: string
          p_order_id: string
          p_payload_hash: string
          p_provider: string
        }
        Returns: boolean
      }
      claim_payment_operation: {
        Args: { p_operation: string; p_order_id: string; p_provider: string }
        Returns: boolean
      }
      claim_payout: {
        Args: { p_payout_id: string }
        Returns: {
          amount_paise: number
          created_at: string
          failure_reason: string | null
          id: string
          order_id: string | null
          provider: string
          provider_ref: string | null
          released_at: string | null
          scheduled_for: string | null
          seller_id: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_payout: {
        Args: { p_payout_id: string; p_provider_ref: string }
        Returns: {
          amount_paise: number
          created_at: string
          failure_reason: string | null
          id: string
          order_id: string | null
          provider: string
          provider_ref: string | null
          released_at: string | null
          scheduled_for: string | null
          seller_id: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_buyer_entry: {
        Args: { p_buyer_id: string; p_order_id: string }
        Returns: {
          buyer_fee_gst_paise: number
          buyer_fee_paise: number
          buyer_id: string | null
          buyer_name: string | null
          buyer_phone: string | null
          buyer_state_code: string | null
          buyer_upi_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_due_at: string | null
          entry_confirmed_at: string | null
          fee_config_id: string | null
          hold_expires_at: string | null
          id: string
          idempotency_key: string | null
          invoice_issued_at: string | null
          invoice_number: string | null
          listing_id: string
          paid_at: string | null
          payment_method: string
          payment_provider: string
          payment_ref: string | null
          payout_released_at: string | null
          price_paise: number
          provider_order_ref: string | null
          quantity: number
          refund_provider_ref: string | null
          refunded_at: string | null
          seller_fee_gst_paise: number
          seller_fee_paise: number
          seller_id: string | null
          seller_net_paise: number
          status: Database["public"]["Enums"]["order_status"]
          tcs_paise: number
          tds_paise: number
          total_paise: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_checkout_order: {
        Args: {
          p_buyer_fee_gst_paise: number
          p_buyer_fee_paise: number
          p_buyer_id: string
          p_buyer_name: string
          p_buyer_phone: string
          p_buyer_state_code: string
          p_buyer_upi_id: string
          p_fee_config_id: string
          p_idempotency_key: string
          p_listing_id: string
          p_payment_method: string
          p_quantity: number
          p_seller_fee_gst_paise: number
          p_seller_fee_paise: number
          p_seller_net_paise: number
          p_total_paise: number
          p_unit_price_paise: number
        }
        Returns: {
          buyer_fee_gst_paise: number
          buyer_fee_paise: number
          buyer_id: string | null
          buyer_name: string | null
          buyer_phone: string | null
          buyer_state_code: string | null
          buyer_upi_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_due_at: string | null
          entry_confirmed_at: string | null
          fee_config_id: string | null
          hold_expires_at: string | null
          id: string
          idempotency_key: string | null
          invoice_issued_at: string | null
          invoice_number: string | null
          listing_id: string
          paid_at: string | null
          payment_method: string
          payment_provider: string
          payment_ref: string | null
          payout_released_at: string | null
          price_paise: number
          provider_order_ref: string | null
          quantity: number
          refund_provider_ref: string | null
          refunded_at: string | null
          seller_fee_gst_paise: number
          seller_fee_paise: number
          seller_id: string | null
          seller_net_paise: number
          status: Database["public"]["Enums"]["order_status"]
          tcs_paise: number
          tds_paise: number
          total_paise: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_checkout_order_v2: {
        Args: {
          p_buyer_fee_gst_paise: number
          p_buyer_fee_paise: number
          p_buyer_id: string
          p_buyer_name: string
          p_buyer_phone: string
          p_buyer_state_code: string
          p_buyer_upi_id: string
          p_fee_config_id: string
          p_idempotency_key: string
          p_listing_id: string
          p_payment_method: string
          p_payment_provider: string
          p_quantity: number
          p_seller_fee_gst_paise: number
          p_seller_fee_paise: number
          p_seller_net_paise: number
          p_tcs_paise: number
          p_tds_paise: number
          p_total_paise: number
          p_unit_price_paise: number
        }
        Returns: {
          buyer_fee_gst_paise: number
          buyer_fee_paise: number
          buyer_id: string | null
          buyer_name: string | null
          buyer_phone: string | null
          buyer_state_code: string | null
          buyer_upi_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_due_at: string | null
          entry_confirmed_at: string | null
          fee_config_id: string | null
          hold_expires_at: string | null
          id: string
          idempotency_key: string | null
          invoice_issued_at: string | null
          invoice_number: string | null
          listing_id: string
          paid_at: string | null
          payment_method: string
          payment_provider: string
          payment_ref: string | null
          payout_released_at: string | null
          price_paise: number
          provider_order_ref: string | null
          quantity: number
          refund_provider_ref: string | null
          refunded_at: string | null
          seller_fee_gst_paise: number
          seller_fee_paise: number
          seller_id: string | null
          seller_net_paise: number
          status: Database["public"]["Enums"]["order_status"]
          tcs_paise: number
          tds_paise: number
          total_paise: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_started_listings: { Args: never; Returns: number }
      fail_payment_operation: {
        Args: { p_error: string; p_operation: string; p_order_id: string }
        Returns: undefined
      }
      fail_payout: {
        Args: { p_error: string; p_payout_id: string }
        Returns: undefined
      }
      finish_webhook: {
        Args: { p_error?: string; p_event_id: string; p_provider: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_seller_ready: { Args: { _user_id: string }; Returns: boolean }
      notify_listing_available: {
        Args: { p_listing_id: string }
        Returns: undefined
      }
      record_late_refunded_payment: {
        Args: {
          p_actor_id: string
          p_order_id: string
          p_payment_ref: string
          p_refund_ref: string
        }
        Returns: {
          buyer_fee_gst_paise: number
          buyer_fee_paise: number
          buyer_id: string | null
          buyer_name: string | null
          buyer_phone: string | null
          buyer_state_code: string | null
          buyer_upi_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_due_at: string | null
          entry_confirmed_at: string | null
          fee_config_id: string | null
          hold_expires_at: string | null
          id: string
          idempotency_key: string | null
          invoice_issued_at: string | null
          invoice_number: string | null
          listing_id: string
          paid_at: string | null
          payment_method: string
          payment_provider: string
          payment_ref: string | null
          payout_released_at: string | null
          price_paise: number
          provider_order_ref: string | null
          quantity: number
          refund_provider_ref: string | null
          refunded_at: string | null
          seller_fee_gst_paise: number
          seller_fee_paise: number
          seller_id: string | null
          seller_net_paise: number
          status: Database["public"]["Enums"]["order_status"]
          tcs_paise: number
          tds_paise: number
          total_paise: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_order_payment: {
        Args: {
          p_actor_id: string
          p_delivery_hours?: number
          p_order_id: string
          p_payment_ref: string
        }
        Returns: {
          buyer_fee_gst_paise: number
          buyer_fee_paise: number
          buyer_id: string | null
          buyer_name: string | null
          buyer_phone: string | null
          buyer_state_code: string | null
          buyer_upi_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_due_at: string | null
          entry_confirmed_at: string | null
          fee_config_id: string | null
          hold_expires_at: string | null
          id: string
          idempotency_key: string | null
          invoice_issued_at: string | null
          invoice_number: string | null
          listing_id: string
          paid_at: string | null
          payment_method: string
          payment_provider: string
          payment_ref: string | null
          payout_released_at: string | null
          price_paise: number
          provider_order_ref: string | null
          quantity: number
          refund_provider_ref: string | null
          refunded_at: string | null
          seller_fee_gst_paise: number
          seller_fee_paise: number
          seller_id: string | null
          seller_net_paise: number
          status: Database["public"]["Enums"]["order_status"]
          tcs_paise: number
          tds_paise: number
          total_paise: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_order_refund: {
        Args: {
          p_actor_id: string
          p_note: string
          p_order_id: string
          p_refund_ref: string
        }
        Returns: {
          buyer_fee_gst_paise: number
          buyer_fee_paise: number
          buyer_id: string | null
          buyer_name: string | null
          buyer_phone: string | null
          buyer_state_code: string | null
          buyer_upi_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_due_at: string | null
          entry_confirmed_at: string | null
          fee_config_id: string | null
          hold_expires_at: string | null
          id: string
          idempotency_key: string | null
          invoice_issued_at: string | null
          invoice_number: string | null
          listing_id: string
          paid_at: string | null
          payment_method: string
          payment_provider: string
          payment_ref: string | null
          payout_released_at: string | null
          price_paise: number
          provider_order_ref: string | null
          quantity: number
          refund_provider_ref: string | null
          refunded_at: string | null
          seller_fee_gst_paise: number
          seller_fee_paise: number
          seller_id: string | null
          seller_net_paise: number
          status: Database["public"]["Enums"]["order_status"]
          tcs_paise: number
          tds_paise: number
          total_paise: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_checkout_order: {
        Args: { p_actor_id: string; p_order_id: string; p_reason: string }
        Returns: {
          buyer_fee_gst_paise: number
          buyer_fee_paise: number
          buyer_id: string | null
          buyer_name: string | null
          buyer_phone: string | null
          buyer_state_code: string | null
          buyer_upi_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_due_at: string | null
          entry_confirmed_at: string | null
          fee_config_id: string | null
          hold_expires_at: string | null
          id: string
          idempotency_key: string | null
          invoice_issued_at: string | null
          invoice_number: string | null
          listing_id: string
          paid_at: string | null
          payment_method: string
          payment_provider: string
          payment_ref: string | null
          payout_released_at: string | null
          price_paise: number
          provider_order_ref: string | null
          quantity: number
          refund_provider_ref: string | null
          refunded_at: string | null
          seller_fee_gst_paise: number
          seller_fee_paise: number
          seller_id: string | null
          seller_net_paise: number
          status: Database["public"]["Enums"]["order_status"]
          tcs_paise: number
          tds_paise: number
          total_paise: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      release_expired_checkouts: { Args: never; Returns: number }
      seller_public_stats: {
        Args: { _seller_id: string }
        Returns: {
          average_rating: number
          completed_sales: number
          rating_count: number
        }[]
      }
      seller_reputation: {
        Args: { _seller_id: string }
        Returns: {
          average_rating: number
          completed_sales: number
          dispute_count: number
          dispute_rate: number
          is_verified: boolean
          rating_count: number
        }[]
      }
      transition_order: {
        Args: {
          p_actor_id: string
          p_expected: Database["public"]["Enums"]["order_status"]
          p_next: Database["public"]["Enums"]["order_status"]
          p_note: string
          p_order_id: string
          p_payment_ref?: string
        }
        Returns: {
          buyer_fee_gst_paise: number
          buyer_fee_paise: number
          buyer_id: string | null
          buyer_name: string | null
          buyer_phone: string | null
          buyer_state_code: string | null
          buyer_upi_id: string | null
          created_at: string
          delivered_at: string | null
          delivery_due_at: string | null
          entry_confirmed_at: string | null
          fee_config_id: string | null
          hold_expires_at: string | null
          id: string
          idempotency_key: string | null
          invoice_issued_at: string | null
          invoice_number: string | null
          listing_id: string
          paid_at: string | null
          payment_method: string
          payment_provider: string
          payment_ref: string | null
          payout_released_at: string | null
          price_paise: number
          provider_order_ref: string | null
          quantity: number
          refund_provider_ref: string | null
          refunded_at: string | null
          seller_fee_gst_paise: number
          seller_fee_paise: number
          seller_id: string | null
          seller_net_paise: number
          status: Database["public"]["Enums"]["order_status"]
          tcs_paise: number
          tds_paise: number
          total_paise: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "buyer" | "seller" | "admin"
      event_category: "movie" | "sports" | "concert" | "other"
      listing_status:
        | "draft"
        | "active"
        | "held"
        | "sold"
        | "cancelled"
        | "expired"
      order_status:
        | "pending"
        | "paid"
        | "delivered"
        | "completed"
        | "refunded"
        | "cancelled"
        | "disputed"
        | "payment_pending"
        | "ticket_delivered"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["buyer", "seller", "admin"],
      event_category: ["movie", "sports", "concert", "other"],
      listing_status: [
        "draft",
        "active",
        "held",
        "sold",
        "cancelled",
        "expired",
      ],
      order_status: [
        "pending",
        "paid",
        "delivered",
        "completed",
        "refunded",
        "cancelled",
        "disputed",
        "payment_pending",
        "ticket_delivered",
      ],
    },
  },
} as const
