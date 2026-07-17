import { createClient } from "@/lib/supabase/server";
import UnitsManager from "@/components/teacher/units-manager";
import type { Unit } from "@/lib/types";

export default async function TeacherUnitsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("units")
    .select("*")
    .order("grade")
    .order("order_index");

  return <UnitsManager initialUnits={(data as Unit[]) ?? []} />;
}
