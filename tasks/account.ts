import * as fs from "fs"
import { task } from 'hardhat/config'
import type { TaskArguments } from 'hardhat/types'
import { timestampLog, loadWallet, loadTestnetConfig } from "./utils"
import createPrompt from 'prompt-sync'

task('task:accountCreate')
    .addParam('keyFile', 'File to save encrypted key in')
    .setAction(async function (taskArguments: TaskArguments, { ethers }) {
        const wallet = ethers.Wallet.createRandom()
        timestampLog("Account generated: " + wallet.address)
        let password = process.env.WALLET_PASSWORD
        if (!password) {
            console.log("Set WALLET_PASSWORD env var to skip this prompt")
            password = createPrompt({ sigint: true }).hide('Enter password for wallet: ')
        }
        const jsonKeystore = await wallet.encrypt(password as string)
        fs.writeFileSync(taskArguments.keyFile, jsonKeystore)
        timestampLog("Account saved to file: " + taskArguments.keyFile)
    })

task('task:accountImport')
    .addParam('keyFile', 'File to save encrypted key in')
    .setAction(async function (taskArguments: TaskArguments, { ethers }) {
        let privateKey = process.env.PRIVATE_KEY
        if (!privateKey) {
            throw Error("Set PRIVATE_KEY env var to the private key to be imported. It will be stored in " + taskArguments.keyFile + " encrypted with the password stored in the env var WALLET_PASSWORD (if that env var is not set you will be prompted to supply a password)")
        }
        const wallet = new ethers.Wallet(privateKey)
        let password = process.env.WALLET_PASSWORD
        if (!password) {
            console.log("Set WALLET_PASSWORD env var to skip this prompt")
            password = createPrompt({ sigint: true }).hide('Enter password for wallet: ')
        }
        const jsonKeystore = await wallet.encrypt(password as string)
        fs.writeFileSync(taskArguments.keyFile, jsonKeystore)
        timestampLog("Account saved to file: " + taskArguments.keyFile)
    })

task('task:accountPrintAddress')
    .addParam('keyFile', 'File to read encrypted key from')
    .setAction(async function (taskArguments: TaskArguments) {
        const wallet = await loadWallet(taskArguments.keyFile)
        timestampLog("Address: " + wallet.address)
    })

task('task:accountPrintPrivateKey')
    .addParam('keyFile', 'File to read encrypted key from')
    .setAction(async function (taskArguments: TaskArguments) {
        const wallet = await loadWallet(taskArguments.keyFile)
        createPrompt({ sigint: true }).hide('Continuing will print your private key to the terminal (Enter to continue, Ctrl+C to exit)...')
        timestampLog("Private key: " + wallet.privateKey)
    })


task('task:getBalance')
    .addParam('keyFile', 'File to read encrypted key from')
    .addParam('configFile', 'JSON file to read testnet config from')
    .setAction(async function (taskArguments: TaskArguments, { ethers }) {
        timestampLog("Loading wallet")
        const wallet = await loadWallet(taskArguments.keyFile)
        const walletAddress = wallet.address;
        timestampLog("Loading testnet config")
        const testnetConfig = await loadTestnetConfig(taskArguments.configFile)
        timestampLog("Connecting provider")
        const provider = ethers.getDefaultProvider(testnetConfig.jsonRpcUrl);
        timestampLog("Requesting balance");
        const balance = await provider.getBalance(walletAddress);
        const formattedBalance = ethers.formatEther(balance);
        if (balance < 10 * (10 ** 9)) { // 10 GWEI
            console.log(`You don't have enough ETH to deploy! Wallet balance: ${formattedBalance} ETH.\nPlease request funds from Optalysys for wallet address ${walletAddress}`);
            process.exit(1);
        }
        timestampLog(`Balance for wallet ${walletAddress}: ${formattedBalance} ETH`);
    }
    );