import { z } from "zod";

// Resource types that can be shared (ADR-0035). A new type adds an entry
// here and a column in SHARE_COLUMN (lib/sharing/actions.ts).
export const resourceTypeSchema = z.enum(["shopping_list"]);
export type ResourceType = z.infer<typeof resourceTypeSchema>;

export const resourceRefSchema = z.object({
  resource: resourceTypeSchema,
  id: z.uuid(),
});
export type ResourceRef = z.infer<typeof resourceRefSchema>;

export const inviteMemberSchema = resourceRefSchema.extend({ memberId: z.uuid() });
export const revokeShareSchema = resourceRefSchema.extend({ memberId: z.uuid() });

// Same bounds as public.search_members (2 to 64 characters after trimming).
export const searchMembersSchema = z.object({
  query: z.string().trim().min(2).max(64),
});

export const memberProfilesSchema = z.object({
  ids: z.array(z.uuid()).max(100),
});
