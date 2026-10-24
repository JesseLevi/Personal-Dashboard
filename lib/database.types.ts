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
      activity_events: {
        Row: {
          id: string
          item_key: string | null
          item_name: string | null
          kind: string
          meal_plan_id: string | null
          occurred_at: string
          quantity: number | null
          recipe_id: string | null
          shopping_list_id: string | null
          shopping_list_item_id: string | null
          unit: Database["public"]["Enums"]["recipe_unit"] | null
          user_id: string
        }
        Insert: {
          id?: string
          item_key?: string | null
          item_name?: string | null
          kind: string
          meal_plan_id?: string | null
          occurred_at?: string
          quantity?: number | null
          recipe_id?: string | null
          shopping_list_id?: string | null
          shopping_list_item_id?: string | null
          unit?: Database["public"]["Enums"]["recipe_unit"] | null
          user_id: string
        }
        Update: {
          id?: string
          item_key?: string | null
          item_name?: string | null
          kind?: string
          meal_plan_id?: string | null
          occurred_at?: string
          quantity?: number | null
          recipe_id?: string | null
          shopping_list_id?: string | null
          shopping_list_item_id?: string | null
          unit?: Database["public"]["Enums"]["recipe_unit"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_shopping_list_id_fkey"
            columns: ["shopping_list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_shopping_list_item_id_fkey"
            columns: ["shopping_list_item_id"]
            isOneToOne: false
            referencedRelation: "shopping_list_items"
            referencedColumns: ["id"]
          },
        ]
      }
      board_columns: {
        Row: {
          board_id: string
          created_at: string
          icon: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          icon: string
          id?: string
          name: string
          position: number
          updated_at?: string
          user_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          icon?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          created_at: string
          id: string
          is_favorite: boolean
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_favorite?: boolean
          name: string
          position: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_favorite?: boolean
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_accounts: {
        Row: {
          created_at: string
          display_name: string
          id: string
          last_synced_at: string | null
          provider: string
          sync_state: Json
          updated_at: string
          user_id: string
          vault_secret_id: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          last_synced_at?: string | null
          provider: string
          sync_state?: Json
          updated_at?: string
          user_id: string
          vault_secret_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          last_synced_at?: string | null
          provider?: string
          sync_state?: Json
          updated_at?: string
          user_id?: string
          vault_secret_id?: string | null
        }
        Relationships: []
      }
      calendar_event_links: {
        Row: {
          calendar_event_id: string
          card_id: string | null
          created_at: string
          id: string
          note_id: string | null
          recipe_id: string | null
          user_id: string
        }
        Insert: {
          calendar_event_id: string
          card_id?: string | null
          created_at?: string
          id?: string
          note_id?: string | null
          recipe_id?: string | null
          user_id: string
        }
        Update: {
          calendar_event_id?: string
          card_id?: string | null
          created_at?: string
          id?: string
          note_id?: string | null
          recipe_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_links_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_links_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_links_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_links_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_series: {
        Row: {
          all_day: boolean
          calendar_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          excluded_on: string[]
          freq: string
          id: string
          interval: number
          location: string | null
          materialized_until: string | null
          start_time: string | null
          starts_on: string
          time_zone: string
          title: string
          until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          calendar_id: string
          created_at?: string
          description?: string | null
          duration_minutes: number
          excluded_on?: string[]
          freq: string
          id?: string
          interval?: number
          location?: string | null
          materialized_until?: string | null
          start_time?: string | null
          starts_on: string
          time_zone?: string
          title: string
          until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          calendar_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          excluded_on?: string[]
          freq?: string
          id?: string
          interval?: number
          location?: string | null
          materialized_until?: string | null
          start_time?: string | null
          starts_on?: string
          time_zone?: string
          title?: string
          until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_series_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          calendar_account_id: string | null
          calendar_id: string
          content_hash: string | null
          created_at: string
          description: string | null
          ends_at: string
          external_id: string | null
          id: string
          location: string | null
          missing_since: string | null
          occurrence_on: string | null
          series_detached: boolean
          series_id: string | null
          source: string
          starts_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          calendar_account_id?: string | null
          calendar_id: string
          content_hash?: string | null
          created_at?: string
          description?: string | null
          ends_at: string
          external_id?: string | null
          id?: string
          location?: string | null
          missing_since?: string | null
          occurrence_on?: string | null
          series_detached?: boolean
          series_id?: string | null
          source?: string
          starts_at: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          calendar_account_id?: string | null
          calendar_id?: string
          content_hash?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string
          external_id?: string | null
          id?: string
          location?: string | null
          missing_since?: string | null
          occurrence_on?: string | null
          series_detached?: boolean
          series_id?: string | null
          source?: string
          starts_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_calendar_account_id_fkey"
            columns: ["calendar_account_id"]
            isOneToOne: false
            referencedRelation: "calendar_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "calendar_event_series"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_sync_notices: {
        Row: {
          calendar_account_id: string
          created_at: string
          event_title: string
          id: string
          item_ids: string[]
          user_id: string
        }
        Insert: {
          calendar_account_id: string
          created_at?: string
          event_title: string
          id?: string
          item_ids: string[]
          user_id: string
        }
        Update: {
          calendar_account_id?: string
          created_at?: string
          event_title?: string
          id?: string
          item_ids?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_sync_notices_calendar_account_id_fkey"
            columns: ["calendar_account_id"]
            isOneToOne: false
            referencedRelation: "calendar_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      calendars: {
        Row: {
          calendar_account_id: string | null
          color: string
          created_at: string
          id: string
          is_default: boolean
          kind: string
          name: string | null
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_account_id?: string | null
          color: string
          created_at?: string
          id?: string
          is_default?: boolean
          kind?: string
          name?: string | null
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_account_id?: string | null
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          kind?: string
          name?: string | null
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendars_calendar_account_id_fkey"
            columns: ["calendar_account_id"]
            isOneToOne: false
            referencedRelation: "calendar_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      card_labels: {
        Row: {
          card_id: string
          created_at: string
          id: string
          label_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          label_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          label_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_labels_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_labels_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "labels"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          column_id: string
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          planned_for: string | null
          position: number
          priority: string
          size: string | null
          source: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          column_id: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          planned_for?: string | null
          position: number
          priority?: string
          size?: string | null
          source?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          column_id?: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          planned_for?: string | null
          position?: number
          priority?: string
          size?: string | null
          source?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "board_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      embeddings: {
        Row: {
          calendar_event_id: string | null
          card_id: string | null
          chunk_index: number
          content_hash: string
          content_text: string
          created_at: string
          embedding: unknown
          id: string
          model: string
          note_id: string | null
          recipe_id: string | null
          shopping_list_item_id: string | null
          source_updated_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_event_id?: string | null
          card_id?: string | null
          chunk_index?: number
          content_hash: string
          content_text: string
          created_at?: string
          embedding: unknown
          id?: string
          model: string
          note_id?: string | null
          recipe_id?: string | null
          shopping_list_item_id?: string | null
          source_updated_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_event_id?: string | null
          card_id?: string | null
          chunk_index?: number
          content_hash?: string
          content_text?: string
          created_at?: string
          embedding?: unknown
          id?: string
          model?: string
          note_id?: string | null
          recipe_id?: string | null
          shopping_list_item_id?: string | null
          source_updated_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embeddings_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embeddings_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embeddings_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embeddings_shopping_list_item_id_fkey"
            columns: ["shopping_list_item_id"]
            isOneToOne: false
            referencedRelation: "shopping_list_items"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_aliases: {
        Row: {
          alias_normalized: string
          created_at: string
          id: string
          ingredient_id: string
          user_id: string
        }
        Insert: {
          alias_normalized: string
          created_at?: string
          id?: string
          ingredient_id: string
          user_id: string
        }
        Update: {
          alias_normalized?: string
          created_at?: string
          id?: string
          ingredient_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_aliases_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_unit_masses: {
        Row: {
          created_at: string
          grams: number
          id: string
          ingredient_id: string
          unit: Database["public"]["Enums"]["recipe_unit"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          grams: number
          id?: string
          ingredient_id: string
          unit: Database["public"]["Enums"]["recipe_unit"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          grams?: number
          id?: string
          ingredient_id?: string
          unit?: Database["public"]["Enums"]["recipe_unit"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_unit_masses_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          reference_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          reference_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          reference_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      labels: {
        Row: {
          board_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "labels_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          calendar_event_id: string | null
          calendar_id: string
          created_at: string
          id: string
          planned_on: string | null
          position: number
          recipe_id: string
          servings: number
          slot: string
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_event_id?: string | null
          calendar_id: string
          created_at?: string
          id?: string
          planned_on?: string | null
          position?: number
          recipe_id: string
          servings: number
          slot: string
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_event_id?: string | null
          calendar_id?: string
          created_at?: string
          id?: string
          planned_on?: string | null
          position?: number
          recipe_id?: string
          servings?: number
          slot?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_calendar_event_id_fkey"
            columns: ["calendar_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plans_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_categories: {
        Row: {
          created_at: string
          icon: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon: string
          id?: string
          name: string
          position: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      note_links: {
        Row: {
          source_note_id: string
          target_note_id: string
          user_id: string
        }
        Insert: {
          source_note_id: string
          target_note_id: string
          user_id: string
        }
        Update: {
          source_note_id?: string
          target_note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_links_source_note_id_fkey"
            columns: ["source_note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_links_target_note_id_fkey"
            columns: ["target_note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          category_id: string
          content: Json
          content_text: string
          created_at: string
          id: string
          position: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          content?: Json
          content_text?: string
          created_at?: string
          id?: string
          position: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          content?: Json
          content_text?: string
          created_at?: string
          id?: string
          position?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "note_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_enabled: boolean
          ai_enabled_at: string | null
          avatar_path: string | null
          created_at: string
          display_name: string | null
          id: string
          last_name: string | null
          locale: string
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          ai_enabled_at?: string | null
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          last_name?: string | null
          locale?: string
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          ai_enabled_at?: string | null
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_name?: string | null
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      recipe_categories: {
        Row: {
          created_at: string
          icon: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon: string
          id?: string
          name: string
          position: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          created_at: string
          group_label: string | null
          id: string
          ingredient_id: string | null
          name: string
          needs_review: boolean
          position: number
          quantity: number | null
          recipe_id: string
          unit: Database["public"]["Enums"]["recipe_unit"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_label?: string | null
          id?: string
          ingredient_id?: string | null
          name: string
          needs_review?: boolean
          position: number
          quantity?: number | null
          recipe_id: string
          unit: Database["public"]["Enums"]["recipe_unit"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_label?: string | null
          id?: string
          ingredient_id?: string | null
          name?: string
          needs_review?: boolean
          position?: number
          quantity?: number | null
          recipe_id?: string
          unit?: Database["public"]["Enums"]["recipe_unit"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_step_ingredients: {
        Row: {
          created_at: string
          id: string
          position: number
          recipe_ingredient_id: string
          step_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position: number
          recipe_ingredient_id: string
          step_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          recipe_ingredient_id?: string
          step_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_step_ingredients_recipe_ingredient_id_fkey"
            columns: ["recipe_ingredient_id"]
            isOneToOne: false
            referencedRelation: "recipe_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_step_ingredients_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "recipe_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_steps: {
        Row: {
          created_at: string
          id: string
          instruction: string
          position: number
          recipe_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instruction: string
          position: number
          recipe_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instruction?: string
          position?: number
          recipe_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_steps_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_tags: {
        Row: {
          created_at: string
          id: string
          recipe_id: string
          tag_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipe_id: string
          tag_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recipe_id?: string
          tag_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_tags_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          category_id: string
          created_at: string
          id: string
          import_error: string | null
          import_status: Database["public"]["Enums"]["recipe_import_status"]
          position: number
          servings: number
          source_url: string | null
          thumbnail_path: string | null
          time_minutes: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          import_error?: string | null
          import_status?: Database["public"]["Enums"]["recipe_import_status"]
          position: number
          servings?: number
          source_url?: string | null
          thumbnail_path?: string | null
          time_minutes?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          import_error?: string | null
          import_status?: Database["public"]["Enums"]["recipe_import_status"]
          position?: number
          servings?: number
          source_url?: string | null
          thumbnail_path?: string | null
          time_minutes?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "recipe_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      shares: {
        Row: {
          created_at: string
          id: string
          member_id: string
          recipe_id: string | null
          responded_at: string | null
          role: string
          shopping_list_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          recipe_id?: string | null
          responded_at?: string | null
          role?: string
          shopping_list_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          recipe_id?: string | null
          responded_at?: string | null
          role?: string
          shopping_list_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shares_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shares_shopping_list_id_fkey"
            columns: ["shopping_list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_list_items: {
        Row: {
          checked: boolean
          created_at: string
          id: string
          list_id: string
          meal_plan_id: string | null
          name: string
          position: number
          quantity: number | null
          recipe_id: string | null
          reference_ingredient_id: string | null
          section: string | null
          unit: Database["public"]["Enums"]["recipe_unit"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          checked?: boolean
          created_at?: string
          id?: string
          list_id: string
          meal_plan_id?: string | null
          name: string
          position: number
          quantity?: number | null
          recipe_id?: string | null
          reference_ingredient_id?: string | null
          section?: string | null
          unit?: Database["public"]["Enums"]["recipe_unit"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          checked?: boolean
          created_at?: string
          id?: string
          list_id?: string
          meal_plan_id?: string | null
          name?: string
          position?: number
          quantity?: number | null
          recipe_id?: string | null
          reference_ingredient_id?: string | null
          section?: string | null
          unit?: Database["public"]["Enums"]["recipe_unit"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string | null
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string | null
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string | null
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_seeds: {
        Row: {
          seed_key: string
          seeded_at: string
          user_id: string
        }
        Insert: {
          seed_key: string
          seeded_at?: string
          user_id: string
        }
        Update: {
          seed_key?: string
          seeded_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_recipe_share: {
        Args: { p_share_id: string }
        Returns: {
          recipe_id: string
          source_thumbnail_path: string
        }[]
      }
      agenda_items: {
        Args: { p_from: string; p_time_zone?: string; p_to: string }
        Returns: {
          all_day: boolean
          board_name: string
          calendar_id: string
          column_name: string
          ends_at: string
          id: string
          kind: string
          link_count: number
          missing_since: string
          planned_on: string
          series_id: string
          servings: number
          slot: string
          source: string
          starts_at: string
          thumbnail_path: string
          title: string
        }[]
      }
      apply_calendar_sync: {
        Args: {
          p_account_id: string
          p_events: Json
          p_failure?: string
          p_window_from: string
          p_window_to: string
        }
        Returns: Json
      }
      apply_seed: {
        Args: { p_key: string; p_user_id: string }
        Returns: boolean
      }
      avatar_path_for: { Args: { p_user_id: string }; Returns: string }
      claim_embedding_drain: { Args: never; Returns: boolean }
      create_event_series: {
        Args: {
          p_all_day: boolean
          p_calendar_id: string
          p_description?: string
          p_ends_at: string
          p_event_id?: string
          p_freq: string
          p_interval: number
          p_location?: string
          p_starts_at: string
          p_time_zone?: string
          p_title: string
          p_until?: string
        }
        Returns: string
      }
      create_ics_calendar: {
        Args: { p_name: string; p_url: string }
        Returns: string
      }
      delete_calendar_moving_contents: {
        Args: { p_calendar_id: string }
        Returns: undefined
      }
      delete_event_series: {
        Args: { p_event_id: string; p_scope: string }
        Returns: undefined
      }
      embedding_backlog: {
        Args: { p_limit: number; p_model: string }
        Returns: {
          source_id: string
          source_type: string
          updated_at: string
        }[]
      }
      embedding_backlog_for: {
        Args: { p_limit: number; p_model: string; p_user: string }
        Returns: {
          source_id: string
          source_type: string
          updated_at: string
        }[]
      }
      ensure_user_defaults: { Args: never; Returns: undefined }
      extend_event_series: { Args: never; Returns: number }
      get_calendar_account_secret: {
        Args: { p_account_id: string }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      login_greeting_name: {
        Args: { p_client_key: string; p_email: string }
        Returns: string
      }
      login_rate_limit: {
        Args: { p_action: string; p_client_key: string; p_email: string }
        Returns: boolean
      }
      match_ingredient_candidates: {
        Args: { p_limit?: number; p_names: string[] }
        Returns: {
          id: string
          input_index: number
          name: string
          score: number
          source: string
        }[]
      }
      member_profiles: {
        Args: { p_ids: string[] }
        Returns: {
          display_name: string
          has_avatar: boolean
          id: string
          last_name: string
          updated_at: string
        }[]
      }
      move_card: {
        Args: { p_card_id: string; p_column_id: string; p_target_index: number }
        Returns: number
      }
      move_event_calendar: {
        Args: { p_calendar_id: string; p_event_id: string; p_scope?: string }
        Returns: undefined
      }
      move_note: {
        Args: {
          p_category_id: string
          p_note_id: string
          p_target_index: number
        }
        Returns: number
      }
      move_recipe: {
        Args: {
          p_category_id: string
          p_recipe_id: string
          p_target_index: number
        }
        Returns: number
      }
      pending_recipe_shares: {
        Args: never
        Returns: {
          invited_at: string
          inviter_display_name: string
          inviter_id: string
          recipe_id: string
          share_id: string
          thumbnail_path: string
          time_minutes: number
          title: string
        }[]
      }
      pending_share_invites: {
        Args: never
        Returns: {
          invited_at: string
          inviter_display_name: string
          inviter_has_avatar: boolean
          inviter_id: string
          inviter_last_name: string
          inviter_updated_at: string
          resource_id: string
          resource_name: string
          resource_type: string
          share_id: string
        }[]
      }
      replace_recipe_contents: {
        Args: { p_ingredients: Json; p_recipe_id: string; p_steps: Json }
        Returns: undefined
      }
      save_note_content: {
        Args: {
          p_content: Json
          p_content_text: string
          p_note_id: string
          p_target_ids: string[]
          p_title: string
        }
        Returns: undefined
      }
      search_members: {
        Args: { p_query: string }
        Returns: {
          display_name: string
          email: string
          has_avatar: boolean
          id: string
          last_name: string
          updated_at: string
        }[]
      }
      search_semantic: {
        Args: { p_match_count: number; p_query: unknown; p_types: string[] }
        Returns: {
          score: number
          source_id: string
          source_type: string
        }[]
      }
      search_text: {
        Args: { p_match_count: number; p_query: string; p_types: string[] }
        Returns: {
          score: number
          source_id: string
          source_type: string
        }[]
      }
      seed_board_for: { Args: { p_user_id: string }; Returns: undefined }
      seed_calendars_for: { Args: { p_user_id: string }; Returns: undefined }
      seed_keys: { Args: never; Returns: string[] }
      seed_note_categories_for: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      seed_recipe_categories_for: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      seed_shopping_lists_for: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      set_ai_enabled: { Args: { p_enabled: boolean }; Returns: undefined }
      settle_cooked_meals: { Args: never; Returns: number }
      settle_cooked_meals_for: { Args: { p_user: string }; Returns: number }
      toggle_board_favorite: { Args: { p_board_id: string }; Returns: boolean }
      update_event_series: {
        Args: {
          p_all_day: boolean
          p_description?: string
          p_ends_at: string
          p_event_id: string
          p_freq?: string
          p_interval?: number
          p_location?: string
          p_scope: string
          p_starts_at: string
          p_title: string
          p_until?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      recipe_import_status: "importing" | "done" | "failed"
      recipe_unit:
        | "gram"
        | "kilogram"
        | "ounce"
        | "pound"
        | "milliliter"
        | "deciliter"
        | "liter"
        | "theelepel"
        | "eetlepel"
        | "cup"
        | "teaspoon"
        | "tablespoon"
        | "fluid_ounce"
        | "stuk"
        | "snufje"
        | "scoop"
        | "naar_smaak"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  reference: {
    Tables: {
      ingredient_aliases: {
        Row: {
          alias_normalized: string
          created_at: string
          id: string
          ingredient_id: string
          updated_at: string
        }
        Insert: {
          alias_normalized: string
          created_at?: string
          id?: string
          ingredient_id: string
          updated_at?: string
        }
        Update: {
          alias_normalized?: string
          created_at?: string
          id?: string
          ingredient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_aliases_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_unit_masses: {
        Row: {
          grams: number
          id: string
          ingredient_id: string
          source: string
          source_version: string
          unit: Database["public"]["Enums"]["recipe_unit"]
        }
        Insert: {
          grams: number
          id?: string
          ingredient_id: string
          source: string
          source_version: string
          unit: Database["public"]["Enums"]["recipe_unit"]
        }
        Update: {
          grams?: number
          id?: string
          ingredient_id?: string
          source?: string
          source_version?: string
          unit?: Database["public"]["Enums"]["recipe_unit"]
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_unit_masses_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          carbs_g_per_100g: number | null
          category_en: string | null
          category_nl: string | null
          fat_g_per_100g: number | null
          fiber_g_per_100g: number | null
          id: string
          kcal_per_100g: number | null
          name_en: string | null
          name_nl: string
          nutrient_basis: string
          protein_g_per_100g: number | null
          source: string
          source_ref: string | null
          source_version: string
        }
        Insert: {
          carbs_g_per_100g?: number | null
          category_en?: string | null
          category_nl?: string | null
          fat_g_per_100g?: number | null
          fiber_g_per_100g?: number | null
          id?: string
          kcal_per_100g?: number | null
          name_en?: string | null
          name_nl: string
          nutrient_basis: string
          protein_g_per_100g?: number | null
          source: string
          source_ref?: string | null
          source_version: string
        }
        Update: {
          carbs_g_per_100g?: number | null
          category_en?: string | null
          category_nl?: string | null
          fat_g_per_100g?: number | null
          fiber_g_per_100g?: number | null
          id?: string
          kcal_per_100g?: number | null
          name_en?: string | null
          name_nl?: string
          nutrient_basis?: string
          protein_g_per_100g?: number | null
          source?: string
          source_ref?: string | null
          source_version?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
      recipe_import_status: ["importing", "done", "failed"],
      recipe_unit: [
        "gram",
        "kilogram",
        "ounce",
        "pound",
        "milliliter",
        "deciliter",
        "liter",
        "theelepel",
        "eetlepel",
        "cup",
        "teaspoon",
        "tablespoon",
        "fluid_ounce",
        "stuk",
        "snufje",
        "scoop",
        "naar_smaak",
      ],
    },
  },
  reference: {
    Enums: {},
  },
} as const

