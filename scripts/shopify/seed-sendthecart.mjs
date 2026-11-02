// Add only the adapter's interface text to the existing merchant-owned model.
// No changes to products, publications, definitions or existing merchant copy.
import {admin} from './admin.mjs';
import {TEXT} from './seed/text.mjs';
const apply=process.argv.includes('--apply');
const definition=await admin(`query StcTextDefinition {metaobjectDefinitionByType(type:"pw_text") {id}}`);
if(!definition.metaobjectDefinitionByType)throw new Error('Run the existing content-model setup first.');
for(const [key,value] of Object.entries(TEXT).filter(([key])=>key.startsWith('stc.'))){
  const handle={type:'pw_text',handle:key.replace(/[^a-z0-9]+/g,'-')};
  const existing=await admin(`query StcExistingText($handle:MetaobjectHandleInput!) {metaobjectByHandle(handle:$handle){id}}`,{handle});
  if(existing.metaobjectByHandle){console.log(`exists ${key}`);continue;}
  console.log(`${apply?'create':'would create'} ${key}`);
  if(apply){
    const result=await admin(`mutation StcCreateText($metaobject:MetaobjectCreateInput!) {metaobjectCreate(metaobject:$metaobject){metaobject{id} userErrors{field message}}}`,{
      metaobject:{type:'pw_text',handle:handle.handle,fields:[{key:'key',value:key},{key:'value',value}]},
    });
    if(result.metaobjectCreate.userErrors.length)throw new Error('Could not create adapter interface text.');
  }
}
