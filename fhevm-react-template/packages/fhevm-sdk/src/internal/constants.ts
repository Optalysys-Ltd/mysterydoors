import testnetConfigRaw from "../testnet_config.json";
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

export function createTestnetFhevmInstanceConfig(): FhevmInstanceConfig {
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

  return {
    verifyingContractAddressDecryption: testnetConfig.decryptionContractAddress,
    verifyingContractAddressInputVerification: testnetConfig.inputVerificationContractAddress,
    inputVerifierContractAddress: testnetConfig.inputVerifierContractAddress,
    kmsContractAddress: testnetConfig.kmsVerifierContractAddress,
    aclContractAddress: testnetConfig.aclContractAddress,
    gatewayChainId: testnetConfig.gatewayChainId,
    relayerUrl: testnetConfig.relayerUrl,
    network: testnetConfig.jsonRpcUrl
  };

}