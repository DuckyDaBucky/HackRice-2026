import { notFound, redirect } from "next/navigation";
import { requireDevUser } from "@/lib/workbench/access";
import { WorkbenchError } from "@/lib/workbench/errors";
import Workbench from "./workbench";
export const dynamic="force-dynamic";
export default async function DevPage() {
  try {await requireDevUser();} catch(e) {
    if(e instanceof WorkbenchError&&e.status===404)notFound();
    if(e instanceof WorkbenchError&&e.status===401)redirect("/sign-in?redirect_url=%2Fdev");
    throw e;
  }
  return <Workbench/>;
}
