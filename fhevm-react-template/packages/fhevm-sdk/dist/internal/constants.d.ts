import { FhevmInstanceConfig } from "../fhevmTypes";
export declare const SDK_CDN_URL = "https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs";
export declare function createTestnetFhevmInstanceConfig(isOptalysysBlue?: boolean): FhevmInstanceConfig;
export declare const OPTALYSYS_DEV_CHAIN_ID = 678259798;
export declare const OPTALYSYS_BLUE_CHAIN_ID = 678259799;
export declare function isTestnet(chainId: number): boolean;
export declare function isBlueTestnet(chainId: number): boolean;
export declare function getDeploymentHostName(customDomainForProduction: boolean): string;
export declare function buildUrlPath(urlBase: string, path: string): string;
