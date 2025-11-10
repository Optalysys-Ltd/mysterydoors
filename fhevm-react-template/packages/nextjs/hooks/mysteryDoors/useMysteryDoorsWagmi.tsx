"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDeployedContractInfo } from "../helper";
import { useWagmiEthers } from "../wagmi/useWagmiEthers";
import { FhevmInstance } from "@fhevm-sdk";
import { RelayerEncryptedInput } from "@zama-fhe/relayer-sdk/web";
import {
  buildParamsFromAbi,
  getEncryptionMethod,
  useFHEDecrypt,
  useFHEEncryption,
  useInMemoryStorage,
} from "@fhevm-sdk";
import { ethers } from "ethers";
import type { Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";
import { useReadContract } from "wagmi";

/**
 * useFHECounterWagmi - Minimal FHE Counter hook for Wagmi devs
 *
 * What it does:
 * - Reads the current encrypted counter
 * - Decrypts the handle on-demand with useFHEDecrypt
 * - Encrypts inputs and writes increment/decrement
 *
 * Pass your FHEVM instance and a simple key-value storage for the decryption signature.
 * That's it. Everything else is handled for you.
 */
export const useMysteryDoorsWagmi = (parameters: {
  instance: FhevmInstance | undefined;
  initialMockChains?: Readonly<Record<number, string>>;
}) => {
  const { instance, initialMockChains } = parameters;
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();

  // Wagmi + ethers interop
  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);

  // Resolve deployed contract info once we know the chain
  const allowedChainId = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;
  const { data: mysteryDoors } = useDeployedContractInfo({ contractName: "MysteryDoors", chainId: allowedChainId });

  // Simple status string for UX messages
  const [message, setMessage] = useState<string>("");

  type MysteryDoorsInfo = Contract<"MysteryDoors"> & { chainId?: number };

  const isRefreshing = false as unknown as boolean; // derived from wagmi below
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // -------------
  // Helpers
  // -------------
  const hasContract = Boolean(mysteryDoors?.address && mysteryDoors?.abi);
  const hasProvider = Boolean(ethersReadonlyProvider);
  const hasSigner = Boolean(ethersSigner);

  const getContract = (mode: "read" | "write") => {
    if (!hasContract) return undefined;
    const providerOrSigner = mode === "read" ? ethersReadonlyProvider : ethersSigner;
    if (!providerOrSigner) return undefined;
    return new ethers.Contract(
      mysteryDoors!.address,
      (mysteryDoors as MysteryDoorsInfo).abi,
      providerOrSigner,
    );
  };

  // Read getGuesses handle via wagmi
  const readResult = useReadContract({
    address: (hasContract ? (mysteryDoors!.address as unknown as `0x${string}`) : undefined) as
      | `0x${string}`
      | undefined,
    abi: (hasContract ? ((mysteryDoors as MysteryDoorsInfo).abi as any) : undefined) as any,
    functionName: "getGuesses" as const,
    query: {
      enabled: Boolean(hasContract && hasProvider),
      refetchOnWindowFocus: false,
    },
  });

  const guessesHandles = useMemo(() => (readResult.data as string | undefined) ?? undefined, [readResult.data]);
  const canGetCount = Boolean(hasContract && hasProvider && !readResult.isFetching);
  const refreshGuessesHandle = useCallback(async () => {
    const res = await readResult.refetch();
    if (res.error) setMessage("FHECounter.getGuesses() failed: " + (res.error as Error).message);
  }, [readResult]);
  // derive isRefreshing from wagmi
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _derivedIsRefreshing = readResult.isFetching;

  // Wagmi handles initial fetch via `enabled`

  // Decrypt (reuse existing decrypt hook for simplicity)
  const requests = useMemo(() => {
    if (!hasContract || !guessesHandles || guessesHandles === ethers.ZeroHash) return undefined;
    return [{ handle: guessesHandles, contractAddress: mysteryDoors!.address } as const];
  }, [hasContract, mysteryDoors?.address, guessesHandles]);

  const {
    canDecrypt,
    decrypt,
    isDecrypting,
    message: decMsg,
    results,
  } = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage,
    chainId,
    requests,
  });

  useEffect(() => {
    if (decMsg) setMessage(decMsg);
  }, [decMsg]);


  // Mutations (increment/decrement)
  const { encryptWith } = useFHEEncryption({ instance, ethersSigner: ethersSigner as any, contractAddress: mysteryDoors?.address });
  const canUpdateCounter = useMemo(
    () => Boolean(hasContract && instance && hasSigner && !isProcessing),
    [hasContract, instance, hasSigner, isProcessing],
  );

    const getEncryptionMethodFor = (functionName: "makeGuesses") => {
    const functionAbi = mysteryDoors?.abi.find(item => item.type === "function" && item.name === functionName);
    if (!functionAbi) return { method: undefined as string | undefined, error: `Function ABI not found for ${functionName}` } as const;
    if (!functionAbi.inputs || functionAbi.inputs.length === 0)
      return { method: undefined as string | undefined, error: `No inputs found for ${functionName}` } as const;
    const methods: string[] = functionAbi.inputs.slice(0, -1).map((input: { internalType: string; }, index: any) => {
      return getEncryptionMethod(input.internalType);
    })
    console.log(methods);
    return { methods, error: undefined } as const;
  };

  const callMakeGuesses = useCallback(
      async (guesses: number[]) => {
        if (isProcessing || !canUpdateCounter || guesses.length === 0) return;
        const functionName = "makeGuesses";
        const encSig = guesses.join(", ");
        setIsProcessing(true);
        setMessage(`Starting ${functionName}(${encSig})...`);
        try {
          const { methods, error } = getEncryptionMethodFor(functionName);
          if (!methods) return setMessage(error ?? "Encryption method not found");
  
          setMessage(`Encrypting with ${methods.join(", ")}...`);
          const enc = await encryptWith(builder => {
            const chained = methods.reduce((acc: RelayerEncryptedInput, method: string, index: number, ) => {
              return (acc as any)[method](guesses[index]);
            }, builder);
            console.log(chained);
            return chained;
          });
          if (!enc) return setMessage("Encryption failed");
  
          const writeContract = getContract("write");
          if (!writeContract) return setMessage("Contract info or signer not available");
  
          const params = buildParamsFromAbi(enc, [...mysteryDoors!.abi] as any[], functionName);
          console.log(params);
          const tx = await (writeContract.makeGuesses(...params));
          setMessage("Waiting for transaction...");
          await tx.wait();
          setMessage(`${functionName}(${encSig}) completed!`);
          //refreshCountHandle();
        } catch (e) {
          setMessage(`${functionName} failed: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
          setIsProcessing(false);
        }
      },
      [isProcessing, canUpdateCounter, encryptWith, getContract, mysteryDoors?.abi],
    );



  return {
    contractAddress: mysteryDoors?.address,
    canDecrypt,
    canGetCount,
    canUpdateCounter,
    callAddGuess: callMakeGuesses,
    message,
    handle: guessesHandles,
    isDecrypting,
    isRefreshing,
    isProcessing,
    // Wagmi-specific values
    chainId,
    accounts,
    isConnected,
    ethersSigner,
  };
};
