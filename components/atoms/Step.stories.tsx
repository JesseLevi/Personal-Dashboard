// figma: node-id=3727:3208
import { Step } from "./Step";

export const Default = () => <Step>1</Step>;

export const Sequence = () => (
  <div className="flex items-center gap-2">
    <Step>1</Step>
    <Step>2</Step>
    <Step>3</Step>
  </div>
);
