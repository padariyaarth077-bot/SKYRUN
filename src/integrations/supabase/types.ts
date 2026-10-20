export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Row<T, R extends readonly unknown[] = []> = {
  Row: T;
  Insert: Partial<T>;
  Update: Partial<T>;
  Relationships: R;
};

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      service_configuration: Row<{
        id: string;
        business_unit_id: string;
        kind: "service" | "service_area";
        name: string;
        description: string;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      booking_deposit_receipts: Row<{
        id: string;
        booking_id: string;
        business_unit_id: string;
        external_reference: string;
        amount: number;
        currency: string;
        received_at: string;
        recorded_by: string;
        recorded_at: string;
        verified_by: string | null;
        verified_at: string | null;
      }>;
      booking_deposit_reversals: Row<{
        id: string;
        receipt_id: string;
        booking_id: string;
        business_unit_id: string;
        reason: string;
        actor_id: string;
        created_at: string;
      }>;
      quote_acceptance_links: Row<{
        id: string;
        quote_id: string;
        business_unit_id: string;
        token_hash: string;
        recipient_email: string;
        snapshot: Json;
        expires_at: string;
        created_by: string;
        created_at: string;
        provider_email_id: string | null;
        delivered_at: string | null;
        revoked_at: string | null;
        accepted_at: string | null;
        booking_id: string | null;
      }>;
      quote_deliveries: Row<{
        id: string;
        public_origin: string;
        message_text: string;
        is_test: boolean;
        state: string;
        first_attempt_at: string | null;
        attempt_id: string | null;
        lease_until: string | null;
        provider_email_id: string | null;
        created_at: string;
      }>;
      organizations: Row<{
        id: string;
        name: string;
        slug: string;
        status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
        created_at: string;
        updated_at: string;
      }>;
      business_units: Row<{
        id: string;
        organization_id: string;
        name: string;
        slug: string;
        business_type: "LIMO" | "FOOD";
        status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
        created_at: string;
        updated_at: string;
      }>;
      profiles: Row<{
        id: string;
        full_name: string | null;
        phone: string | null;
        avatar_url: string | null;
        status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
        created_at: string;
        updated_at: string;
      }>;
      user_roles: Row<{
        id: string;
        user_id: string;
        business_unit_id: string | null;
        role: Database["public"]["Enums"]["app_role"];
        created_at: string;
      }>;
      customers: Row<
        {
          id: string;
          business_unit_id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          company_name: string | null;
          notes: string | null;
          status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
          created_at: string;
          updated_at: string;
        },
        [
          {
            foreignKeyName: "leads_customer_id_fkey";
            columns: ["id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["customer_id"];
          },
        ]
      >;
      leads: Row<
        {
          id: string;
          business_unit_id: string;
          customer_id: string | null;
          lead_number: string;
          source: Database["public"]["Enums"]["lead_source"];
          status: Database["public"]["Enums"]["lead_status"];
          priority: string;
          assigned_to: string | null;
          subject: string | null;
          message: string;
          last_activity_at: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          spam_reason: string | null;
          created_at: string;
          updated_at: string;
        },
        [
          {
            foreignKeyName: "leads_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ]
      >;
      conversations: Row<
        {
          id: string;
          business_unit_id: string;
          lead_id: string | null;
          customer_id: string | null;
          channel: string;
          status: string;
          session_token_hash: string | null;
          assigned_to: string | null;
          handoff_requested_at: string | null;
          visitor_last_read_at: string | null;
          started_at: string;
          ended_at: string | null;
          created_at: string;
          updated_at: string;
        },
        [
          {
            foreignKeyName: "conversations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ]
      >;
      conversation_messages: Row<{
        id: string;
        conversation_id: string;
        sender_type: string;
        message: string;
        metadata: Json | null;
        created_at: string;
      }>;
      ride_requests: Row<{
        id: string;
        business_unit_id: string;
        lead_id: string | null;
        customer_id: string;
        vehicle_category_id: string | null;
        pickup_location: string;
        dropoff_location: string;
        travel_date: string;
        pickup_time: string | null;
        trip_type: Database["public"]["Enums"]["trip_type"];
        return_date: string | null;
        return_time: string | null;
        hourly_duration: number | null;
        passenger_count: number;
        airport_code: string | null;
        airport_direction: string | null;
        flight_number: string | null;
        notes: string | null;
        status: Database["public"]["Enums"]["ride_request_status"];
        request_number: string;
        submission_key: string | null;
        created_at: string;
        updated_at: string;
      }>;
      quotes: Row<{
        id: string;
        business_unit_id: string;
        ride_request_id: string;
        customer_id: string;
        vehicle_category_id: string | null;
        pickup_location: string;
        dropoff_location: string;
        travel_date: string;
        pickup_time: string | null;
        amount: number;
        currency: string;
        valid_until: string;
        status: Database["public"]["Enums"]["quote_status"];
        notes: string | null;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      bookings: Row<{
        id: string;
        business_unit_id: string;
        customer_id: string;
        ride_request_id: string | null;
        quote_id: string | null;
        vehicle_category_id: string | null;
        booking_number: string;
        pickup_location: string;
        dropoff_location: string;
        travel_date: string;
        pickup_time: string | null;
        passenger_count: number;
        status: Database["public"]["Enums"]["booking_status"];
        final_amount: number | null;
        required_deposit_amount: number | null;
        currency: string;
        notes: string | null;
        confirmed_at: string | null;
        completed_at: string | null;
        cancelled_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      vehicle_categories: Row<{
        image_path: string | null;
        id: string;
        business_unit_id: string;
        name: string;
        slug: string;
        description: string | null;
        passenger_capacity: number;
        luggage_capacity: number;
        display_order: number;
        is_visible: boolean;
        created_at: string;
        updated_at: string;
      }>;
      vehicles: Row<{
        image_path: string | null;
        id: string;
        business_unit_id: string;
        vehicle_category_id: string;
        make: string;
        model: string;
        year: number | null;
        passenger_capacity: number | null;
        luggage_capacity: number | null;
        status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
        description: string | null;
        created_at: string;
        updated_at: string;
      }>;
      activities: Row<{
        id: string;
        business_unit_id: string;
        entity_type: string;
        entity_id: string;
        activity_type: string;
        actor_id: string | null;
        description: string;
        metadata: Json | null;
        created_at: string;
      }>;
    };
    Views: { [_ in never]: never };
    Functions: {
      can_manage_operations: { Args: { _business_unit_id: string }; Returns: boolean };
      phase5_save: {
        Args: {
          _kind: string;
          _id: string;
          _business_unit_id: string;
          _payload: Json;
          _expected_updated_at: string | null;
          _operation_id: string;
        };
        Returns: string;
      };
      can_manage_booking: { Args: { _business_unit_id: string }; Returns: boolean };
      phase4_booking_action: {
        Args: {
          _booking_id: string;
          _operation_id: string;
          _action: string;
          _payload: Json;
          _expected_updated_at: string;
        };
        Returns: string;
      };
      quote_delivery_status: { Args: { _quote_id: string }; Returns: Json };
      begin_quote_delivery: {
        Args: {
          _quote_id: string;
          _delivery_id: string;
          _token_hash: string;
          _expected_updated_at: string;
          _expected_ride_updated_at: string | null;
          _reviewed_recipient: string;
          _public_origin: string;
          _is_test: boolean;
          _attempt_id: string;
        };
        Returns: Json;
      };
      finish_quote_delivery: {
        Args: { _delivery_id: string; _attempt_id: string; _provider_email_id: string | null };
        Returns: undefined;
      };
      store_quote_delivery_event: {
        Args: {
          _event_id: string;
          _provider_email_id: string;
          _event_type: string;
          _recipient: string;
          _sender: string;
          _payload_hash: string;
        };
        Returns: undefined;
      };
      process_quote_delivery_events: { Args: { _provider_email_id: string }; Returns: undefined };
      customer_quote_acceptance: {
        Args: { _token_hash: string; _accept: boolean };
        Returns: Json;
      };
      prepare_quote_acceptance: {
        Args: {
          _link_id: string;
          _quote_id: string;
          _token_hash: string;
          _expected_updated_at: string;
        };
        Returns: Json;
      };
      revoke_quote_acceptance: { Args: { _link_id: string }; Returns: undefined };
      record_quote_delivery: {
        Args: { _link_id: string; _provider_email_id: string };
        Returns: undefined;
      };
      save_quote_draft: {
        Args: {
          _quote_id: string;
          _ride_request_id: string;
          _amount: string;
          _currency: string;
          _valid_until: string;
          _notes: string;
          _expected_updated_at: string | null;
        };
        Returns: string;
      };

      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _user_id: string };
        Returns: boolean;
      };
      has_role_any: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][]; _user_id: string };
        Returns: boolean;
      };
      chat_start_conversation: {
        Args: { _business_unit_id: string; _session_token_hash: string };
        Returns: string;
      };
      chat_load_conversation: { Args: { _session_token_hash: string }; Returns: Json };
      chat_append_visitor_message: {
        Args: { _session_token_hash: string; _message: string };
        Returns: Json;
      };
      chat_append_bot_message: {
        Args: { _session_token_hash: string; _message: string };
        Returns: string;
      };
      chat_request_handoff: { Args: { _session_token_hash: string }; Returns: Json };
      chat_capture_contact: {
        Args: {
          _session_token_hash: string;
          _name: string;
          _email: string;
          _phone: string;
          _trip_details: string;
        };
        Returns: Json;
      };
      create_ride_enquiry: {
        Args: {
          _business_unit_id: string;
          _submission_key: string;
          _name: string;
          _email: string;
          _phone: string;
          _subject: string;
          _service: string;
          _pickup_location: string;
          _dropoff_location: string;
          _travel_date: string;
          _pickup_time: string;
          _passenger_count: number;
          _vehicle_preference: string;
          _notes: string;
        };
        Returns: Json;
      };
      log_activity: {
        Args: {
          _entity_type: string;
          _entity_id: string;
          _activity_type: string;
          _description: string;
          _metadata?: Json;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role: "SUPER_ADMIN" | "ADMIN" | "DISPATCHER" | "MANAGER" | "CONTENT_MANAGER" | "SUPPORT";
      lead_source:
        "CONTACT_FORM" | "RIDE_ENQUIRY" | "CHATBOT" | "PHONE" | "EMAIL" | "ADMIN" | "PARTNER";
      lead_status:
        | "NEW"
        | "REVIEWING"
        | "GENUINE"
        | "CONTACTED"
        | "QUALIFIED"
        | "QUOTE_REQUESTED"
        | "QUOTE_SENT"
        | "NEGOTIATING"
        | "WON"
        | "LOST"
        | "SPAM";
      ride_request_status:
        | "DRAFT"
        | "SUBMITTED"
        | "UNDER_REVIEW"
        | "QUOTE_PENDING"
        | "QUOTED"
        | "ACCEPTED"
        | "CONVERTED"
        | "CANCELLED"
        | "EXPIRED";
      quote_status: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "CANCELLED";
      booking_status:
        | "PENDING"
        | "CONFIRMED"
        | "ASSIGNED"
        | "DRIVER_ASSIGNED"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "CANCELLED"
        | "NO_SHOW";
      trip_type: "ONE_WAY" | "ROUND_TRIP" | "HOURLY";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export const Constants = {
  public: {
    Enums: {
      app_role: ["SUPER_ADMIN", "ADMIN", "DISPATCHER", "MANAGER", "CONTENT_MANAGER", "SUPPORT"],
    },
  },
} as const;
