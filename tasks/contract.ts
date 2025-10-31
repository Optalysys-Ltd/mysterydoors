import * as fs from "fs"
import { task } from 'hardhat/config'
import type { TaskArguments } from 'hardhat/types'
import { loadWallet, timestampLog, loadTestnetConfig } from "./utils"
import { Test__factory as TestFactory } from "../typechain-types/factories/contracts/Simple.sol/Test__factory"

task('task:deployTest')
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
        const contract = await new TestFactory(connectedWallet).deploy(
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
