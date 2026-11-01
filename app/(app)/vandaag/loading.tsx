import { Card } from "@/components/molecules/Card";
import { LoadingStatus, SKELETON_BREATHE } from "../_components/skeletons/skeleton-parts";
import { EnterFromLoginSkeleton } from "../te-doen/EnterFromLoginSkeleton";

// Route-segment fallback for /vandaag: four empty cards in the page's grid (design/notes/Skeletons.md).
export default function Loading() {
  return (
    <EnterFromLoginSkeleton>
      <LoadingStatus />
      <div aria-hidden inert className="grid w-full grid-cols-1 gap-stack-xl pr-page-right-equal md:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <Card key={index} className={SKELETON_BREATHE} contentClassName="bg-surface-primary">
            <div className="h-24" />
          </Card>
        ))}
      </div>
    </EnterFromLoginSkeleton>
  );
}
