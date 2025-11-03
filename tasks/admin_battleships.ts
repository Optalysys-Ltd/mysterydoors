import * as fs from "fs"
import { task } from 'hardhat/config'
import type { TaskArguments } from 'hardhat/types'
import { loadWallet, timestampLog, loadTestnetConfig, createInstance, setupUserDecrypt, Coord } from "./utils"
import { Battleships, Battleships__factory } from "../typechain-types";
import { HDNodeWallet } from "ethers";


task('task:adminDeployBattleships')
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
        const contract = await new Battleships__factory(connectedWallet).deploy(
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


task('task:adminEncryptShipPosition')
    .addParam('x', 'x coordinate of ship')
    .addParam('y', 'y coordinate of ship')
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
            .add8(Number(taskArguments.x)).add8(Number(taskArguments.y)).encrypt())
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


task('task:adminCallPlaceShip')
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
        const contract = new Battleships__factory(connectedWallet).attach(contractAddress) as Battleships
        timestampLog("Calling placeShip on contract")
        const txResponse = await contract.placeShip(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof)
        timestampLog("Transaction hash: " + txResponse.hash)
        timestampLog("Waiting for transaction to be included in block...")
        const txReceipt = await txResponse.wait()
        timestampLog("Transaction receipt received. Block number: " + txReceipt?.blockNumber)
    })

task('task:adminStartGame')
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
        const contract = new Battleships__factory(connectedWallet).attach(contractAddress) as Battleships
        timestampLog("Calling startGame on contract")
        const txResponse = await contract.startGame();
        timestampLog("Transaction hash: " + txResponse.hash)
        timestampLog("Waiting for transaction to be included in block...")
        const txReceipt = await txResponse.wait()
        timestampLog("Transaction receipt received. Block number: " + txReceipt?.blockNumber)
    });

task('task:adminEndGame')
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
        const contract = new Battleships__factory(connectedWallet).attach(contractAddress) as Battleships
        timestampLog("Calling endGame on contract")
        const txResponse = await contract.endGame();
        timestampLog("Transaction hash: " + txResponse.hash)
        timestampLog("Waiting for transaction to be included in block...")
        const txReceipt = await txResponse.wait()
        timestampLog("Transaction receipt received. Block number: " + txReceipt?.blockNumber)
    });

task('task:adminGetShipPositions')
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
        const contract = new Battleships__factory(connectedWallet).attach(contractAddress) as Battleships
        timestampLog("Calling getShipPositions on contract to get ciphertext handles")
        const eShipPositionsList = await contract.getShipPositions();
        timestampLog("Requesting decryption...")
        const handles = eShipPositionsList.reduce((handles: string[], eShipPosition: Battleships.ECoordStructOutput) => {
            handles.push(eShipPosition.x);
            handles.push(eShipPosition.y);
            return handles;
        }, []);
        const decryptedHandles = await fhevmInstance.publicDecrypt(handles);
        const dShipPositionsList: Coord[] = eShipPositionsList.map((eShipPosition: Battleships.ECoordStructOutput) => {
            return { x: BigInt(decryptedHandles[eShipPosition.x]) as unknown as number, y: BigInt(decryptedHandles[eShipPosition.y]) as unknown as number };
        });
        timestampLog("Decrypted ship positions: ");
        console.log(dShipPositionsList);
    })

task('task:adminGetPlayersCorrectGuesses')
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
        const contract = new Battleships__factory(connectedWallet).attach(contractAddress) as Battleships
        timestampLog("Calling getPlayersCorrectGuesses on contract to get ciphertext handles")
        const [playersList, ePlayerCorrectGuessesList] = await contract.connect(connectedWallet).getPlayersCorrectGuesses();
        timestampLog("Decrypting handles ePlayerCorrectGuesses");
        const result = await setupUserDecrypt(fhevmInstance, connectedWallet, ePlayerCorrectGuessesList, contractAddress);
        timestampLog("Result:");
        const playerNumCorrectGuesses: Record<string, bigint> = {};
        let handleIndex = 0;
        for (const key in result) {
            playerNumCorrectGuesses[playersList[handleIndex]] = result[key] as bigint;
            handleIndex++;
        }
        console.log(playerNumCorrectGuesses);
    })