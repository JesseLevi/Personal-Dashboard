// design: Claude-designed on request (#334). Record: design/notes/NoteEditor.md
import { NoteSaveStatus } from "./NoteSaveStatus";
import { NoteWordCount } from "./NoteWordCount";

export const States = () => (
  <div className="flex flex-col items-start gap-stack-md">
    <NoteSaveStatus status="saved" onRetry={() => {}} />
    <NoteSaveStatus status="saving" onRetry={() => {}} />
    <NoteSaveStatus status="error" onRetry={() => {}} />
  </div>
);

export const WordCount = () => (
  <div className="flex flex-col items-start gap-stack-md">
    <NoteWordCount words={0} minutes={0} />
    <NoteWordCount words={1} minutes={1} />
    <NoteWordCount words={312} minutes={2} />
  </div>
);
