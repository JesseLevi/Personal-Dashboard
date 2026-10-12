// design: Claude-designed (#425); size sm from Figma node-id=4231:16053
import { cn } from "@/lib/ui/cn";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * Atom/Avatar — round image with an initials fallback.
 *
 * `size` maps to the two sizes in use: `md` is the Sidebar account row
 * (40px, rounded square), `sm` is the 32px round avatar from the Figma
 * group. Always decorative (`alt=""`, fallback `aria-hidden`): the person's
 * name is rendered next to it. See design/notes/Avatar.md.
 */
const avatarVariants = cva("shrink-0 object-cover", {
  variants: {
    size: {
      md: "size-10 rounded-control-inner",
      sm: "size-8 rounded-full",
    },
  },
  defaultVariants: { size: "md" },
});

const PX = { md: 40, sm: 32 } as const;

// First letter of the first two words, not Figma-sourced.
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name: string;
  /** Public image URL; null/undefined renders the initials fallback. */
  avatarUrl?: string | null;
  className?: string;
}

export function Avatar({ name, avatarUrl, size, className }: AvatarProps) {
  const px = PX[size ?? "md"];
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        width={px}
        height={px}
        loading="lazy"
        className={cn(avatarVariants({ size }), className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        avatarVariants({ size }),
        "flex items-center justify-center bg-surface-secondary-hover text-xs font-semibold text-text-secondary",
        className,
      )}
    >
      {initialsFor(name)}
    </span>
  );
}
