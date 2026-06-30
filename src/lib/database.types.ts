export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      allowed_users: {
        Row: { created_at: string; email: string }
        Insert: { created_at?: string; email: string }
        Update: { created_at?: string; email?: string }
        Relationships: []
      }
      lead_notes: {
        Row: {
          author_email: string | null
          body: string
          created_at: string
          id: string
          lead_id: string
        }
        Insert: {
          author_email?: string | null
          body: string
          created_at?: string
          id?: string
          lead_id: string
        }
        Update: {
          author_email?: string | null
          body?: string
          created_at?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      erfscans: {
        Row: {
          id: string
          lead_id: string
          status: string
          conclusie: string | null
          dossier: Json
          tier3: Json
          luchtfoto_path: string | null
          report_pdf_path: string | null
          draft_email_subject: string | null
          draft_email_body: string | null
          error: string | null
          enriched_at: string | null
          sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          status?: string
          conclusie?: string | null
          dossier?: Json
          tier3?: Json
          luchtfoto_path?: string | null
          report_pdf_path?: string | null
          draft_email_subject?: string | null
          draft_email_body?: string | null
          error?: string | null
          enriched_at?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          status?: string
          conclusie?: string | null
          dossier?: Json
          tier3?: Json
          luchtfoto_path?: string | null
          report_pdf_path?: string | null
          draft_email_subject?: string | null
          draft_email_body?: string | null
          error?: string | null
          enriched_at?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erfscans_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          achternaam: string | null
          audience: string | null
          budget: string | null
          created_at: string
          details: Json | null
          email: string | null
          huisnummer: string | null
          id: string
          naam: string | null
          planning: string | null
          postcode: string | null
          source: string | null
          startdatum: string | null
          status: string
          telefoon: string | null
          toevoeging: string | null
          type: string
          updated_at: string
          voornaam: string | null
        }
        Insert: {
          achternaam?: string | null
          audience?: string | null
          budget?: string | null
          created_at?: string
          details?: Json | null
          email?: string | null
          huisnummer?: string | null
          id?: string
          naam?: string | null
          planning?: string | null
          postcode?: string | null
          source?: string | null
          startdatum?: string | null
          status?: string
          telefoon?: string | null
          toevoeging?: string | null
          type: string
          updated_at?: string
          voornaam?: string | null
        }
        Update: {
          achternaam?: string | null
          audience?: string | null
          budget?: string | null
          created_at?: string
          details?: Json | null
          email?: string | null
          huisnummer?: string | null
          id?: string
          naam?: string | null
          planning?: string | null
          postcode?: string | null
          source?: string | null
          startdatum?: string | null
          status?: string
          telefoon?: string | null
          toevoeging?: string | null
          type?: string
          updated_at?: string
          voornaam?: string | null
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      is_allowed_user: { Args: never; Returns: boolean }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]

export type Lead = Tables<"leads">
export type LeadNote = Tables<"lead_notes">
export type Erfscan = Tables<"erfscans">
