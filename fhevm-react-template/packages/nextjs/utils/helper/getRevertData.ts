// npm i ethers
import { Contract, Interface, JsonRpcProvider } from "ethers";
import { getParsedErrorWithAllAbis } from "~~/utils/helper/contract";
import { AllowedChainIds } from "~~/utils/helper/networks";

// Build an Interface with your ABI + standard Error(string)
const buildIface = (abi: any[]) => {
    let iface = new Interface(abi);
    const ifaceErrors = new Interface([
        "error Error(string)",
        ...iface.fragments,
    ]);
    return ifaceErrors;
}

function extractRevertDataHex(err: any): string | undefined {
    // Common places providers stick revert bytes
    const candidates = [
        err?.data,                 // ethers v6 often here
        err?.data?.data,
        err?.error?.data,
        err?.info?.error?.data,
        err?.body && (() => { try { return JSON.parse(err.body)?.error?.data; } catch { return undefined; } })(),
    ];
    for (const c of candidates) {
        if (typeof c === "string" && c.startsWith("0x")) return c;
        if (typeof c?.data === "string" && c.data.startsWith("0x")) return c.data;
    }
    return undefined;
}

/**
 * Estimate gas; on missing revert data, re-call to fetch and decode it.
 */
export async function estimateWithReason(
    contract: Contract,
    fn: string,
    args: any[] = [],
    overrides: Record<string, any> = {},
    provider: JsonRpcProvider,
    chainId: AllowedChainIds
): Promise<{ gas?: bigint; revert?: { kind: "CustomError" | "ErrorString" | "Unknown"; name?: string; args?: any[]; reason?: string; raw?: string } }> {
    const iface = buildIface(contract.interface.fragments.filter(f => f.type === "error"));

    try {
        const gas = await (contract as any)[fn].estimateGas(...args, overrides);
        return { gas };
    } catch (err: any) {
        // Many RPCs strip data here; try to decode if any is present
        const dataFromEstimate = extractRevertDataHex(err);
        if (dataFromEstimate) {
            // we already have bytes — decode them
            const decoded = tryDecodeError(iface, dataFromEstimate);
            return { revert: decoded };
        }

        // Populate identical tx then dry-run with eth_call to force revert bytes
        const populated = await (contract as any)[fn].populateTransaction(...args, overrides);
        try {
            // The call is expected to REVERT; we only want the bytes in the catch
            await (provider as any).call({
                to: contract.target,
                from: overrides?.from,
                data: populated.data,
                value: overrides?.value,
            });
            // If it didn't revert, then the estimate error was not from require/revert
            return { revert: { kind: "Unknown" } };
        } catch (callErr: any) {
            const parsedError = getParsedErrorWithAllAbis(callErr, chainId);
            console.log(parsedError);
            return { revert: { kind: "ErrorString", reason: parsedError } };
            /* const raw = extractRevertDataHex(callErr);
            if (!raw) return { revert: { kind: "Unknown" } };
            const decoded = tryDecodeError(iface, raw);
            return { revert: decoded }; */
        }
    }
}

function tryDecodeError(iface: Interface, raw: string) {
    // Try custom error first (needs ABI)
    try {
        const parsed = iface.parseError(raw);
        return {
            kind: "CustomError" as const,
            name: parsed.name,
            args: Array.from(parsed.args),
            raw,
        };
    } catch {
        // Fallback to standard Error(string)
        try {
            const std = new Interface(["error Error(string)"]);
            const p = std.parseError(raw);
            return {
                kind: "ErrorString" as const,
                reason: String(p.args[0]),
                raw,
            };
        } catch {
            return { kind: "Unknown" as const, raw };
        }
    }
}


export async function getRevertData(contract: Contract, fn: string, fnArgs: any, sender: string, provider: JsonRpcProvider, chainId: AllowedChainIds): string {
    const res = await estimateWithReason(contract, fn, fnArgs, { from: sender }, provider, chainId);

    if (res.gas) {
        return "Estimated gas: " + res.gas.toString();
    } else if (res.revert) {
        if (res.revert.kind === "ErrorString") {
            return "Reverted: " + res.revert.reason;
        } else if (res.revert.kind === "CustomError") {
            return `Reverted with ${res.revert.name} ` + res.revert.args?.join(", ");
        } else {
            return "Reverted without decodable data. " + res.revert.raw;
        }
    }
    return "";

}