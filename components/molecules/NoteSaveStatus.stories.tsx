// design: Claude-designed on request (#334). Record: design/notes/NoteEditor.md
import { NoteSaveStatus } from "./NoteSaveStatus";
import { NoteWordCount } from "./NoteWordCount";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Notities / Rondom / Note save status" } satisfies StoryDefault;

export const States = () => (
  <div className="flex flex-col items-start gap-stack-md">
    <NoteSaveStatus status="saved" onRetry={() => {}} onReload={() => {}} />
    <NoteSaveStatus status="saving" onRetry={() => {}} onReload={() => {}} />
    <NoteSaveStatus status="error" onRetry={() => {}} onReload={() => {}} />
    <NoteSaveStatus status="conflict" onRetry={() => {}} onReload={() => {}} />
  </div>
);

export const WordCount = () => (
  <div className="flex flex-col items-start gap-stack-md">
    <NoteWordCount words={0} minutes={0} />
    <NoteWordCount words={1} minutes={1} />
    <NoteWordCount words={312} minutes={2} />
  </div>
);

export const Overview = () => (
  <div className="flex flex-col gap-stack-lg">
    <StoryIntro what="Small status under a note: saved, saving, failed with retry, or changed elsewhere with reload, plus the word count and reading time." note="NoteEditor" />
    <Specimens>
      <Specimen label="Save status" hint="Saved, saving, error, conflict">
        <States />
      </Specimen>
      <Specimen label="Word count" hint="Empty, one word, longer">
        <WordCount />
      </Specimen>
    </Specimens>
  </div>
);
