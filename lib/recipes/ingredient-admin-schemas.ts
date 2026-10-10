import { z } from "zod";
import { UNITS } from "@/lib/recipes/units";

// Input validation for the admin ingredient actions (#325, ADR-0020 §2/§4).
// An empty nutrient input means "unknown" and becomes null, never 0 (ADR-0011 §4).

const nutrient = (max: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null) return null;
      if (typeof value === "string") {
        const trimmed = value.trim().replace(",", ".");
        return trimmed === "" ? null : Number(trimmed);
      }
      return value;
    },
    z.number().finite().min(0).max(max).nullable(),
  );

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : (value ?? null)),
  z.string().trim().max(200).nullable(),
);

// A weight per unit only makes sense for non-mass units ("1 stuk = 60 g").
const weighableUnits = UNITS.filter((unit) => unit.magnitude !== "mass").map((unit) => unit.code);
const unitCode = z.enum(weighableUnits as [string, ...string[]]);

const unitMass = z
  .object({
    unit: unitCode,
    grams: z.preprocess(
      (value) => (typeof value === "string" ? Number(value.trim().replace(",", ".")) : value),
      z.number().finite().positive().max(100000),
    ),
  })
  .nullable()
  .optional()
  .transform((value) => value ?? null);

const id = z.uuid();
const aliasName = z.string().trim().min(1).max(200);

export const createAliasSchema = z.object({ name: aliasName, ingredientId: id });
export const updateAliasSchema = z.object({ aliasId: id, name: aliasName, ingredientId: id });
export const deleteAliasSchema = z.object({ aliasId: id });

const eigenFields = {
  nameNl: z.string().trim().min(1).max(200),
  nameEn: optionalText,
  categoryNl: optionalText,
  categoryEn: optionalText,
  kcal: nutrient(1000),
  protein: nutrient(100),
  carbs: nutrient(100),
  fat: nutrient(100),
  fiber: nutrient(100),
  unitMass,
};

export const createEigenIngredientSchema = z.object(eigenFields);
export const updateEigenIngredientSchema = z.object({ ingredientId: id, ...eigenFields });
export const deleteEigenIngredientSchema = z.object({ ingredientId: id });
