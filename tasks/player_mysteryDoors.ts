import * as fs from "fs"
import { task, types } from 'hardhat/config'
import type { TaskArguments } from 'hardhat/types'
import { loadWallet, timestampLog, loadTestnetConfig, createInstance, setupUserDecrypt, Coord } from "./utils"
import { MysteryDoors, MysteryDoors__factory } from "../typechain-types";
import { HDNodeWallet } from "ethers";

task('task:joinMysteryDoors')
    .addParam('name', 'Your name to identify you in the Mystery Doors game')
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
        const playerName = taskArguments.name;
        timestampLog(`Calling joinGame on contract with name ${playerName}`);
        const txResponse = await contract.joinGame(playerName);
        timestampLog("Transaction hash: " + txResponse.hash)
        timestampLog("Waiting for transaction to be included in block...")
        const txReceipt = await txResponse.wait()
        timestampLog("Transaction receipt received. Block number: " + txReceipt?.blockNumber)
    });

task('task:encryptOccupiedGuesses')
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
        const occupiedPositionsGuesses: number[] = [taskArguments.p1, taskArguments.p2, taskArguments.p3, taskArguments.p4, taskArguments.p5];

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
        input.add8(occupiedPositionsGuesses[0]);
        input.add8(occupiedPositionsGuesses[1]);
        input.add8(occupiedPositionsGuesses[2]);
        input.add8(occupiedPositionsGuesses[3]);
        input.add8(occupiedPositionsGuesses[4]);
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


task('task:callMakeGuesses')
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
        timestampLog("Calling makeGuesses contract")
        const txResponse = await contract.makeGuesses(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2], encryptedInput.handles[3], encryptedInput.handles[4], encryptedInput.inputProof);
        timestampLog("Transaction hash: " + txResponse.hash)
        timestampLog("Waiting for transaction to be included in block...")
        const txReceipt = await txResponse.wait()
        timestampLog("Transaction receipt received. Block number: " + txReceipt?.blockNumber)
    })

task('task:getCorrectGuesses')
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
        timestampLog("Calling getCorrectGuesses on contract")
        const eCorrectGuesses = await contract.getCorrectGuesses();
        if (eCorrectGuesses == ethers.ZeroHash) {
            throw new Error("The handle hasn't been initialized yet!")
        } else {
        timestampLog("Requesting decryption...")
        const decryptedHandles = await setupUserDecrypt(fhevmInstance, connectedWallet, [eCorrectGuesses], contractAddress);
        const correctGuesses = decryptedHandles[eCorrectGuesses];
        timestampLog(`Decrypted number of correct guesses: ${correctGuesses}`);
        }
    });

task('task:getGuesses')
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
        const contract = new MysteryDoors__factory(connectedWallet).attach(contractAddress) as MysteryDoors;
        timestampLog("Calling getGuesses on contract to get ciphertext handles")
        const ePlayerGuesses = await contract.getGuesses();
        timestampLog("Requesting decryption...")
        const dPlayerGuesses = await setupUserDecrypt(fhevmInstance, connectedWallet, ePlayerGuesses, contractAddress);
        const dPlayerGuessesList: number[] = [];
        for (let key in dPlayerGuesses) {
            dPlayerGuessesList.push(dPlayerGuesses[key] as bigint as unknown as number);
        }
        timestampLog("Decrypted player guesses: ");
        console.log(dPlayerGuessesList);
    })

task('task:getOccupiedPositions')
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