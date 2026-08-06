// Hand-maintained to match supabase/migrations/*.sql (#91, #119, #130, #149,
// #161). This dev machine has no Docker/standalone Supabase CLI, so `pnpm
// db:types` (which shells out to `supabase gen types typescript --local
// --schema public,reference`) cannot run here — CI must regenerate this
// file against the real local stack and confirm it matches.
//
// #161: reference.ingredients gains fiber_g_per_100g, nutrient_basis,
// category_nl/category_en and loses category (ADR-0013, executed by
// 20260806000001_nevo_nutrition_import.sql). nutrient_basis types as
// `string` here (not a `'per_100g' | 'per_100ml'` literal union) because
// this file has no way to express the migration's `check` constraint the
// way a real `supabase gen types` run would still type it as plain `text`
// too -- Postgres CHECK constraints don't surface as enum types.
//
// #149: recipe_step_ingredients (step<->ingredient join) and the
// replace_recipe_contents RPC, both from
// 20260802000001_recipe_step_ingredients.sql.
//
// #130: `public.recipe_unit` is a Postgres enum (created in the public
// schema, per ADR-0011 §3) reused by both ingredient_unit_masses tables
// below — reference.ingredient_unit_masses.unit and
// public.ingredient_unit_masses.unit both type as
// Database["public"]["Enums"]["recipe_unit"], same as a real generator
// would emit for a cross-schema enum reference.
//
// #119 (recipe schema): recipe_categories, recipes, recipe_ingredients,
// recipe_steps, tags, recipe_tags. recipe_ingredients.unit reuses the same
// Database["public"]["Enums"]["recipe_unit"] rather than a second type — see
// 20260730000002_recipe_schema.sql's file header.
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
      recipe_categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          icon: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          icon: string;
          position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          icon?: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_categories_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      recipes: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          title: string;
          servings: number;
          thumbnail_path: string | null;
          time_minutes: number | null;
          created_at: string;
          updated_at: string;
          position: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          title: string;
          servings?: number;
          thumbnail_path?: string | null;
          time_minutes?: number | null;
          created_at?: string;
          updated_at?: string;
          position: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string;
          title?: string;
          servings?: number;
          thumbnail_path?: string | null;
          time_minutes?: number | null;
          created_at?: string;
          updated_at?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "recipes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipes_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "recipe_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      recipe_ingredients: {
        Row: {
          id: string;
          user_id: string;
          recipe_id: string;
          ingredient_id: string | null;
          name: string;
          quantity: number | null;
          unit: Database["public"]["Enums"]["recipe_unit"];
          position: number;
          group_label: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recipe_id: string;
          ingredient_id?: string | null;
          name: string;
          quantity?: number | null;
          unit: Database["public"]["Enums"]["recipe_unit"];
          position: number;
          group_label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          recipe_id?: string;
          ingredient_id?: string | null;
          name?: string;
          quantity?: number | null;
          unit?: Database["public"]["Enums"]["recipe_unit"];
          position?: number;
          group_label?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_ingredients_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      recipe_steps: {
        Row: {
          id: string;
          user_id: string;
          recipe_id: string;
          position: number;
          instruction: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recipe_id: string;
          position: number;
          instruction: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          recipe_id?: string;
          position?: number;
          instruction?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_steps_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_steps_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
        ];
      };
      recipe_step_ingredients: {
        Row: {
          id: string;
          user_id: string;
          step_id: string;
          recipe_ingredient_id: string;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          step_id: string;
          recipe_ingredient_id: string;
          position: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          step_id?: string;
          recipe_ingredient_id?: string;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_step_ingredients_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_step_ingredients_step_id_fkey";
            columns: ["step_id"];
            isOneToOne: false;
            referencedRelation: "recipe_steps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_step_ingredients_recipe_ingredient_id_fkey";
            columns: ["recipe_ingredient_id"];
            isOneToOne: false;
            referencedRelation: "recipe_ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tags_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      recipe_tags: {
        Row: {
          id: string;
          user_id: string;
          recipe_id: string;
          tag_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recipe_id: string;
          tag_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          recipe_id?: string;
          tag_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recipe_tags_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_tags_recipe_id_fkey";
            columns: ["recipe_id"];
            isOneToOne: false;
            referencedRelation: "recipes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recipe_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    // #149: public.replace_recipe_contents (20260802000001_recipe_step_ingredients.sql)
    // -- this repo's first RPC. `Args` uses `Json` for the two array
    // parameters, matching what a real `supabase gen types` emits for a
    // `jsonb` function argument.
    Functions: {
      replace_recipe_contents: {
        Args: {
          p_recipe_id: string;
          p_ingredients: Json;
          p_steps: Json;
        };
        Returns: undefined;
      };
    };
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
          category_nl: string | null;
          category_en: string | null;
          kcal_per_100g: number | null;
          protein_g_per_100g: number | null;
          carbs_g_per_100g: number | null;
          fat_g_per_100g: number | null;
          fiber_g_per_100g: number | null;
          nutrient_basis: string;
          source: string;
          source_ref: string | null;
          source_version: string;
        };
        Insert: {
          id?: string;
          name_nl: string;
          name_en?: string | null;
          category_nl?: string | null;
          category_en?: string | null;
          kcal_per_100g?: number | null;
          protein_g_per_100g?: number | null;
          carbs_g_per_100g?: number | null;
          fat_g_per_100g?: number | null;
          fiber_g_per_100g?: number | null;
          nutrient_basis: string;
          source: string;
          source_ref?: string | null;
          source_version: string;
        };
        Update: {
          id?: string;
          name_nl?: string;
          name_en?: string | null;
          category_nl?: string | null;
          category_en?: string | null;
          kcal_per_100g?: number | null;
          protein_g_per_100g?: number | null;
          carbs_g_per_100g?: number | null;
          fat_g_per_100g?: number | null;
          fiber_g_per_100g?: number | null;
          nutrient_basis?: string;
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
