import type { FhevmInstance } from "../fhevmTypes.js";
import { ethers } from "ethers";
export type FhevmGoState = "idle" | "loading" | "ready" | "error";
export declare function useFhevm(parameters: {
    provider: string | ethers.Eip1193Provider | undefined;
    chainId: number | undefined;
    enabled?: boolean;
    initialMockChains?: Readonly<Record<number, string>>;
}): {
    instance: FhevmInstance | undefined;
    refresh: () => void;
    error: Error | undefined;
    status: FhevmGoState;
};
