import type { Editor } from "@tiptap/react";
import type { IconName } from "@/components/atoms/Icon";
import { openImagePicker } from "./image-upload";

// The one list of block-insert commands (#332). The slash menu
// (components/organisms/SlashMenu.tsx) renders it today; the slim EditingBar
// (#333) reads the same list, and later tickets (image, collapsible section,
// note link) append their own items. Labels live under the i18n namespace
// `components.slashMenu.items.<id>`; `aliases` are extra search terms in
// both languages (the filter also matches the id).
export interface SlashItem {
  id: string;
  icon: IconName;
  aliases: { nl: string[]; en: string[] };
  /** Not offered when this returns false, e.g. a table inside a table cell. */
  isEnabled?: (editor: Editor) => boolean;
  /** Opens the table size picker instead of running a command (#330). */
  opensTablePicker?: boolean;
  run?: (editor: Editor) => void;
}

export const SLASH_ITEMS: SlashItem[] = [
  {
    id: "paragraph",
    icon: "TextAlignStart",
    aliases: { nl: ["tekst", "alinea", "paragraaf"], en: ["text", "paragraph", "plain"] },
    run: (editor) => editor.chain().focus().setParagraph().run(),
  },
  ...([1, 2, 3] as const).map(
    (level): SlashItem => ({
      id: `heading${level}`,
      icon: "Heading",
      aliases: {
        nl: ["kop", `kop${level}`, "titel", `h${level}`],
        en: ["heading", `heading${level}`, "title", `h${level}`],
      },
      run: (editor) => editor.chain().focus().setHeading({ level }).run(),
    }),
  ),
  {
    id: "bulletList",
    icon: "List",
    aliases: { nl: ["lijst", "opsomming", "bullets", "lijstje"], en: ["list", "bullet", "bullets", "unordered", "ul"] },
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: "orderedList",
    icon: "List",
    aliases: { nl: ["lijst", "genummerd", "nummering", "nummers"], en: ["list", "ordered", "numbered", "numbers", "ol"] },
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "taskList",
    icon: "List",
    aliases: { nl: ["checklist", "todo", "taak", "taken", "afvinken"], en: ["checklist", "todo", "task", "tasks", "checkbox"] },
    run: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    id: "blockquote",
    icon: "TextQuote",
    aliases: { nl: ["citaat", "quote"], en: ["quote", "blockquote", "citation"] },
    run: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "codeBlock",
    icon: "SquareCode",
    aliases: { nl: ["code", "codeblok"], en: ["code", "codeblock", "snippet"] },
    run: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: "table",
    icon: "Table",
    aliases: { nl: ["tabel", "rijen", "kolommen"], en: ["table", "grid", "rows", "columns"] },
    isEnabled: (editor) => !editor.isActive("table"),
    opensTablePicker: true,
  },
  {
    id: "divider",
    icon: "Minus",
    aliases: { nl: ["scheidingslijn", "lijn", "streep", "hr"], en: ["divider", "line", "rule", "separator", "hr"] },
    run: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  // #336
  {
    id: "details",
    icon: "ChevronDown",
    aliases: {
      nl: ["inklapbaar", "sectie", "uitklappen", "verbergen", "details"],
      en: ["collapsible", "section", "toggle", "accordion", "details", "spoiler"],
    },
    isEnabled: (editor) => !editor.isActive("details"),
    run: (editor) => editor.chain().focus().setDetails().run(),
  },
  // #339: opens the system file picker; the upload is lib/notes/image-upload.ts.
  {
    id: "image",
    icon: "Image",
    aliases: { nl: ["afbeelding", "foto", "plaatje", "beeld"], en: ["image", "picture", "photo", "upload"] },
    run: (editor) => openImagePicker(editor),
  },
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function searchTerms(item: SlashItem, labels: string[]): string[] {
  return [item.id, ...item.aliases.nl, ...item.aliases.en, ...labels].map(normalize);
}

/**
 * Items whose id, label or alias (nl or en) contains the query, ignoring
 * case, accents, spaces and punctuation. Items with a term that STARTS with
 * the query come first; an empty query returns everything in list order.
 */
export function filterSlashItems(
  items: SlashItem[],
  query: string,
  labelsFor: (item: SlashItem) => string[] = () => [],
): SlashItem[] {
  const needle = normalize(query);
  if (!needle) return items;
  const starts: SlashItem[] = [];
  const contains: SlashItem[] = [];
  for (const item of items) {
    const terms = searchTerms(item, labelsFor(item));
    if (terms.some((term) => term.startsWith(needle))) starts.push(item);
    else if (terms.some((term) => term.includes(needle))) contains.push(item);
  }
  return [...starts, ...contains];
}
