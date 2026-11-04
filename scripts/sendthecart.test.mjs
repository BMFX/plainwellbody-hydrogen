import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {parseCartRequest,createCartCookie} from '@shopify/hydrogen';
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../app/lib/sendthecart.server.ts',import.meta.url),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const timingExports={};
const timingSource=readFileSync(new URL('../app/lib/request-timing.ts',import.meta.url),'utf8');
new Function('require','exports',ts.transpileModule(timingSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(require,timingExports);
const exports={};
new Function('require','exports',output)(name=>name==='@shopify/hydrogen'?{Cache:{none:()=>({})},gql:query=>query,createCartCookie}:name==='./cart-handlers'?{cartHandlers:{}}:name==='./request-timing'?timingExports:require(name),exports);
const {proxyUrl,proxyRequest,parseSelection,readChoice,parsePayload,applySelection,loadSelection,destination,requireSameOrigin}=exports;
const env={PUBLIC_STORE_DOMAIN:'example.myshopify.com',PUBLIC_CHECKOUT_DOMAIN:'checkout.example.test'};
const request=()=>new Request('https://example.test/a/cart/cedar?utm_source=email&admin_token=private&cartId=injected',{headers:{cookie:'cart=old; login=private',authorization:'secret'}});
const selection=()=>({ticket:'a'.repeat(64),name:'Cedar',reorder:false,behavior:'retain_cart',items:[{key:'0',platform_variant_id:'200',title:'Wash',quantity:2,optional:false,available:true,price:'18',currency:'USD'},{key:'1',platform_variant_id:'201',title:'Balm',quantity:1,optional:true,available:true,price:'12',currency:'USD'}]});
const choice={review_ticket:'a'.repeat(64),optional_keys:[],sets:1,behavior:'retain_cart'};
const payload=()=>({behavior:'retain_cart',items:[{platform_variant_id:'200',quantity:2}],attribution:{shopify:{line_item_properties:{_stc_execution:'e1'},cart_attributes:{stc_execution:'e1'}}}});
const cart=()=>({id:'gid://shopify/Cart/old?key=private',totalQuantity:1,lines:{nodes:[{id:'old-line',quantity:1}]},attributes:[{key:'gift',value:'yes'}],discountCodes:[{code:'OLD',applicable:true}]});
function handlers({addFails=false,attributesFail=false,incomplete=false,empty=false,promotionAccepted=false,createFails=false}={}){
 const calls=[],finish=[];const initial=cart();if(incomplete)initial.totalQuantity=3;
 const client={graphql:async(document,{variables})=>{
  finish.push(variables);
  if(document.includes('mutation SendTheCartCreate')){
   const created={id:'gid://shopify/Cart/new?key=private',totalQuantity:2,
    lines:{nodes:[{merchandise:{id:'gid://shopify/ProductVariant/200'},quantity:2}]},
    discountCodes:promotionAccepted?[{code:'NEW',applicable:true}]:[]};
   return {data:{cartCreate:{cart:created,userErrors:createFails?[{code:'FAILED'}]:[],warnings:[]}}};
  }
  return {data:{removed:variables.remove?{cart:cart(),userErrors:[],warnings:[]}:null,
    attributed:variables.attribute?{cart:cart(),userErrors:attributesFail?[{code:'FAILED'}]:[],warnings:[]}:null,
    promoted:variables.promote?{cart:{...cart(),discountCodes:promotionAccepted?[{code:'OLD',applicable:true},{code:'NEW',applicable:true}]:[{code:'OLD',applicable:true}]},userErrors:[],warnings:[]}:null}};
 }};
 return {calls,finish,client,get:async({request})=>{assert.equal(new URL(request.url).search,'');return {data:{cart:empty?null:initial}}},post:async({request})=>{
  const body=await request.clone().json();calls.push(body);await parseCartRequest(request);
  if(addFails)return {type:'error',headers:{},error:{}};
  return {type:'json',headers:{'set-cookie':'cart=new; HttpOnly; Secure'},data:{cart:cart(),userErrors:[],warnings:[]}};
 }};
}
test('upstream is fixed, redirects disallowed, and shopper secrets never leave Hydrogen',async()=>{
 let seen;await proxyRequest(env,'cedar',request(),undefined,async(url,options)=>{seen={url,options};return new Response('{}',{headers:{'content-type':'application/json'}});});
 assert.equal(seen.url.origin,'https://checkout.example.test');assert.equal(seen.url.searchParams.get('utm_source'),'email');assert.equal(seen.url.searchParams.has('admin_token'),false);
 assert.deepEqual(seen.options.headers,{Accept:'application/json'});assert.equal(seen.options.redirect,'error');assert.equal(seen.options.cache,'no-store');
 for(const token of ['../other','//evil.test','x?shop=evil','a/b'])assert.throws(()=>proxyUrl(env,token,new URL(request().url)));
 assert.throws(()=>proxyUrl({...env,PUBLIC_CHECKOUT_DOMAIN:'evil.test/path'},'cedar',new URL(request().url)));
 await assert.rejects(proxyRequest(env,'cedar',request(),undefined,async()=>new Response('<html>',{headers:{'content-type':'text/html'}})));
});
test('reviews bind the configured shop and reject malformed or duplicate selections',()=>{
 const envelope={version:1,shop:env.PUBLIC_STORE_DOMAIN,review:selection()};assert.equal(parseSelection(envelope,env.PUBLIC_STORE_DOMAIN).name,'Cedar');
 assert.throws(()=>parseSelection({...envelope,shop:'other.myshopify.com'},env.PUBLIC_STORE_DOMAIN));
 const invalid=selection();invalid.items[1].key='0';assert.throws(()=>parseSelection({...envelope,review:invalid},env.PUBLIC_STORE_DOMAIN));
});
test('choices cannot forge optional products, reorder bounds or unavailable variants',()=>{
 const form=new FormData();for(const [key,value] of Object.entries({...choice,optional_keys:undefined}))if(value!==undefined)form.set(key,String(value));
 assert.deepEqual(readChoice(form,selection()),choice);form.append('optional_keys','999');assert.throws(()=>readChoice(form,selection()));form.delete('optional_keys');
 form.set('sets','2');assert.throws(()=>readChoice(form,selection()));form.set('sets','1');const unavailable=selection();unavailable.items[0].available=false;assert.throws(()=>readChoice(form,unavailable));
 assert.throws(()=>parsePayload({...payload(),items:[{platform_variant_id:'999',quantity:2}]},selection(),choice));
});
test('keep adds once with line attribution and merges existing cart attributes',async()=>{
 const h=handlers();const result=await applySelection(request(),h.client,payload(),h);assert.equal(result.ok,true);assert.equal(h.calls.length,1);assert.equal(h.finish.length,1);
 assert.deepEqual(h.calls[0].lines,[{merchandiseId:'gid://shopify/ProductVariant/200',quantity:2,attributes:[{key:'_stc_execution',value:'e1'}]}]);
 assert.deepEqual(h.finish[0].attributes,[{key:'gift',value:'yes'},{key:'stc_execution',value:'e1'}]);
});
test('replace adds before removing the original snapshot; failed adds never empty a bag',async()=>{
 const h=handlers();const result=await applySelection(request(),h.client,{...payload(),behavior:'clear_cart'},h);assert.equal(result.ok,true);
 assert.equal(h.calls[0].lines[0].merchandiseId,'gid://shopify/ProductVariant/200');assert.deepEqual(h.finish[0].lineIds,['old-line']);assert.equal(h.finish[0].cartId,cart().id);assert.equal(h.finish.length,1);assert.equal(h.calls.length,1);
 const failed=handlers({addFails:true});assert.equal((await applySelection(request(),failed.client,{...payload(),behavior:'clear_cart'},failed)).ok,false);assert.equal(failed.calls.length,1);assert.equal(failed.finish.length,0);
 const partial=handlers({incomplete:true});assert.equal((await applySelection(request(),partial.client,{...payload(),behavior:'clear_cart'},partial)).ok,false);assert.equal(partial.calls.length,0);
});
test('later failures preserve cart cookies and never repeat the successful add',async()=>{
 const h=handlers({attributesFail:true});const result=await applySelection(request(),h.client,payload(),h);assert.equal(result.ok,false);assert.match(result.headers.get('set-cookie'),/cart=new/);assert.equal(h.calls.filter(call=>call.lines?.[0]?.merchandiseId).length,1);
});

test('cross-site cart submissions and unsafe custom redirects are rejected',()=>{
 for(const origin of [null,'https://attacker.test'])assert.throws(()=>requireSameOrigin(new Request('https://example.test/a/cart/cedar',{headers:origin?{origin}:{}})));
 requireSameOrigin(new Request('https://example.test/a/cart/cedar',{headers:{origin:'https://example.test'}}));
 for(const path of ['//evil.test','/a/cart/token','/api/cart','/pages/%2e%2e','/cart/add.js'])assert.equal(destination({redirect_mode:'custom',redirect_to:path}),'/cart');
 assert.equal(destination({redirect_mode:'custom',redirect_to:'/pages/thanks'}),'/pages/thanks');assert.equal(destination({redirect_mode:'checkout'}),'/checkout');assert.equal(destination({}),'/cart');
});
test('current Hydrogen publication, prices and subscription requirements override catalog availability',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({version:1,shop:env.PUBLIC_STORE_DOMAIN,review:selection()}),{headers:{'content-type':'application/json'}});
 try{
  const loaded=await loadSelection(env,'cedar',request(),{graphql:async()=>({data:{nodes:[{id:'gid://shopify/ProductVariant/200',availableForSale:true,price:{amount:'20',currencyCode:'USD'},product:{requiresSellingPlan:true}}]}})});
  assert.equal(loaded.items[0].available,false);assert.equal(loaded.items[0].price,'20');assert.equal(loaded.items[1].available,false);
 }finally{globalThis.fetch=original;}
});
test('promotion application shares the completion request, preserves old codes and requires applicability',async()=>{
 const rejected=handlers();const failed=await applySelection(request(),rejected.client,{...payload(),promotion:{code:'NEW'}},rejected);
 assert.equal(failed.ok,false);assert.deepEqual(rejected.finish[0].discountCodes,['OLD','NEW']);
 const accepted=handlers({promotionAccepted:true});
 assert.equal((await applySelection(request(),accepted.client,{...payload(),promotion:{code:'NEW'}},accepted)).ok,true);
 assert.equal(accepted.calls.length,1);assert.equal(accepted.finish.length,1);
});
test('a fresh cart combines products, attribution and promotion in one native mutation',async()=>{
 const h=handlers({empty:true,promotionAccepted:true});
 const result=await applySelection(request(),h.client,{...payload(),promotion:{code:'NEW'}},h);
 assert.equal(result.ok,true);assert.equal(h.calls.length,0);assert.equal(h.finish.length,1);
 assert.deepEqual(h.finish[0].input.discountCodes,['NEW']);
 assert.deepEqual(h.finish[0].input.attributes,[{key:'stc_execution',value:'e1'}]);
 assert.deepEqual(h.finish[0].input.lines[0].attributes,[{key:'_stc_execution',value:'e1'}]);
 assert.match(result.headers.get('set-cookie'),/cart=/);
});
test('partial cart creation preserves its cookie for recovery and never retries',async()=>{
 const h=handlers({empty:true,createFails:true});const result=await applySelection(request(),h.client,payload(),h);
 assert.equal(result.ok,false);assert.equal(h.finish.length,1);assert.match(result.headers.get('set-cookie'),/cart=/);
});
