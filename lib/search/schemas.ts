import { z } from "zod";
import { NOTES_SEARCH_MIN_QUERY_LENGTH } from "@/lib/notes/search";
import { SEARCH_TYPES } from "@/lib/search/merge";

export const SEARCH_MAX_QUERY_LENGTH = 200;
export const SEARCH_DEFAULT_LIMIT = 20;
export const SEARCH_MAX_LIMIT = 50;

export const searchAllSchema = z.object({
  q: z.string().trim().min(NOTES_SEARCH_MIN_QUERY_LENGTH).max(SEARCH_MAX_QUERY_LENGTH),
  types: z.array(z.enum(SEARCH_TYPES)).min(1).optional(),
});
