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
        currency: string;
        notes: string | null;
        confirmed_at: string | null;
        completed_at: string | null;
        cancelled_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      vehicle_categories: Row<{
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
