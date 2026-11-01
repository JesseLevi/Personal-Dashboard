import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import { Tag } from "@/components/atoms/Tag";
import { Card } from "@/components/molecules/Card";
import { CardContentTicket } from "@/components/molecules/CardContentTicket";
import { SubtaskProgressTag } from "./SubtaskProgressTag";
import type { StoryDefault } from "@ladle/react";

export default { title: "Te doen / Subtask progress tag" } satisfies StoryDefault;

// The due date is a static stand-in for useFormatter().dateTime(...) in TeDoenBoard.
export const Overview = () => (
  <>
    <StoryIntro what="The progress chip on a board card with subtasks: done over total, after the other chips." note="TeDoenBoard" />
    <Specimens>
      <Specimen label="in progress">
        <div className="w-80">
          <Card>
            <CardContentTicket title="Verjaardag van Lisa plannen">
              <Tag variant="medium">Gemiddeld</Tag>
              <Tag variant="neutral">M</Tag>
              <Tag variant="neutral">14-11-2026</Tag>
              <SubtaskProgressTag done={3} total={7} />
            </CardContentTicket>
          </Card>
        </div>
      </Specimen>
      <Specimen label="nothing done yet">
        <div className="w-80">
          <Card>
            <CardContentTicket title="Verhuizing voorbereiden">
              <Tag variant="urgent">Urgent</Tag>
              <SubtaskProgressTag done={0} total={12} />
            </CardContentTicket>
          </Card>
        </div>
      </Specimen>
      <Specimen label="all done">
        <div className="w-80">
          <Card>
            <CardContentTicket title="Tuin winterklaar maken">
              <Tag variant="low">Laag</Tag>
              <SubtaskProgressTag done={4} total={4} />
            </CardContentTicket>
          </Card>
        </div>
      </Specimen>
    </Specimens>
  </>
);
