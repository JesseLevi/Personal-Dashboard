// Hand-maintained to match supabase/migrations/*.sql (#91, #130). This dev
// machine has no Docker/standalone Supabase CLI, so `pnpm db:types` (which
// shells out to `supabase gen types typescript --local --schema public,reference`)
// cannot run here — CI must regenerate this file against the real local
// stack and confirm it matches.
//
// #130: `public.recipe_unit` is a Postgres enum (created in the public
// schema, per ADR-0011 §3) reused by both ingredient_unit_masses tables
// below — reference.ingredient_unit_masses.unit and
// public.ingredient_unit_masses.unit both type as
// Database["public"]["Enums"]["recipe_unit"], same as a real generator
// would emit for a cross-schema enum reference.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          locale: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          locale?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          locale?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      boards: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          position: number;
          is_favorite: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          position: number;
          is_favorite?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          position?: number;
          is_favorite?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "boards_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      board_columns: {
        Row: {
          id: string;
          user_id: string;
          board_id: string;
          name: string;
          icon: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          board_id: string;
          name: string;
          icon: string;
          position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          board_id?: string;
          name?: string;
          icon?: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "board_columns_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "board_columns_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
        ];
      };
      cards: {
        Row: {
          id: string;
          user_id: string;
          column_id: string;
          title: string;
          description: string | null;
          priority: string;
          size: string | null;
          due_at: string | null;
          position: number;
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          column_id: string;
          title: string;
          description?: string | null;
          priority?: string;
          size?: string | null;
          due_at?: string | null;
          position: number;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          column_id?: string;
          title?: string;
          description?: string | null;
          priority?: string;
          size?: string | null;
          due_at?: string | null;
          position?: number;
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cards_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cards_column_id_fkey";
            columns: ["column_id"];
            isOneToOne: false;
            referencedRelation: "board_columns";
            referencedColumns: ["id"];
          },
        ];
      };
      labels: {
        Row: {
          id: string;
          user_id: string;
          board_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          board_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          board_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "labels_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "labels_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "boards";
            referencedColumns: ["id"];
          },
        ];
      };
      card_labels: {
        Row: {
          id: string;
          user_id: string;
          card_id: string;
          label_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          card_id: string;
          label_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          card_id?: string;
          label_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "card_labels_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "card_labels_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "card_labels_label_id_fkey";
            columns: ["label_id"];
            isOneToOne: false;
            referencedRelation: "labels";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredients: {
        Row: {
          id: string;
          user_id: string;
          reference_id: string | null;
          name: string;
          category: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          reference_id?: string | null;
          name: string;
          category?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          reference_id?: string | null;
          name?: string;
          category?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredients_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ingredients_reference_id_fkey";
            columns: ["reference_id"];
            isOneToOne: false;
            referencedRelation: "reference.ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredient_unit_masses: {
        Row: {
          id: string;
          user_id: string;
          ingredient_id: string;
          unit: Database["public"]["Enums"]["recipe_unit"];
          grams: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          ingredient_id: string;
          unit: Database["public"]["Enums"]["recipe_unit"];
          grams: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          ingredient_id?: string;
          unit?: Database["public"]["Enums"]["recipe_unit"];
          grams?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredient_unit_masses_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ingredient_unit_masses_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
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
        | "naar_smaak";
    };
    CompositeTypes: Record<string, never>;
  };
  reference: {
    Tables: {
      ingredients: {
        Row: {
          id: string;
          name_nl: string;
          name_en: string | null;
          category: string | null;
          kcal_per_100g: number | null;
          protein_g_per_100g: number | null;
          carbs_g_per_100g: number | null;
          fat_g_per_100g: number | null;
          source: string;
          source_ref: string | null;
          source_version: string;
        };
        Insert: {
          id?: string;
          name_nl: string;
          name_en?: string | null;
          category?: string | null;
          kcal_per_100g?: number | null;
          protein_g_per_100g?: number | null;
          carbs_g_per_100g?: number | null;
          fat_g_per_100g?: number | null;
          source: string;
          source_ref?: string | null;
          source_version: string;
        };
        Update: {
          id?: string;
          name_nl?: string;
          name_en?: string | null;
          category?: string | null;
          kcal_per_100g?: number | null;
          protein_g_per_100g?: number | null;
          carbs_g_per_100g?: number | null;
          fat_g_per_100g?: number | null;
          source?: string;
          source_ref?: string | null;
          source_version?: string;
        };
        Relationships: [];
      };
      ingredient_unit_masses: {
        Row: {
          id: string;
          ingredient_id: string;
          unit: Database["public"]["Enums"]["recipe_unit"];
          grams: number;
          source: string;
          source_version: string;
        };
        Insert: {
          id?: string;
          ingredient_id: string;
          unit: Database["public"]["Enums"]["recipe_unit"];
          grams: number;
          source: string;
          source_version: string;
        };
        Update: {
          id?: string;
          ingredient_id?: string;
          unit?: Database["public"]["Enums"]["recipe_unit"];
          grams?: number;
          source?: string;
          source_version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredient_unit_masses_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
