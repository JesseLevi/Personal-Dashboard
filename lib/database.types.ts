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
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          locale: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          locale?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
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
          position: number
          servings: number
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
          position: number
          servings?: number
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
          position?: number
          servings?: number
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
      shopping_list_items: {
        Row: {
          checked: boolean
          created_at: string
          id: string
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
            foreignKeyName: "shopping_list_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      move_card: {
        Args: { p_card_id: string; p_column_id: string; p_target_index: number }
        Returns: number
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
      replace_recipe_contents: {
        Args: { p_ingredients: Json; p_recipe_id: string; p_steps: Json }
        Returns: undefined
      }
      toggle_board_favorite: { Args: { p_board_id: string }; Returns: boolean }
    }
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
        | "naar_smaak"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  reference: {
    Tables: {
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

