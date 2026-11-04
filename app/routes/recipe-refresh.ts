import {envContext} from "~/lib/env";
import {handleRecipeRefresh} from "~/lib/recipe-cache.server";
import {refreshRecipe} from "~/lib/sendthecart.server";
import type {Route} from "./+types/recipe-refresh";

export async function action({request,context}:Route.ActionArgs) {
  return handleRecipeRefresh(request,(code,notice) => refreshRecipe(context.get(envContext),code,notice));
}
export function loader() {return new Response(null,{status:405,headers:{"Cache-Control":"no-store"}});}
