"use client";

import { useState, useTransition } from "react";
import { getStockAnalytics } from "@/actions/reports.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { Package, ShoppingCart, TrendingDown } from "lucide-react";

type Analytics = Awaited<ReturnType<typeof getStockAnalytics>>;
type View = "today" | "daily" | "weekly" | "monthly" | "custom";
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const parse = (s: string) => new Date(`${s}T00:00:00`);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);

function summarize(data: Analytics, view: View) {
  const from=parse(data.range.from),to=parse(data.range.to);
  const starts:Date[]=[];
  if(view==="today") starts.push(from);
  else if(view==="daily"||view==="custom") for(let d=new Date(from);d<=to;d=addDays(d,1)) starts.push(d);
  else if(view==="weekly") { const first=new Date(from);first.setDate(first.getDate()-((first.getDay()+6)%7));for(let d=first;d<=to;d=addDays(d,7))starts.push(d); }
  else for(let d=new Date(from.getFullYear(),from.getMonth(),1);d<=to;d=new Date(d.getFullYear(),d.getMonth()+1,1))starts.push(d);
  const purchaseMap=new Map(data.purchasesByDay.map(e=>[e.date,e]));
  const saleMap=new Map(data.salesByDay.map(e=>[e.date,e]));
  let stock=data.openingStock,value=data.openingValue;
  return starts.map(start=>{
    const end=view==="today"||view==="daily"||view==="custom"?addDays(start,1):view==="weekly"?addDays(start,7):new Date(start.getFullYear(),start.getMonth()+1,1);
    let purchased=0,sold=0,purchaseCost=0,soldCost=0;
    for(let d=new Date(start);d<end&&d<=to;d=addDays(d,1)){const key=iso(d),p=purchaseMap.get(key),s=saleMap.get(key);purchased+=p?.quantity??0;sold+=s?.quantity??0;purchaseCost+=p?.cost??0;soldCost+=s?.cost??0;}
    stock+=purchased-sold;value+=purchaseCost-soldCost;
    const label=view==="today"||view==="daily"||view==="custom"?iso(start):view==="weekly"?`${iso(start)} – ${iso(addDays(end,-1))}`:start.toLocaleDateString(undefined,{year:"numeric",month:"long"});
    return {label,purchased,sold,stock,value};
  });
}

export function StockOverview({ initialData }: { initialData: Analytics }) {
  const [data,setData]=useState(initialData),[view,setView]=useState<View>("daily"),[from,setFrom]=useState(initialData.range.from),[to,setTo]=useState(initialData.range.to),[pending,startTransition]=useTransition();
  const load=(next:View,start?:string,end?:string)=>startTransition(async()=>{
    const today=new Date(),todayStart=new Date(today.getFullYear(),today.getMonth(),today.getDate());
    let a=todayStart,b=addDays(todayStart,1);
    if(next==="daily"){a=addDays(todayStart,-13);}
    if(next==="weekly"){a=addDays(todayStart,-77);a.setDate(a.getDate()-((a.getDay()+6)%7));}
    if(next==="monthly"){a=new Date(today.getFullYear(),today.getMonth()-11,1);}
    if(next==="custom"){a=parse(start??from);b=addDays(parse(end??to),1);}
    const result=await getStockAnalytics({from:iso(a),to:iso(addDays(b,-1))});setData(result);setFrom(result.range.from);setTo(result.range.to);setView(next);
  });
  const rows=summarize(data,view);
  const cards=[["Total Current Stock",`${data.totalStock} Pcs`,Package],["Today's Purchase",`${data.todayPurchaseQty} Pcs`,ShoppingCart],["Today's Sold",`${data.todaySold} Pcs`,TrendingDown]] as const;
  return <div className="space-y-4">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{cards.map(([label,value,Icon])=><Card key={label}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle><Icon className="h-4 w-4 text-muted-foreground"/></CardHeader><CardContent><p className="text-lg font-semibold">{value}</p></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>Stock Summary</CardTitle></CardHeader><CardContent className="space-y-3">
      <div className="flex flex-wrap gap-2">{(["today","daily","weekly","monthly","custom"] as View[]).map(v=><Button key={v} size="sm" variant={view===v?"default":"outline"} onClick={()=>v==="custom"?setView(v):load(v)}>{v[0]!.toUpperCase()+v.slice(1)}</Button>)}</div>
      {view==="custom"&&<div className="flex flex-wrap items-end gap-2"><label className="text-xs text-muted-foreground">From Date<Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="text-xs text-muted-foreground">To Date<Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><Button size="sm" onClick={()=>load("custom",from,to)}>Apply</Button></div>}
      <div className="overflow-x-auto"><table className="w-full min-w-[460px] text-sm"><thead><tr className="border-y bg-muted/40 text-left"><th className="p-3">{view==="today"||view==="daily"||view==="custom"?"Date":view==="weekly"?"Week":"Month"}</th><th className="p-3 text-right">Purchase Qty</th><th className="p-3 text-right">Sold Qty</th><th className="p-3 text-right">Stock Qty</th>{view==="monthly"&&<th className="p-3 text-right">Stock Value</th>}</tr></thead><tbody>{rows.map(r=><tr key={r.label} className="border-b"><td className="p-3">{r.label}</td><td className="p-3 text-right">{r.purchased}</td><td className="p-3 text-right">{r.sold}</td><td className="p-3 text-right font-medium">{r.stock}</td>{view==="monthly"&&<td className="p-3 text-right">{formatCurrency(r.value)}</td>}</tr>)}{rows.length===0&&<tr><td colSpan={view==="monthly"?5:4} className="p-5 text-center text-muted-foreground">No stock activity for this date range.</td></tr>}</tbody></table></div>
      {pending&&<p className="text-xs text-muted-foreground">Updating stock summary…</p>}
    </CardContent></Card>
  </div>;
}
