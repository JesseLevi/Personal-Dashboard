// design: Claude-designed (#425); size sm from Figma node-id=4231:16053
import { cn } from "@/lib/ui/cn";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * Atom/Avatar — round photo, or a bordered circle with the first letter of
 * the first name when there is no photo.
 *
 * `size` maps to the two sizes in use: `md` is the Sidebar account row
 * (40px), `sm` is the 32px avatar from the Figma group. Always decorative
 * (`alt=""`, fallback `aria-hidden`): the person's name is rendered next to
 * it. See design/notes/Avatar.md.
 */
const avatarVariants = cva("shrink-0 rounded-full object-cover", {
  variants: {
    size: {
      md: "size-10",
      sm: "size-8",
    },
  },
  defaultVariants: { size: "md" },
});

const PX = { md: 40, sm: 32 } as const;

// First letter of the first word, uppercase. Not Figma-sourced.
export function initialFor(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return (Array.from(first)[0] ?? "").toUpperCase();
}

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name: string;
  /** Photo URL; null/undefined renders the letter fallback. */
  src?: string | null;
  className?: string;
}

export function Avatar({ name, src, size, className }: AvatarProps) {
  const px = PX[size ?? "md"];
  if (src) {
    return (
      <img
        src={src}
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
        "flex items-center justify-center border border-stroke-primary bg-surface-secondary-hover text-xs font-semibold text-text-secondary",
        className,
      )}
    >
      {initialFor(name)}
    </span>
  );
}
