import { createContext } from "react";

/** The account the board reads and acts as, for parts that differ by wallet kind (D-030). */
export const ViewerContext = createContext<string | null>(null);
