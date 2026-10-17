import { z } from "zod";

export const CHAT_SESSION_KEY = "skyrun_chat_session";
export const CHAT_BUSINESS_UNIT_ID = "00000000-0000-0000-0000-000000000002";
export const CHAT_MAX_MESSAGE_LENGTH = 1500;

export const chatMessageSchema = z.object({
  session: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
  message: z.string().trim().min(1).max(CHAT_MAX_MESSAGE_LENGTH),
});

export const chatContactSchema = z.object({
  session: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(5).max(40),
  pickupLocation: z.string().trim().max(300).optional(),
  dropoffLocation: z.string().trim().max(300).optional(),
  pickupDate: z.string().trim().max(32).optional(),
  pickupTime: z.string().trim().max(16).optional(),
  passengerCount: z.coerce.number().int().min(1).max(99).optional(),
  luggage: z.string().trim().max(300).optional(),
  website: z.string().max(0).optional(),
});

export type ChatMessage = {
  id: string;
  sender_type: "CUSTOMER" | "BOT" | "ADMIN" | "SYSTEM";
  message: string;
  created_at: string;
};

export type ChatConversation = {
  id: string;
  status:
    | "AI_HANDLING"
    | "HANDOFF_REQUESTED"
    | "HUMAN_HANDLING"
    | "WAITING_FOR_CUSTOMER"
    | "RESOLVED"
    | "OPEN"
    | "CLOSED"
    | "ESCALATED";
  assigned_to: string | null;
  handoff_requested_at: string | null;
  lead_id: string | null;
  customer_id: string | null;
  updated_at: string;
};

export function fallbackReply(message: string): string {
  const text = message.toLowerCase();
  if (/(price|cost|fare|quote|discount)/.test(text)) {
    return "We do not publish fixed fares here because each trip is reviewed individually. I can collect your trip details, or you can ask for a member of our team.";
  }
  if (/(book|reserv|availab|confirm)/.test(text)) {
    return "I can help collect an enquiry, but a ride is confirmed only after the Skyrun team reviews the details and responds.";
  }
  if (/(fleet|vehicle|suv|sedan|expedition|e350|glc)/.test(text)) {
    return "Skyrun currently presents luxury SUVs and sedans, including a Ford Expedition, Mercedes-Benz E350, and Mercedes-Benz GLC 300. Vehicle suitability is confirmed after the team reviews your trip.";
  }
  if (/(airport|ohare|o'hare|midway)/.test(text)) {
    return "Skyrun can help with airport transportation. Please share your pickup, destination, date, time, passenger count, and luggage needs so the team can review your request.";
  }
  if (/(human|person|agent|representative|call)/.test(text)) {
    return "I can bring a member of the Skyrun team into this conversation. Use the “Talk to a person” button and they will review your request.";
  }
  return "I can help with chauffeur services, vehicles, airport travel, or the details needed for a trip enquiry. If you would rather speak with a person, you can request human support at any time.";
}
