import { isAddress, JsonRpcProvider } from "ethers";
import { isFhevmWindowType, RelayerSDKLoader } from "./RelayerSDKLoader";
import { publicKeyStorageGet, publicKeyStorageSet } from "./PublicKeyStorage";
import { createTestnetFhevmInstanceConfig, isBlueTestnet, isTestnet } from "./constants";
export class FhevmReactError extends Error {
    code;
    constructor(code, message, options) {
        super(message, options);
        this.code = code;
        this.name = "FhevmReactError";
    }
}
function throwFhevmError(code, message, cause) {
    throw new FhevmReactError(code, message, cause ? { cause } : undefined);
}
const isFhevmInitialized = () => {
    if (!isFhevmWindowType(window, console.log)) {
        return false;
    }
    return window.relayerSDK.__initialized__ === true;
};
const fhevmLoadSDK = () => {
    const loader = new RelayerSDKLoader({ trace: console.log });
    return loader.load();
};
const fhevmInitSDK = async (options) => {
    if (!isFhevmWindowType(window, console.log)) {
        throw new Error("window.relayerSDK is not available");
    }
    const result = await window.relayerSDK.initSDK(options);
    window.relayerSDK.__initialized__ = result;
    if (!result) {
        throw new Error("window.relayerSDK.initSDK failed.");
    }
    return true;
};
function checkIsAddress(a) {
    if (typeof a !== "string") {
        return false;
    }
    if (!isAddress(a)) {
        return false;
    }
    return true;
}
export class FhevmAbortError extends Error {
    constructor(message = "FHEVM operation was cancelled") {
        super(message);
        this.name = "FhevmAbortError";
    }
}
async function getChainId(providerOrUrl) {
    if (typeof providerOrUrl === "string") {
        const provider = new JsonRpcProvider(providerOrUrl);
        return Number((await provider.getNetwork()).chainId);
    }
    const chainId = await providerOrUrl.request({ method: "eth_chainId" });
    return Number.parseInt(chainId, 16);
}
async function getWeb3Client(rpcUrl) {
    const rpc = new JsonRpcProvider(rpcUrl);
    try {
        const version = await rpc.send("web3_clientVersion", []);
        return version;
    }
    catch (e) {
        throwFhevmError("WEB3_CLIENTVERSION_ERROR", `The URL ${rpcUrl} is not a Web3 node or is not reachable. Please check the endpoint.`, e);
    }
    finally {
        rpc.destroy();
    }
}
async function tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl) {
    const version = await getWeb3Client(rpcUrl);
    if (typeof version !== "string" ||
        !version.toLowerCase().includes("hardhat")) {
        // Not a Hardhat Node
        return undefined;
    }
    try {
        const metadata = await getFHEVMRelayerMetadata(rpcUrl);
        if (!metadata || typeof metadata !== "object") {
            return undefined;
        }
        if (!("ACLAddress" in metadata &&
            typeof metadata.ACLAddress === "string" &&
            metadata.ACLAddress.startsWith("0x"))) {
            return undefined;
        }
        if (!("InputVerifierAddress" in metadata &&
            typeof metadata.InputVerifierAddress === "string" &&
            metadata.InputVerifierAddress.startsWith("0x"))) {
            return undefined;
        }
        if (!("KMSVerifierAddress" in metadata &&
            typeof metadata.KMSVerifierAddress === "string" &&
            metadata.KMSVerifierAddress.startsWith("0x"))) {
            return undefined;
        }
        return metadata;
    }
    catch {
        // Not a FHEVM Hardhat Node
        return undefined;
    }
}
async function getFHEVMRelayerMetadata(rpcUrl) {
    const rpc = new JsonRpcProvider(rpcUrl);
    try {
        const version = await rpc.send("fhevm_relayer_metadata", []);
        return version;
    }
    catch (e) {
        throwFhevmError("FHEVM_RELAYER_METADATA_ERROR", `The URL ${rpcUrl} is not a FHEVM Hardhat node or is not reachable. Please check the endpoint.`, e);
    }
    finally {
        rpc.destroy();
    }
}
async function resolve(providerOrUrl, mockChains) {
    // Resolve chainId
    const chainId = await getChainId(providerOrUrl);
    // Resolve rpc url
    let rpcUrl = typeof providerOrUrl === "string" ? providerOrUrl : undefined;
    const _mockChains = {
        31337: "http://localhost:8545",
        ...(mockChains ?? {}),
    };
    // Help Typescript solver here:
    if (Object.hasOwn(_mockChains, chainId)) {
        if (!rpcUrl) {
            rpcUrl = _mockChains[chainId];
        }
        return { isMock: true, chainId, rpcUrl };
    }
    return { isMock: false, chainId, rpcUrl };
}
export const createFhevmInstance = async (parameters) => {
    const throwIfAborted = () => {
        if (signal.aborted)
            throw new FhevmAbortError();
    };
    const notify = (status) => {
        if (onStatusChange)
            onStatusChange(status);
    };
    const { signal, onStatusChange, provider: providerOrUrl, mockChains, } = parameters;
    // Resolve chainId
    const { isMock, rpcUrl, chainId } = await resolve(providerOrUrl, mockChains);
    console.log("[createFhevmInstance] isMock:", isMock, rpcUrl, chainId);
    if (isMock) {
        // Throws an error if cannot connect or url does not refer to a Web3 client
        const fhevmRelayerMetadata = await tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl);
        if (fhevmRelayerMetadata) {
            // fhevmRelayerMetadata is defined, which means rpcUrl refers to a FHEVM Hardhat Node
            notify("creating");
            //////////////////////////////////////////////////////////////////////////
            // 
            // WARNING!!
            // ALWAY USE DYNAMIC IMPORT TO AVOID INCLUDING THE ENTIRE FHEVM MOCK LIB 
            // IN THE FINAL PRODUCTION BUNDLE!!
            // 
            //////////////////////////////////////////////////////////////////////////
            const fhevmMock = await import("./mock/fhevmMock");
            const mockInstance = await fhevmMock.fhevmMockCreateInstance({
                rpcUrl,
                chainId,
                metadata: fhevmRelayerMetadata,
            });
            throwIfAborted();
            return mockInstance;
        }
    }
    throwIfAborted();
    if (!isFhevmWindowType(window, console.log)) {
        notify("sdk-loading");
        // throws an error if failed
        await fhevmLoadSDK();
        throwIfAborted();
        notify("sdk-loaded");
    }
    // notify that state === "sdk-loaded"
    if (!isFhevmInitialized()) {
        notify("sdk-initializing");
        // throws an error if failed
        await fhevmInitSDK();
        throwIfAborted();
        notify("sdk-initialized");
    }
    const relayerSDK = window.relayerSDK;
    let aclAddress = relayerSDK.SepoliaConfig.aclContractAddress;
    const isOptalysysDev = isTestnet(chainId);
    const isOptalysysBlue = isBlueTestnet(chainId);
    console.log(`isOptalysysDev: ${isOptalysysDev}, isOptalysysBlue: ${isOptalysysBlue}`);
    const testnetConfig = createTestnetFhevmInstanceConfig(isOptalysysBlue);
    console.log(testnetConfig);
    if (isOptalysysDev || isOptalysysBlue) {
        aclAddress = testnetConfig.aclContractAddress;
    }
    if (!checkIsAddress(aclAddress)) {
        throw new Error(`Invalid address: ${aclAddress}`);
    }
    const pub = await publicKeyStorageGet(aclAddress);
    throwIfAborted();
    let config = {
        ...relayerSDK.SepoliaConfig,
        network: providerOrUrl,
        publicKey: pub.publicKey,
        publicParams: pub.publicParams,
    };
    console.log(providerOrUrl);
    if (isOptalysysDev || isOptalysysBlue) {
        const optalysysConfig = {
            ...testnetConfig,
            publicKey: pub.publicKey,
            publicParams: pub.publicParams,
        };
        config = optalysysConfig;
    }
    // notify that state === "creating"
    notify("creating");
    const instance = await relayerSDK.createInstance(config);
    console.log(instance);
    // Save the key even if aborted
    await publicKeyStorageSet(aclAddress, instance.getPublicKey(), instance.getPublicParams(2048));
    throwIfAborted();
    return instance;
};
