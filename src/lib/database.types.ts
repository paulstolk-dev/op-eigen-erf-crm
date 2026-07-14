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
      app_settings: {
        Row: { key: string; value: string; updated_at: string }
        Insert: { key: string; value: string; updated_at?: string }
        Update: { key?: string; value?: string; updated_at?: string }
        Relationships: []
      }
      hubspot_sync: {
        Row: {
          lead_id: string
          contact_id: string | null
          deal_id: string | null
          synced_at: string | null
          error: string | null
        }
        Insert: {
          lead_id: string
          contact_id?: string | null
          deal_id?: string | null
          synced_at?: string | null
          error?: string | null
        }
        Update: {
          lead_id?: string
          contact_id?: string | null
          deal_id?: string | null
          synced_at?: string | null
          error?: string | null
        }
        Relationships: []
      }
      hubspot_company_sync: {
        Row: {
          aanbieder_id: string
          company_id: string | null
          synced_at: string | null
          error: string | null
        }
        Insert: {
          aanbieder_id: string
          company_id?: string | null
          synced_at?: string | null
          error?: string | null
        }
        Update: {
          aanbieder_id?: string
          company_id?: string | null
          synced_at?: string | null
          error?: string | null
        }
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
          team_foto_url: string | null
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
          contact_naam: string | null
          contact_email: string | null
          partner_status: string
          partner_benaderd_at: string | null
          partner_pitch_step: number
          partner_pitch_last_at: string | null
          bron: string
          review_status: string
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
          team_foto_url?: string | null
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
          contact_naam?: string | null
          contact_email?: string | null
          partner_status?: string
          partner_benaderd_at?: string | null
          partner_pitch_step?: number
          partner_pitch_last_at?: string | null
          bron?: string
          review_status?: string
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
          team_foto_url?: string | null
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
          contact_naam?: string | null
          contact_email?: string | null
          partner_status?: string
          partner_benaderd_at?: string | null
          partner_pitch_step?: number
          partner_pitch_last_at?: string | null
          bron?: string
          review_status?: string
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
          woningtypes: string[] | null
          afbeeldingen: string[] | null
          bron_url: string | null
          prijspeil: string | null
          laatst_gecontroleerd: string | null
          bron: string
          review_status: string
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
          woningtypes?: string[] | null
          afbeeldingen?: string[] | null
          bron_url?: string | null
          prijspeil?: string | null
          laatst_gecontroleerd?: string | null
          bron?: string
          review_status?: string
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
          woningtypes?: string[] | null
          afbeeldingen?: string[] | null
          bron_url?: string | null
          prijspeil?: string | null
          laatst_gecontroleerd?: string | null
          bron?: string
          review_status?: string
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
      scrape_afbeeldingen: {
        Row: {
          id: string
          aanbieder_id: string | null
          woning_id: string | null
          bron_url: string
          bron_pagina: string | null
          storage_path: string | null
          sha256: string | null
          breedte: number | null
          hoogte: number | null
          bytes: number | null
          gekozen: boolean
          review_status: string
          created_at: string
        }
        Insert: {
          id?: string
          aanbieder_id?: string | null
          woning_id?: string | null
          bron_url: string
          bron_pagina?: string | null
          storage_path?: string | null
          sha256?: string | null
          breedte?: number | null
          hoogte?: number | null
          bytes?: number | null
          gekozen?: boolean
          review_status?: string
          created_at?: string
        }
        Update: {
          aanbieder_id?: string | null
          woning_id?: string | null
          bron_url?: string
          bron_pagina?: string | null
          storage_path?: string | null
          sha256?: string | null
          breedte?: number | null
          hoogte?: number | null
          bytes?: number | null
          gekozen?: boolean
          review_status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrape_afbeeldingen_aanbieder_id_fkey"
            columns: ["aanbieder_id"]
            isOneToOne: false
            referencedRelation: "aanbieders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scrape_afbeeldingen_woning_id_fkey"
            columns: ["woning_id"]
            isOneToOne: false
            referencedRelation: "woningen"
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
          tekening: Json | null
          tekening_path: string | null
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
          tekening?: Json | null
          tekening_path?: string | null
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
      email_sequence_steps: {
        Row: {
          id: string
          sleutel: string
          volgorde: number
          dag_na_start: number
          onderwerp: string
          preview: string | null
          body: string
          cta_primary_label: string | null
          cta_primary_url: string | null
          cta_secondary_label: string | null
          cta_secondary_url: string | null
          actief: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sleutel: string
          volgorde?: number
          dag_na_start?: number
          onderwerp: string
          preview?: string | null
          body: string
          cta_primary_label?: string | null
          cta_primary_url?: string | null
          cta_secondary_label?: string | null
          cta_secondary_url?: string | null
          actief?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sleutel?: string
          volgorde?: number
          dag_na_start?: number
          onderwerp?: string
          preview?: string | null
          body?: string
          cta_primary_label?: string | null
          cta_primary_url?: string | null
          cta_secondary_label?: string | null
          cta_secondary_url?: string | null
          actief?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      artikelen: {
        Row: {
          id: string
          slug: string | null
          titel: string
          seo_titel: string | null
          beschrijving: string | null
          samenvatting: string | null
          categorie: string | null
          body_markdown: string | null
          body_html: string | null
          faq: Json
          gerelateerde_links: Json
          leestijd_minuten: number | null
          publicatiedatum: string | null
          auteur: string
          bron: Json | null
          status: string
          afbeelding_url: string | null
          content_processed: boolean
          ytvideo_url: string | null
          instapost_tekst: string | null
          yt_post_tekst: string | null
          instareel_url: string | null
          gepubliceerd_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug?: string | null
          titel: string
          status?: string
          afbeelding_url?: string | null
          content_processed?: boolean
          ytvideo_url?: string | null
          instapost_tekst?: string | null
          yt_post_tekst?: string | null
          instareel_url?: string | null
        }
        Update: {
          slug?: string | null
          titel?: string
          categorie?: string | null
          status?: string
          afbeelding_url?: string | null
          content_processed?: boolean
          ytvideo_url?: string | null
          instapost_tekst?: string | null
          yt_post_tekst?: string | null
          instareel_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      content_queue: {
        Row: {
          id: string
          slug: string
          props: Json
          caption: Json
          status: string
          video_url: string | null
          review_notes: string | null
          artikel_id: string | null
          broll: Json | null
          broll_urls: Json | null
          broll_status: string
          video_url_landscape: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          props: Json
          caption: Json
          status?: string
          video_url?: string | null
          review_notes?: string | null
          artikel_id?: string | null
          broll?: Json | null
          broll_urls?: Json | null
          broll_status?: string
          video_url_landscape?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          props?: Json
          caption?: Json
          status?: string
          video_url?: string | null
          review_notes?: string | null
          artikel_id?: string | null
          broll?: Json | null
          broll_urls?: Json | null
          broll_status?: string
          video_url_landscape?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_link_clicks: {
        Row: {
          id: string
          lead_id: string
          url: string
          label: string | null
          clicked_at: string
          user_agent: string | null
        }
        Insert: {
          id?: string
          lead_id: string
          url: string
          label?: string | null
          clicked_at?: string
          user_agent?: string | null
        }
        Update: {
          id?: string
          lead_id?: string
          url?: string
          label?: string | null
          clicked_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_link_clicks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequence_sends: {
        Row: {
          id: string
          lead_id: string
          step_id: string
          sent_at: string
          hubspot_logged_at: string | null
        }
        Insert: {
          id?: string
          lead_id: string
          step_id: string
          sent_at?: string
          hubspot_logged_at?: string | null
        }
        Update: {
          id?: string
          lead_id?: string
          step_id?: string
          sent_at?: string
          hubspot_logged_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sequence_sends_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequence_sends_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "email_sequence_steps"
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
          tekening: Json | null
          tekening_path: string | null
          draft_email_subject: string | null
          draft_email_body: string | null
          error: string | null
          enriched_at: string | null
          sent_at: string | null
          viewed_at: string | null
          last_viewed_at: string | null
          view_count: number
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
          tekening?: Json | null
          tekening_path?: string | null
          draft_email_subject?: string | null
          draft_email_body?: string | null
          error?: string | null
          enriched_at?: string | null
          sent_at?: string | null
          viewed_at?: string | null
          last_viewed_at?: string | null
          view_count?: number
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
          tekening?: Json | null
          tekening_path?: string | null
          draft_email_subject?: string | null
          draft_email_body?: string | null
          error?: string | null
          enriched_at?: string | null
          sent_at?: string | null
          viewed_at?: string | null
          last_viewed_at?: string | null
          view_count?: number
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
          report_token: string
          terugbel_verzoek_at: string | null
          terugbel_notitie: string | null
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
          report_token?: string
          terugbel_verzoek_at?: string | null
          terugbel_notitie?: string | null
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
          report_token?: string
          terugbel_verzoek_at?: string | null
          terugbel_notitie?: string | null
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
          erfcheck_conclusie: string | null
          perceel_m2: number | null
          achtererf_m2: number | null
          max_vergunningvrij_m2: number | null
          report_token: string | null
          adres: string | null
          bouwjaar: string | null
          footprint_m2: number | null
          bebouwingsgebied_m2: number | null
          kansen: Json | null
          aandachtspunten: Json | null
          lat: number | null
          lon: number | null
          crm_tekening: Json | null
          crm_tekening_path: string | null
          partner_tekening: Json | null
          partner_tekening_path: string | null
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
export type ScrapeAfbeelding = Tables<"scrape_afbeeldingen">
export type AanbiederUser = Tables<"aanbieder_users">
export type LeadAanbieder = Tables<"lead_aanbieder">
export type EmailSequenceStep = Tables<"email_sequence_steps">
export type LeadLinkClick = Tables<"lead_link_clicks">
export type ContentQueueItem = Tables<"content_queue">
export type Artikel = Tables<"artikelen">
export type PortalLead =
  Database["public"]["Functions"]["get_portal_leads"]["Returns"][number]
