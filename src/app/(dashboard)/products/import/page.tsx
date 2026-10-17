import { listProducts } from "@/actions/products.actions";
import { ProductImport } from "@/components/imports/product-import";
export default async function ProductImportPage(){const products=await listProducts(true);return <ProductImport products={products.map(p=>({id:p.id,productName:p.productName,model:p.model,defaultBuyingPrice:p.defaultBuyingPrice?.toString()??null,defaultSellingPrice:p.defaultSellingPrice.toString()}))}/>;}
