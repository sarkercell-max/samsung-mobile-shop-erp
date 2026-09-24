"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function iso(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
export function ReportDateFilter({ from, to }: { from: string; to: string }) {
  const router=useRouter(), params=useSearchParams(); const [preset,setPreset]=useState(params.get("preset")||"custom"); const [start,setStart]=useState(from),[end,setEnd]=useState(to);
  function apply(a:string,b:string,p:string) { setStart(a);setEnd(b);setPreset(p);router.push(`/reports?from=${a}&to=${b}&preset=${p}`); }
  function choose(p:string) { const now=new Date();let a=new Date(now),b=new Date(now); if(p==="yesterday"){a.setDate(a.getDate()-1);b=new Date(a)} else if(p==="week"){a.setDate(a.getDate()-((a.getDay()+6)%7))} else if(p==="month"){a.setDate(1)} else if(p==="lastMonth"){a=new Date(now.getFullYear(),now.getMonth()-1,1);b=new Date(now.getFullYear(),now.getMonth(),0)} apply(iso(a),iso(b),p); }
  const presets: [string,string][] = [["today","Today"],["yesterday","Yesterday"],["week","This Week"],["month","This Month"],["lastMonth","Last Month"],["custom","Custom Range"]];
  return <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3"><div className="w-40"><span className="mb-1 block text-xs text-muted-foreground">Preset</span><Select value={preset} onValueChange={choose}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{presets.map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div><label className="text-xs text-muted-foreground">From Date<Input type="date" value={start} onChange={e=>{setStart(e.target.value);setPreset("custom")}} /></label><label className="text-xs text-muted-foreground">To Date<Input type="date" value={end} onChange={e=>{setEnd(e.target.value);setPreset("custom")}} /></label><Button variant="outline" onClick={()=>apply(start,end,"custom")}>Apply</Button></div>;
}
