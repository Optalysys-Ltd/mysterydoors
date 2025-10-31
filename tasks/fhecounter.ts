import * as fs from "fs"
import { task } from 'hardhat/config'
import type { TaskArguments } from 'hardhat/types'
import { loadWallet, timestampLog, loadTestnetConfig, createInstance, setupUserDecrypt } from "./utils"
import { FHECounter__factory } from "../typechain-types/factories/contracts/FHECounter__factory";
import { FHECounter } from "../typechain-types/contracts/FHECounter";
import { HDNodeWallet } from "ethers";


task('task:deployFheCounter')
    .addParam('configFile', 'JSON file to read testnet config from')
    .addParam('addressFile', 'File to write address of deployed contract to')
    .addParam('keyFile', 'Encrypted key to sign transactions')
    .setAction(async function (taskArguments: TaskArguments, { ethers }) {
        timestampLog("Loading wallet")
        const wallet = await loadWallet(taskArguments.keyFile)
        timestampLog("Loading testnet config")
        const testnetConfig = await loadTestnetConfig(taskArguments.configFile)
        timestampLog("Connecting wallet")
        const connectedWallet = wallet.connect(ethers.getDefaultProvider(testnetConfig.jsonRpcUrl))
        timestampLog("Deploying contract")
        const contract = await new FHECounter__factory(connectedWallet).deploy(
            ethers.getAddress(testnetConfig.aclContractAddress),
            ethers.getAddress(testnetConfig.fhevmExecutorContractAddress),
            ethers.getAddress(testnetConfig.kmsVerifierContractAddress),
            ethers.getAddress(testnetConfig.decryptionOracleContractAddress),
        )
        timestampLog("Waiting for deployment...")
        const receipt = await (await contract.waitForDeployment()).deploymentTransaction()?.wait()
        timestampLog("Contract deployed at block: " + receipt?.blockNumber)
        timestampLog("Contract address: " + receipt?.contractAddress)
        fs.writeFileSync(taskArguments.addressFile, receipt?.contractAddress as string)
        timestampLog("Contract address written to file: " + taskArguments.addressFile)
    })


task('task:incrementFheCounter')
    .addParam('input', 'Amount to increment')
    .addParam('inputFile', 'File to write encrypted input and zkproof to')
    .addParam('configFile', 'JSON file to read testnet config from')
    .addParam('addressFile', 'File to read address of deployed contract from')
    .addParam('keyFile', 'Encrypted key to derive user address from')
    .setAction(async function (taskArguments: TaskArguments) {
        timestampLog("Loading wallet")
        const wallet = await loadWallet(taskArguments.keyFile)
        timestampLog("Loading contract address")
        const contractAddress = await fs.promises.readFile(taskArguments.addressFile, 'utf8')
        timestampLog("Loading testnet config")
        const testnetConfig = await loadTestnetConfig(taskArguments.configFile)
        timestampLog("Instantiating fhevm instance")
        const fhevmInstance = await createInstance(
            testnetConfig.decryptionContractAddress,
            testnetConfig.inputVerificationContractAddress,
            testnetConfig.inputVerifierContractAddress,
            testnetConfig.kmsVerifierContractAddress,
            testnetConfig.aclContractAddress,
            testnetConfig.gatewayChainId,
            testnetConfig.relayerUrl,
            testnetConfig.jsonRpcUrl,
        )
        timestampLog("Encrypting...")
        const encryptedInput = await (fhevmInstance.createEncryptedInput(contractAddress, wallet.address)
            .add32(Number(taskArguments.input)).encrypt())
        timestampLog("Input encrypted")
        fs.writeFileSync(
            taskArguments.inputFile,
            JSON.stringify(
                encryptedInput,
                (_, value) => {
                    if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
                        return Buffer.from(value).toJSON()
                    }
                    return value
                }
            )
        )
        timestampLog("Encrypted input and ZK proof written to: " + taskArguments.inputFile)
    })


task('task:callIncrementFheCounter')
    .addParam('inputFile', 'File to read encrypted input and zkproof from')
    .addParam('configFile', 'JSON file to read testnet config from')
    .addParam('addressFile', 'File to read address of deployed contract from')
    .addParam('keyFile', 'Encrypted key to derive user address from')
    .setAction(async function (taskArguments: TaskArguments, { ethers }) {
        timestampLog("Loading wallet")
        const wallet = await loadWallet(taskArguments.keyFile)
        timestampLog("Loading contract address")
        const contractAddress = await fs.promises.readFile(taskArguments.addressFile, 'utf8')
        timestampLog("Loading testnet config")
        const testnetConfig = await loadTestnetConfig(taskArguments.configFile)
        timestampLog("Loading encrypted input and zkproof")
        const encryptedInput = JSON.parse(
            new String(fs.readFileSync(taskArguments.inputFile)).toString(),
            (_, value) => {
                if (typeof value == "object" && 'type' in value && value.type == "Buffer") {
                    return new Uint8Array(value.data)
                }
                return value
            }
        ) as { handles: Uint8Array<ArrayBufferLike>[]; inputProof: Uint8Array }
        timestampLog("Connecting wallet")
        const connectedWallet = wallet.connect(ethers.getDefaultProvider(testnetConfig.jsonRpcUrl))
        timestampLog("Connecting to contract")
        const contract = new FHECounter__factory(connectedWallet).attach(contractAddress) as FHECounter
        timestampLog("Calling increment on contract")
        const txResponse = await contract.increment(encryptedInput.handles[0], encryptedInput.inputProof)
        timestampLog("Transaction hash: " + txResponse.hash)
        timestampLog("Waiting for transaction to be included in block...")
        const txReceipt = await txResponse.wait()
        timestampLog("Transaction receipt received. Block number: " + txReceipt?.blockNumber)
    })

task('task:decryptFheCounter')
    .addParam('configFile', 'JSON file to read testnet config from')
    .addParam('addressFile', 'File to read address of deployed contract from')
    .addParam('keyFile', 'Encrypted key to derive user address from')
    .setAction(async function (taskArguments: TaskArguments, { ethers }) {
        timestampLog("Loading wallet")
        const wallet = await loadWallet(taskArguments.keyFile)
        timestampLog("Loading contract address")
        const contractAddress = await fs.promises.readFile(taskArguments.addressFile, 'utf8')
        timestampLog("Loading testnet config")
        const testnetConfig = await loadTestnetConfig(taskArguments.configFile);
        timestampLog("Instantiating fhevm instance")
        const fhevmInstance = await createInstance(
            testnetConfig.decryptionContractAddress,
            testnetConfig.inputVerificationContractAddress,
            testnetConfig.inputVerifierContractAddress,
            testnetConfig.kmsVerifierContractAddress,
            testnetConfig.aclContractAddress,
            testnetConfig.gatewayChainId,
            testnetConfig.relayerUrl,
            testnetConfig.jsonRpcUrl,
        )
        timestampLog("Connecting wallet")
        const connectedWallet = wallet.connect(ethers.getDefaultProvider(testnetConfig.jsonRpcUrl)) as HDNodeWallet;
        timestampLog("Connecting to contract")
        const contract = new FHECounter__factory(connectedWallet).attach(contractAddress) as FHECounter
        timestampLog("Calling getCount on contract to get ciphertext handle")
        const handle = await contract.getCount();
        timestampLog("Requesting decryption...")
        const decryptedCount = await setupUserDecrypt(fhevmInstance, connectedWallet, handle, contractAddress);
        timestampLog("Decrypted count: " + decryptedCount);
    })