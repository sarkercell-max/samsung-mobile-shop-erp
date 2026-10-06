import { listProducts } from "@/actions/products.actions";
import { ProductImport } from "@/components/imports/product-import";
export default async function ProductImportPage(){const products=await listProducts(true);return <ProductImport products={products.map(p=>({id:p.id,sku:p.sku,model:p.model,ram:p.ram,storageCapacity:p.storageCapacity,color:p.color,defaultBuyingPrice:p.defaultBuyingPrice?.toString()??null,defaultSellingPrice:p.defaultSellingPrice.toString()}))}/>;}
