// Money Map card (lazy: the map file holds 5,000 points).
import { Map as MapIcon } from "lucide-react";
import { useCustomer } from "@/state/customer";
import { isReady, tribesOf, useMl, useMoneyMap, useTribes } from "@/features/ml/data";
import { CardSkeleton, Meaning, MlCard, StillTraining } from "@/features/ml/ui";
import { MapCaveat, MoneyMapView } from "@/features/ml/views/personality";
import { num } from "@/lib/format";
import { t } from "@/lib/i18n";
import { tD as tData } from "@/features/ml/words";
import type { MlProfile } from "@shared/ml/typesA";

function meaning(p: MlProfile | null): string {
  const tap = t("Tap a tribe to see where its people are.");
  if (!p) return tap;
  const second = [...p.tribe.mix].sort((a, b) => b.weight - a.weight)[1];
  const main = tData(p.tribe.name);
  return (second ? t("You sit among the {main} dots, close to the {second} side.", { main, second: tData(second.name) }) : t("You sit among the {main} dots.", { main })) + " " + tap;
}

export default function MapSection() {
  const c = useCustomer();
  const map = useMoneyMap();
  const prof = useMl("profile", c?.id);
  const tribes = tribesOf(useTribes());
  if (map.status === "loading") return <CardSkeleton h={300} />;
  const p = isReady(prof) ? prof.data : null;
  return (
    <MlCard id="map" icon={MapIcon} eyebrow={isReady(map) ? t("{n} customers", { n: num(map.data.ids.length) }) : undefined} title={t("Money Map")} ask="Which tribe am I closest to, and why?" model="tribes">
      {isReady(map) ? (
        <>
          <MoneyMapView map={map.data} profile={p} tribes={tribes} />
          <Meaning className="text-sm">{meaning(p)}</Meaning>
          <MapCaveat />
        </>
      ) : (
        <StillTraining name={t("The Money Map")} />
      )}
    </MlCard>
  );
}
