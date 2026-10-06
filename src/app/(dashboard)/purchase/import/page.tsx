import { listProducts } from "@/actions/products.actions";
import { PurchaseImport } from "@/components/imports/purchase-import";
import { requireOwner } from "@/lib/auth";
export default async function PurchaseImportPage(){await requireOwner();const products=await listProducts();return <PurchaseImport products={products.map(p=>({id:p.id,sku:p.sku,model:p.model,ram:p.ram,storageCapacity:p.storageCapacity,color:p.color,defaultBuyingPrice:p.defaultBuyingPrice?.toString()??null,defaultSellingPrice:p.defaultSellingPrice.toString()}))}/>;}
