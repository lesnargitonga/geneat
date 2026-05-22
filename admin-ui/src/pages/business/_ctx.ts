import { useOutletContext } from "react-router-dom";
import type { Business } from "@/lib/types";

export interface BusinessContext {
  business: Business;
}

export function useBusiness(): Business {
  return useOutletContext<BusinessContext>().business;
}
