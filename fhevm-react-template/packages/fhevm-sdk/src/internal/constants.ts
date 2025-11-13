import testnetDevConfigRaw from "../testnet_config.json";
import testnetBlueConfigRaw from "../testnet_blue_config.json";

import { FhevmInstanceConfig } from "../fhevmTypes";


export const SDK_CDN_URL =
  "https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs";



type TestnetConfig = {
  jsonRpcUrl: string
  relayerUrl: string
  gatewayChainId: number
  aclContractAddress: string
  fhevmExecutorContractAddress: string
  kmsVerifierContractAddress: string
  decryptionOracleContractAddress: string
  inputVerifierContractAddress: string
  inputVerificationContractAddress: string
  decryptionContractAddress: string
}

export function createTestnetFhevmInstanceConfig(isOptalysysBlue: boolean = false): FhevmInstanceConfig {
  const testnetConfigRaw = isOptalysysBlue ? testnetBlueConfigRaw : testnetDevConfigRaw;
  const testnetConfig: TestnetConfig = {
    jsonRpcUrl: testnetConfigRaw.json_rpc_url,
    relayerUrl: testnetConfigRaw.relayer_url,
    gatewayChainId: Number.parseInt(testnetConfigRaw.gateway_chain_id),
    aclContractAddress: testnetConfigRaw.acl_contract_address,
    fhevmExecutorContractAddress: testnetConfigRaw.fhevm_executor_contract_address,
    kmsVerifierContractAddress: testnetConfigRaw.kms_verifier_contract_address,
    decryptionOracleContractAddress: testnetConfigRaw.decryption_oracle_contract_address,
    inputVerifierContractAddress: testnetConfigRaw.input_verifier_contract_address,
    inputVerificationContractAddress: testnetConfigRaw.input_verification_contract_address,
    decryptionContractAddress: testnetConfigRaw.decryption_contract_address
  };

  const relayerUrl = buildUrlPath(getDeploymentHostName(false), testnetConfigRaw.relayer_url);
  const jsonRpcUrl = buildUrlPath(getDeploymentHostName(false), testnetConfigRaw.json_rpc_url);


  return {
    verifyingContractAddressDecryption: testnetConfig.decryptionContractAddress,
    verifyingContractAddressInputVerification: testnetConfig.inputVerificationContractAddress,
    inputVerifierContractAddress: testnetConfig.inputVerifierContractAddress,
    kmsContractAddress: testnetConfig.kmsVerifierContractAddress,
    aclContractAddress: testnetConfig.aclContractAddress,
    gatewayChainId: testnetConfig.gatewayChainId,
    relayerUrl: relayerUrl,
    network: jsonRpcUrl
  };

}

export const OPTALYSYS_DEV_CHAIN_ID = 678259798;
export const OPTALYSYS_BLUE_CHAIN_ID = 678259799;

export function isTestnet(chainId: number): boolean {
  return chainId === OPTALYSYS_DEV_CHAIN_ID;
}
export function isBlueTestnet(chainId: number): boolean {
  return chainId === OPTALYSYS_BLUE_CHAIN_ID;
}

export function getDeploymentHostName(customDomainForProduction: boolean) {
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development';
  // console.log('ENV: ', env);
  let deploymentUrl;
  if (env === 'development') {
    deploymentUrl = 'localhost:3000'; // your local hostname and port
    // if using webhooks proxy tunnels:
    // deploymentUrl = process.env.NGROK_URL ?? 'localhost:3000';
  } else if (env === 'production') {
    deploymentUrl = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ?? '';
  } else {
    deploymentUrl = process.env.NEXT_PUBLIC_VERCEL_BRANCH_URL ?? '';
  }
  console.log('ENV: ', { env, deploymentUrl, vercel: process.env.NEXT_PUBLIC_VERCEL_URL });

  if (deploymentUrl === '') {
    throw new Error('Deployment URL couldn\'t be determined');
  }
  return deploymentUrl;
}

export function buildUrlPath(urlBase: string, path: string): string {
  const result = [urlBase, path].map((s) => trimSlash(s)).join('/');

  if (urlBase.startsWith('/')) {
    return `/${result}`;
  } else if (urlBase.startsWith('http')) {
    return result;
  } else {
    return `https://${result}`;
  }
}
function trimSlash(s: string): string {
  // trim leading and trailing slashes
  return s.replace(/^\/+|\/+$/g, '');
}

