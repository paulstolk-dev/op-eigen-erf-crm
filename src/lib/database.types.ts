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
      ad_spend: {
        Row: {
          date: string
          cost_eur: number
          clicks: number | null
          impressions: number | null
          currency: string
          synced_at: string
        }
        Insert: {
          date: string
          cost_eur?: number
          clicks?: number | null
          impressions?: number | null
          currency?: string
          synced_at?: string
        }
        Update: {
          date?: string
          cost_eur?: number
          clicks?: number | null
          impressions?: number | null
          currency?: string
          synced_at?: string
        }
        Relationships: []
      }
      aanbieders: {
        Row: {
          id: string
          slug: string | null
          naam: string
          website_url: string | null
          logo_url: string | null
          beschrijving: string | null
          vestigingsplaats: string | null
          servicegebied: string | null
          bouwmethode: string | null
          levertijd_indicatie: string | null
          vergunningsbegeleiding: "ja" | "nee" | "niet_vermeld"
          koop: boolean
          huur: boolean
          tweedehands: boolean
          prijsklasse: "budget" | "standaard" | "luxe" | null
          vanaf_prijs_incl_btw: number | null
          prijs_per_m2_indicatie: number | null
          afwerkingsniveaus: string[] | null
          in_vanaf_prijs: string | null
          prijspeil: string | null
          bron_url: string | null
          laatst_gecontroleerd: string | null
          is_partner: boolean
          actief: boolean
          sortering: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug?: string | null
          naam: string
          website_url?: string | null
          logo_url?: string | null
          beschrijving?: string | null
          vestigingsplaats?: string | null
          servicegebied?: string | null
          bouwmethode?: string | null
          levertijd_indicatie?: string | null
          vergunningsbegeleiding?: "ja" | "nee" | "niet_vermeld"
          koop?: boolean
          huur?: boolean
          tweedehands?: boolean
          prijsklasse?: "budget" | "standaard" | "luxe" | null
          vanaf_prijs_incl_btw?: number | null
          prijs_per_m2_indicatie?: number | null
          afwerkingsniveaus?: string[] | null
          in_vanaf_prijs?: string | null
          prijspeil?: string | null
          bron_url?: string | null
          laatst_gecontroleerd?: string | null
          is_partner?: boolean
          actief?: boolean
          sortering?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          slug?: string | null
          naam?: string
          website_url?: string | null
          logo_url?: string | null
          beschrijving?: string | null
          vestigingsplaats?: string | null
          servicegebied?: string | null
          bouwmethode?: string | null
          levertijd_indicatie?: string | null
          vergunningsbegeleiding?: "ja" | "nee" | "niet_vermeld"
          koop?: boolean
          huur?: boolean
          tweedehands?: boolean
          prijsklasse?: "budget" | "standaard" | "luxe" | null
          vanaf_prijs_incl_btw?: number | null
          prijs_per_m2_indicatie?: number | null
          afwerkingsniveaus?: string[] | null
          in_vanaf_prijs?: string | null
          prijspeil?: string | null
          bron_url?: string | null
          laatst_gecontroleerd?: string | null
          is_partner?: boolean
          actief?: boolean
          sortering?: number
          updated_at?: string
        }
        Relationships: []
      }
      woningen: {
        Row: {
          id: string
          aanbieder_id: string
          slug: string | null
          naam: string
          oppervlakte_m2: number | null
          oppervlakte_max_m2: number | null
          slaapkamers: number | null
          prijs_incl_btw: number | null
          btw_basis_bron: "incl" | "ex"
          is_vanaf_prijs: boolean
          prijs_per_m2: number | null
          afwerkingsniveau: "casco" | "instapklaar" | "luxe" | null
          aanbod_type: "koop" | "huur" | "tweedehands"
          in_prijs_inbegrepen: string | null
          beschrijving: string | null
          gelijkvloers: boolean | null
          energieneutraal_beng: boolean | null
          afbeeldingen: string[] | null
          bron_url: string | null
          prijspeil: string | null
          laatst_gecontroleerd: string | null
          actief: boolean
          uitgelicht: boolean
          sortering: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          aanbieder_id: string
          slug?: string | null
          naam: string
          oppervlakte_m2?: number | null
          oppervlakte_max_m2?: number | null
          slaapkamers?: number | null
          prijs_incl_btw?: number | null
          btw_basis_bron?: "incl" | "ex"
          is_vanaf_prijs?: boolean
          afwerkingsniveau?: "casco" | "instapklaar" | "luxe" | null
          aanbod_type?: "koop" | "huur" | "tweedehands"
          in_prijs_inbegrepen?: string | null
          beschrijving?: string | null
          gelijkvloers?: boolean | null
          energieneutraal_beng?: boolean | null
          afbeeldingen?: string[] | null
          bron_url?: string | null
          prijspeil?: string | null
          laatst_gecontroleerd?: string | null
          actief?: boolean
          uitgelicht?: boolean
          sortering?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          aanbieder_id?: string
          slug?: string | null
          naam?: string
          oppervlakte_m2?: number | null
          oppervlakte_max_m2?: number | null
          slaapkamers?: number | null
          prijs_incl_btw?: number | null
          btw_basis_bron?: "incl" | "ex"
          is_vanaf_prijs?: boolean
          afwerkingsniveau?: "casco" | "instapklaar" | "luxe" | null
          aanbod_type?: "koop" | "huur" | "tweedehands"
          in_prijs_inbegrepen?: string | null
          beschrijving?: string | null
          gelijkvloers?: boolean | null
          energieneutraal_beng?: boolean | null
          afbeeldingen?: string[] | null
          bron_url?: string | null
          prijspeil?: string | null
          laatst_gecontroleerd?: string | null
          actief?: boolean
          uitgelicht?: boolean
          sortering?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "woningen_aanbieder_id_fkey"
            columns: ["aanbieder_id"]
            isOneToOne: false
            referencedRelation: "aanbieders"
            referencedColumns: ["id"]
          },
        ]
      }
      aanbieder_users: {
        Row: {
          user_id: string
          aanbieder_id: string
          email: string | null
          status: "pending" | "approved" | "geweigerd"
          bericht: string | null
          created_at: string
          approved_at: string | null
          approved_by: string | null
        }
        Insert: {
          user_id: string
          aanbieder_id: string
          email?: string | null
          status?: "pending" | "approved" | "geweigerd"
          bericht?: string | null
          created_at?: string
          approved_at?: string | null
          approved_by?: string | null
        }
        Update: {
          user_id?: string
          aanbieder_id?: string
          email?: string | null
          status?: "pending" | "approved" | "geweigerd"
          bericht?: string | null
          created_at?: string
          approved_at?: string | null
          approved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aanbieder_users_aanbieder_id_fkey"
            columns: ["aanbieder_id"]
            isOneToOne: false
            referencedRelation: "aanbieders"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_aanbieder: {
        Row: {
          id: string
          lead_id: string
          aanbieder_id: string
          status: "gedeeld" | "geinteresseerd" | "afgewezen"
          contact_vrijgegeven: boolean
          gedeeld_at: string
          gedeeld_by: string | null
          vrijgegeven_at: string | null
          gereageerd_at: string | null
        }
        Insert: {
          id?: string
          lead_id: string
          aanbieder_id: string
          status?: "gedeeld" | "geinteresseerd" | "afgewezen"
          contact_vrijgegeven?: boolean
          gedeeld_at?: string
          gedeeld_by?: string | null
          vrijgegeven_at?: string | null
          gereageerd_at?: string | null
        }
        Update: {
          id?: string
          lead_id?: string
          aanbieder_id?: string
          status?: "gedeeld" | "geinteresseerd" | "afgewezen"
          contact_vrijgegeven?: boolean
          gedeeld_at?: string
          gedeeld_by?: string | null
          vrijgegeven_at?: string | null
          gereageerd_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_aanbieder_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_aanbieder_aanbieder_id_fkey"
            columns: ["aanbieder_id"]
            isOneToOne: false
            referencedRelation: "aanbieders"
            referencedColumns: ["id"]
          },
        ]
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
      is_aanbieder_user: { Args: never; Returns: boolean }
      current_aanbieder_id: { Args: never; Returns: string | null }
      my_aanbieder_status: { Args: never; Returns: string | null }
      portal_lead_reageer: {
        Args: { p_lead_id: string; p_status: string }
        Returns: undefined
      }
      get_portal_leads: {
        Args: never
        Returns: {
          share_id: string
          lead_id: string
          aanbieder_id: string
          reactie_status: "gedeeld" | "geinteresseerd" | "afgewezen"
          contact_vrijgegeven: boolean
          gedeeld_at: string
          created_at: string
          type: string | null
          audience: string | null
          budget: string | null
          planning: string | null
          startdatum: string | null
          regio_postcode: string | null
          voornaam: string | null
          achternaam: string | null
          naam: string | null
          email: string | null
          telefoon: string | null
          postcode: string | null
          huisnummer: string | null
          toevoeging: string | null
        }[]
      }
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
export type Aanbieder = Tables<"aanbieders">
export type Woning = Tables<"woningen">
export type AanbiederUser = Tables<"aanbieder_users">
export type LeadAanbieder = Tables<"lead_aanbieder">
export type PortalLead =
  Database["public"]["Functions"]["get_portal_leads"]["Returns"][number]
