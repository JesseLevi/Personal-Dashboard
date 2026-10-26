import { Dropdown } from "../atoms/Dropdown";
import { Button } from "../atoms/Button";
import { PlanChoices } from "./PlanChoices";
import { Specimen, Specimens, StoryIntro } from "@/.ladle/story-kit";
import type { StoryDefault } from "@ladle/react";

export default { title: "Agenda / Plan choices" } satisfies StoryDefault;

// As the menus place it: inside a labelless Dropdown popover, 16rem wide.
const plan = async () => ({ success: true as const, data: undefined });

export const Overview = () => (
  <div>
    <StoryIntro
      what="Day and moment choices for planning a recipe or card, shown inside a dropdown popover."
      note="PlanChoices"
    />
    <Specimens>
      <Specimen label="Default" hint="days plus moment">
        <div className="w-64">
          <Dropdown className="shadow-sm">
            <PlanChoices today="2026-01-01" onPlan={plan} onPlanned={() => {}} />
          </Dropdown>
        </div>
      </Specimen>
      <Specimen label="With back row" hint="replaces another menu">
        <div className="w-64">
          <Dropdown className="shadow-sm">
            <PlanChoices
              today="2026-01-01"
              onPlan={plan}
              onPlanned={() => {}}
              header={
                <Button variant="white" align="left" icon="ArrowLeft">
                  Plannen
                </Button>
              }
            />
          </Dropdown>
        </div>
      </Specimen>
      <Specimen label="Without moment" hint="cards">
        <div className="w-64">
          <Dropdown className="shadow-sm">
            <PlanChoices today="2026-01-01" showSlot={false} onPlan={plan} onPlanned={() => {}} />
          </Dropdown>
        </div>
      </Specimen>
    </Specimens>
  </div>
);

export const Default = () => (
  <div className="w-64">
    <Dropdown className="shadow-sm">
      <PlanChoices today="2026-01-01" onPlan={plan} onPlanned={() => {}} />
    </Dropdown>
  </div>
);

export const WithBackRow = () => (
  <div className="w-64">
    <Dropdown className="shadow-sm">
      <PlanChoices
        today="2026-01-01"
        onPlan={plan}
        onPlanned={() => {}}
        header={
          <Button variant="white" align="left" icon="ArrowLeft">
            Plannen
          </Button>
        }
      />
    </Dropdown>
  </div>
);

// Cards have no moment: the select is hidden.
export const WithoutMoment = () => (
  <div className="w-64">
    <Dropdown className="shadow-sm">
      <PlanChoices today="2026-01-01" showSlot={false} onPlan={plan} onPlanned={() => {}} />
    </Dropdown>
  </div>
);
