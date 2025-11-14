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
import { ethers, JsonRpcProvider } from "ethers";
import { getParsedErrorWithAllAbis, type Contract } from "~~/utils/helper/contract";
import type { AllowedChainIds } from "~~/utils/helper/networks";
import { useReadContract } from "wagmi";
import { MysteryDoors__factory } from "~~/typechain-types";
import { getRevertData } from "~~/utils/helper/getRevertData";

type ClearGuess = {
  handle: string;
  clear: bigint;
}

type GuessesRequest = {
  handle: string;
  contractAddress: `0x${string}`;
}

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
  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner, ethersProvider, rpcProvider } = useWagmiEthers(initialMockChains);

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
    console.log(providerOrSigner);
    if (!providerOrSigner) return undefined;
    return new ethers.Contract(
      mysteryDoors!.address,
      (mysteryDoors as MysteryDoorsInfo).abi,
      providerOrSigner,
    );
  };

  // Read playersCorrectGuesses handle via wagmi
  const readPlayersCorrectGuessesResult = useReadContract({
    address: (hasContract ? (mysteryDoors!.address as unknown as `0x${string}`) : undefined) as
      | `0x${string}`
      | undefined,
    abi: (hasContract ? ((mysteryDoors as MysteryDoorsInfo).abi as any) : undefined) as any,
    functionName: "getPlayersCorrectGuesses" as const,
    query: {
      enabled: Boolean(hasContract && hasProvider),
      refetchOnWindowFocus: false,
    },
  });

  const playersCorrectGuessesHandle = useMemo(() => (readPlayersCorrectGuessesResult.data as [string[], string[], string[]] | undefined) ?? undefined, [readPlayersCorrectGuessesResult.data]);
  const canGetPlayersCorrectGuesses = Boolean(hasContract && hasProvider && !readPlayersCorrectGuessesResult.isFetching);
  const refreshPlayersCorrectGuessesHandle = useCallback(async () => {
    const res = await readPlayersCorrectGuessesResult.refetch();
    if (res.error) setMessage("MysteryDoors.getPlayersCorrectGuesses() failed: " + (res.error as Error).message);
  }, [readPlayersCorrectGuessesResult]);

  // Read getGuesses handle via wagmi
  const readGetGuesses = useReadContract({
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

  const guessesHandles = useMemo(() => (readGetGuesses.data as string[] | undefined) ?? undefined, [readGetGuesses.data]);
  const canGetGuesses = Boolean(hasContract && hasProvider && !readGetGuesses.isFetching);
  const refreshGuessesHandle = useCallback(async () => {
    console.log("refreshing guesses handle");
    const res = await readGetGuesses.refetch();
    if (res.error) setMessage("MysteryDoors.getGuesses() failed: " + (res.error as Error).message);
  }, [readGetGuesses]);
  // derive isRefreshing from wagmi
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _derivedIsRefreshing = readGetGuesses.isFetching;

  // Wagmi handles initial fetch via `enabled`

  // Decrypt (reuse existing decrypt hook for simplicity)
  const guessesRequests = useMemo(() => {
    if (!hasContract || !guessesHandles || guessesHandles.length === 0 || guessesHandles[0] === ethers.ZeroHash) return undefined;
    console.log(guessesHandles);
    return guessesHandles.map(guessesHandle => ({ handle: guessesHandle, contractAddress: (mysteryDoors?.address as unknown as `0x${string}`) })) as GuessesRequest[];
  }, [hasContract, mysteryDoors?.address, guessesHandles]);

  const {
    canDecrypt: canDecryptGuesses,
    decrypt: decryptGuessesHandles,
    isDecrypting: isDecryptingGuesses,
    message: decMsg,
    results: guessesResults,
  } = useFHEDecrypt({
    instance,
    ethersSigner: ethersSigner as any,
    fhevmDecryptionSignatureStorage,
    chainId,
    requests: guessesRequests,
  });

  useEffect(() => {
    if (decMsg) setMessage(decMsg);
  }, [decMsg]);

  // Read getGuesses handle via wagmi
  const readOwner = useReadContract({
    address: (hasContract ? (mysteryDoors!.address as unknown as `0x${string}`) : undefined) as
      | `0x${string}`
      | undefined,
    abi: (hasContract ? ((mysteryDoors as MysteryDoorsInfo).abi as any) : undefined) as any,
    functionName: "owner",
    query: {
      enabled: Boolean(hasContract && hasProvider),
      refetchOnWindowFocus: false,
    },
  });
  const checkIsOwner = useMemo(() => {
    ;
    const { error, data } = readOwner;
    if (error) {
      setMessage("Contract info or signer not available");
      return false;
    }
    const owner = data;
    const walletAddress = accounts?.[0];
    const checkOwnership = owner === walletAddress;
    return checkOwnership;

  }, [readOwner.data, accounts]);

  const refreshOwner = useCallback(async () => {
    console.log("refreshing owner");
    const res = await readOwner.refetch();
    if (res.error) setMessage("MysteryDoors.owner() failed: " + (res.error as Error).message);
  }, [readGetGuesses]);

  const clearGuesses = useMemo(() => {
    if (!guessesHandles || guessesHandles.length === 0) return undefined;
    if (guessesHandles[0] === ethers.ZeroHash) return guessesHandles.map(guessesHandle => (BigInt(0))) as BigInt[];

    const decryptedGuesses = guessesHandles.map(guessesHandle => (guessesResults[guessesHandle])) as BigInt[];
    const firstClear = decryptedGuesses[0];
    if (typeof firstClear === "undefined") return undefined;
    return decryptedGuesses;
  }, [guessesHandles, guessesResults]);

  const isGuessesDecrypted = Boolean(guessesHandles && clearGuesses && clearGuesses.length > 0 && clearGuesses[0] as unknown as string === guessesHandles[0]);


  // Mutations (increment/decrement)
  const { encryptWith } = useFHEEncryption({ instance, ethersSigner: ethersSigner as any, contractAddress: mysteryDoors?.address });
  const canUpdate = useMemo(
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
      if (isProcessing || !canUpdate || guesses.length === 0) return;
      const functionName = "makeGuesses";
      const encSig = guesses.join(", ");
      setIsProcessing(true);
      setMessage(`Starting ${functionName}(${encSig})...`);
      try {
        const { methods, error } = getEncryptionMethodFor(functionName);
        if (!methods) return setMessage(error ?? "Encryption method not found");

        setMessage(`Encrypting inputs with ${methods.join(", ")}...`);
        const enc = await encryptWith(builder => {
          const chained = methods.reduce((acc: RelayerEncryptedInput, method: string, index: number,) => {
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
        try {
          const tx = await (writeContract.makeGuesses(...params));
          setMessage("Waiting for transaction...");
          await tx.wait();
          setMessage(`${functionName}(${encSig}) completed!`);
          refreshGuessesHandle();
        }
        catch (e) {
          const walletAddress = accounts?.[0] as string;
          const revertMsg = await getRevertData(writeContract, functionName, params, walletAddress, rpcProvider, chainId as AllowedChainIds);
          if (revertMsg !== "") {
            setMessage(`${functionName} failed: ${revertMsg}`);
          } else {
            setMessage(`${functionName} failed: ${e instanceof Error ? e.message : String(e)}`);
          }

        }
      } catch (e) {
        setMessage(`${functionName} failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, canUpdate, encryptWith, getContract, mysteryDoors?.abi],
  );

  const callJoinGame = useCallback(
    async (playerName: string) => {
      if (isProcessing || !canUpdate || playerName.length === 0) return;
      const functionName = "joinGame";
      setMessage(`Calling ${functionName}`);

      const writeContract = getContract("write");
      if (!writeContract) return setMessage("Contract info or signer not available");
      try {
        const tx = await writeContract.joinGame(playerName);
        setMessage("Waiting for transaction...");
        await tx.wait();
        setMessage(`${functionName}(${playerName}) completed!`);
      } catch (e) {
        console.log(e);
        const walletAddress = accounts?.[0] as string;
        const revertMsg = await getRevertData(writeContract, functionName, [playerName], walletAddress, rpcProvider, chainId as AllowedChainIds);
        if (revertMsg !== "") {
          setMessage(`${functionName} failed: ${revertMsg}`);
        } else {
          setMessage(`${functionName} failed: ${e instanceof Error ? e.message : String(e)}`);
        }

      } finally {
        setIsProcessing(false);
      }
    },
    [getContract, mysteryDoors?.abi],
  );



  return {
    contractAddress: mysteryDoors?.address,
    checkIsOwner,
    canDecryptGuesses,
    canGetGuesses,
    canUpdate,
    callMakeGuesses,
    callJoinGame,
    decryptGuessesHandles,
    refreshOwner,
    refreshGuessesHandle,
    refreshPlayersCorrectGuessesHandle,
    isGuessesDecrypted,
    clearGuesses,
    message,
    handle: guessesHandles,
    isDecryptingGuesses,
    isRefreshing,
    isProcessing,
    // Wagmi-specific values
    chainId,
    accounts,
    isConnected,
    ethersSigner,
  };
};
