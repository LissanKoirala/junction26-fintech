// Money Map card (lazy: the map file holds 5,000 points).
import { Map as MapIcon } from "lucide-react";
import { useCustomer } from "@/state/customer";
import { isReady, tribesOf, useMl, useMoneyMap, useTribes } from "@/features/ml/data";
import { CardSkeleton, Meaning, MlCard, StillTraining } from "@/features/ml/ui";
import { MapCaveat, MoneyMapView } from "@/features/ml/views/personality";

export default function MapSection() {
  const c = useCustomer();
  const map = useMoneyMap();
  const prof = useMl("profile", c?.id);
  const tribes = tribesOf(useTribes());
  if (map.status === "loading") return <CardSkeleton h={300} />;
  const p = isReady(prof) ? prof.data : null;
  return (
    <MlCard id="map" icon={MapIcon} eyebrow={isReady(map) ? `${map.data.ids.length.toLocaleString("en-GB")} customers` : undefined} title="Money Map" ask="Which tribe am I closest to, and why?" model="tribes">
      {isReady(map) ? (
        <>
          <MoneyMapView map={map.data} profile={p} tribes={tribes} />
          <Meaning className="text-sm">
            {p
              ? `You sit among the ${p.tribe.name} dots, ${p.tribe.mix[1] ? `close to the ${[...p.tribe.mix].sort((a, b) => b.weight - a.weight)[1].name} side` : ""}. Tap a tribe to see where its people are.`
              : "Tap a tribe to see where its people are."}
          </Meaning>
          <MapCaveat />
        </>
      ) : (
        <StillTraining name="The Money Map" />
      )}
    </MlCard>
  );
}
