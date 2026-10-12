// design: Claude-designed (#425); Figma node-id=4231:16052
import { useTranslations } from "next-intl";
import { Avatar } from "../atoms/Avatar";

/**
 * Molecule/AvatarGroup — overlapping 32px avatars plus a label of first
 * names ("Jesse & Youri", "Jesse, Youri & Anne"). The avatars are
 * decorative; the label is the accessible content. See
 * design/notes/AvatarGroup.md.
 */
export interface AvatarGroupMember {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface AvatarGroupProps {
  members: ReadonlyArray<AvatarGroupMember>;
}

export function AvatarGroup({ members }: AvatarGroupProps) {
  const t = useTranslations("components.avatarGroup");
  const firstNames = members.map((m) => m.name.trim().split(/\s+/)[0] ?? "");
  const last = firstNames[firstNames.length - 1] ?? "";
  const label =
    firstNames.length > 1
      ? `${firstNames.slice(0, -1).join(", ")} ${t("and")} ${last}`
      : last;

  return (
    <div className="inline-flex items-center gap-inline-sm">
      <div className="flex" aria-hidden="true">
        {members.map((m, i) => (
          <Avatar
            key={m.id}
            name={m.name}
            src={m.avatarUrl}
            size="sm"
            // spacing-flag: -16px overlap is an unbound Figma itemSpacing — design/notes/AvatarGroup.md
            className={i > 0 ? "-ml-4" : undefined}
          />
        ))}
      </div>
      <span className="whitespace-nowrap text-base font-semibold text-text-primary">
        {label}
      </span>
    </div>
  );
}
