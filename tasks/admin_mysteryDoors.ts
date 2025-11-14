import * as fs from "fs"
import { task, types } from 'hardhat/config'
import type { TaskArguments } from 'hardhat/types'
import { loadWallet, timestampLog, loadTestnetConfig, createInstance, setupUserDecrypt, Coord } from "./utils"
import { MysteryDoors, MysteryDoors__factory } from "../typechain-types";
import { HDNodeWallet } from "ethers";


task('task:adminDeployMysteryDoors')
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
        const contract = await new MysteryDoors__factory(connectedWallet).deploy(
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


task('task:adminEncryptOccupiedPositions')
    .addParam('p1', 'position #1 in the range 1-25', null, types.int, true)
    .addParam('p2', 'position #2 in the range 1-25', null, types.int, true)
    .addParam('p3', 'position #3 in the range 1-25', null, types.int, true)
    .addParam('p4', 'position #4 in the range 1-25', null, types.int, true)
    .addParam('p5', 'position #5 in the range 1-25', null, types.int, true)
    .addParam('inputFile', 'File to write encrypted input and zkproof to')
    .addParam('configFile', 'JSON file to read testnet config from')
    .addParam('addressFile', 'File to read address of deployed contract from')
    .addParam('keyFile', 'Encrypted key to derive user address from')
    .setAction(async function (taskArguments: TaskArguments) {
        const occupiedPositions: number[] = [taskArguments.p1, taskArguments.p2, taskArguments.p3, taskArguments.p4, taskArguments.p5];
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
        const input = fhevmInstance.createEncryptedInput(contractAddress, wallet.address);
        input.add8(occupiedPositions[0]);
        input.add8(occupiedPositions[1]);
        input.add8(occupiedPositions[2]);
        input.add8(occupiedPositions[3]);
        input.add8(occupiedPositions[4]);
        const encryptedInput = await input.encrypt();
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


task('task:adminCallMarkOccupied')
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
        const contract = new MysteryDoors__factory(connectedWallet).attach(contractAddress) as MysteryDoors
        timestampLog("Calling markOccupied on contract")
        const txResponse = await contract.markOccupied(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2], encryptedInput.handles[3], encryptedInput.handles[4], encryptedInput.inputProof);
        timestampLog("Transaction hash: " + txResponse.hash)
        timestampLog("Waiting for transaction to be included in block...")
        const txReceipt = await txResponse.wait()
        timestampLog("Transaction receipt received. Block number: " + txReceipt?.blockNumber)
    })

task('task:adminStartMysteryDoors')
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
        timestampLog("Connecting wallet")
        const connectedWallet = wallet.connect(ethers.getDefaultProvider(testnetConfig.jsonRpcUrl))
        timestampLog("Connecting to contract")
        const contract = new MysteryDoors__factory(connectedWallet).attach(contractAddress) as MysteryDoors
        timestampLog("Calling startGame on contract")
        const txResponse = await contract.startGame();
        timestampLog("Transaction hash: " + txResponse.hash)
        timestampLog("Waiting for transaction to be included in block...")
        const txReceipt = await txResponse.wait()
        timestampLog("Transaction receipt received. Block number: " + txReceipt?.blockNumber)
    });

task('task:adminEndMysteryDoors')
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
        timestampLog("Connecting wallet")
        const connectedWallet = wallet.connect(ethers.getDefaultProvider(testnetConfig.jsonRpcUrl))
        timestampLog("Connecting to contract")
        const contract = new MysteryDoors__factory(connectedWallet).attach(contractAddress) as MysteryDoors
        timestampLog("Calling endGame on contract")
        const txResponse = await contract.endGame();
        timestampLog("Transaction hash: " + txResponse.hash)
        timestampLog("Waiting for transaction to be included in block...")
        const txReceipt = await txResponse.wait()
        timestampLog("Transaction receipt received. Block number: " + txReceipt?.blockNumber)
    });

task('task:adminGetOccupiedPositions')
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
        const contract = new MysteryDoors__factory(connectedWallet).attach(contractAddress) as MysteryDoors
        timestampLog("Calling getOccupiedPositions on contract to get ciphertext handles")
        const occupiedPositionsHandles = await contract.getOccupiedPositions();
        timestampLog("Requesting decryption...")
        const decryptedHandles = await fhevmInstance.publicDecrypt(occupiedPositionsHandles);
        const dOccupiedPositions: number[] = [];
        for (let key in decryptedHandles) {
            const decryptedValue = decryptedHandles[key];
            dOccupiedPositions.push(decryptedValue as bigint as unknown as number);
        }
        timestampLog("Decrypted occupied positions: ");
        console.log(dOccupiedPositions);
    })

task('task:adminGetLeaderboard')
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
        const contract = new MysteryDoors__factory(connectedWallet).attach(contractAddress) as MysteryDoors
        timestampLog("Calling collateLeaderBoard on contract")
        await contract.connect(connectedWallet).collateLeaderboard();
        timestampLog("Calling getPlayersCorrectGuesses on contract to get ciphertext handles")
        const [playersList, ePlayerCorrectGuessesList, playerNamesList] = await contract.connect(connectedWallet).getPlayersCorrectGuesses();
        timestampLog("Decrypting handles ePlayerCorrectGuesses");
        if (ePlayerCorrectGuessesList.length > 0) {
            const result = await setupUserDecrypt(fhevmInstance, connectedWallet, ePlayerCorrectGuessesList, contractAddress);
            timestampLog("Result:");
            const playerNumCorrectGuesses: Record<string, number> = {};
            let handleIndex = 0;
            for (const key in result) {
                playerNumCorrectGuesses[`${playersList[handleIndex]}: ${playerNamesList[handleIndex]}`] = result[key] as bigint as unknown as number;
                handleIndex++;
            }
            console.log(playerNumCorrectGuesses);
        }
        else {
            timestampLog("No players yet!");
        }
    })