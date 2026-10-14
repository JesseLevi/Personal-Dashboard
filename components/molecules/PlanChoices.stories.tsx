import { Dropdown } from "../atoms/Dropdown";
import { Button } from "../atoms/Button";
import { PlanChoices } from "./PlanChoices";

// As the menus place it: inside a labelless Dropdown popover, 16rem wide.
const plan = async () => ({ success: true as const, data: undefined });

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
