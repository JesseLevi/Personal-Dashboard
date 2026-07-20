// figma: node-id=3624:4448
import { Card } from "./Card";

const placeholderContent = (
  <p className="text-base font-semibold text-text-muted">Card content</p>
);

export const Default = () => <Card>{placeholderContent}</Card>;

export const WithTitle = () => (
  <Card title="Titel">{placeholderContent}</Card>
);

export const WithStep = () => <Card step={1}>{placeholderContent}</Card>;

export const WithTitleAndStep = () => (
  <Card title="Titel" step={1}>
    {placeholderContent}
  </Card>
);
