# User Instructions for Optalysys Testnet

## Quickstart

> If you already familiar with interacting with Ethereum blockchains using the JSON RPC API, writing smart contracts in Solidity and writing javascript or typescript you can get started with the below. Otherwise see the [detailed guide](#detailed-guide).

1. Generate an Ethereum compatible private key.
2. Give Optalysys the address derived from your private key and request testnet Eth to be allocated.
3. Request the JSON RPC URL, relayer URL, gateway chain ID, ACL contract address, FHEVM executor contract address, KMS verifier contract address, decryption oracle contract address, input verifier contract address, input verification contract address and decryption contract address from Optalysys.
4. Write an FHE smart contract using [Zama's Solidity docs](https://docs.zama.ai/protocol/solidity-guides/smart-contract/configure) (but with **config explicitly set to use the addresses provided by Optalysys, not Zama's config for Sepolia** - as the addresses are of course different). Use [Zama's Solidity library](https://www.npmjs.com/package/@fhevm/solidity) at version v0.8.0 (other versions may work, but currently the server side of Optalysys' testnet uses versions of Zama's stack known to be compatible with v0.8.0).
4. Deploy your smart contract using your method of choice through the JSON RPC URL provided by Optalysys in step 3 using you private key that was funded in step 2 to sign the transaction. See the [Ethereum documentation on deploying smart contracts](https://ethereum.org/developers/docs/smart-contracts/deploying/) if you don't know how to do this.
5. Interact with your contract using your method of choice and create encrypted inputs to send to it / request decryptions using [Zama's relayer SDK](https://www.npmjs.com/package/@zama-fhe/relayer-sdk) at version v0.2.0 (other versions may work, but the current version of Zama's relayer run on Optalysys' testnet is known to be compatible with v0.2.0) - using the details provided by Optalysys in step 3 to initialise the relayer SDK.

## Detailed Guide

> All commands in this guide assume you are running them from the directory in which this guide exists on your machine.

### Pre-requisites

> This guide uses [pnpm](https://pnpm.io/installation). If you already have this installed on your machine or know how to run a container with them installed you can skip this section.

It is recommended to run this guide in a container, to avoid the [it works on my machine issue](https://expertbeacon.com/the-works-on-my-machine-problem-causes-solutions-and-lessons-from-google/).

> This guide uses Docker, but you can use another container management tool if you wish (e.g. podman).

Follow the instructions for [installing Docker on your machine](https://docs.docker.com/engine/install/). Alternatively, install pnpm directly on your machine.


#### Dockerfile

The Dockerfile contains instructions to build a Ubuntu Docker container with node and pnpm.

> If your company uses a proxy, you will need to [add their CA certificates to the Dockerfile](https://docs.docker.com/engine/network/ca-certs/#add-ca-certificates-to-linux-images-and-containers) to ensure commands like `apt` and `pnpm install` work. The commented-out sections in the `Dockerfile` have an example of this.

After you have Docker installed you can start an Ubuntu container with this Docker command. This builds the Dockerfile and tags it `testnet-pnpm-ubuntu`, and then runs the Docker container.

```bash
docker build -t testnet-pnpm-ubuntu . && docker run --hostname testnet-pnpm-ubuntu -it --rm -v .:/home/node/guide --workdir /home/node/guide testnet-pnpm-ubuntu bash
```

The following commands will be run inside the Docker container. Make sure the shell prompt shows `node@testnet-pnpm-ubuntu:~/guide$` which means you are running the Docker container's shell.

### Install Dependencies

Install the dependencies for the code used in this guide

```bash
pnpm install
```

### Generate an Ethereum Compatible Private Key

- **Either** [generate a new Ethereum compatible private key](#generate-a-new-ethereum-compatible-private-key)
- **Or** [import an existing Ethereum compatible private key](#import-an-existing-ethereum-compatible-private-key)

Your wallet will persist in the private key JSON file.

#### Generate a new Ethereum compatible private key

> Enter a password when prompted, or set the `WALLET_PASSWORD` env var

```bash
pnpm hardhat task:accountCreate --key-file key.json
```

> You can output the decrypted private key with `pnpm hardhat task:accountPrintPrivateKey --key-file key.json` - beware that printing it to your terminal is not recommended.

#### Import an existing Ethereum compatible private key

Set the environment variable `PRIVATE_KEY` to your private key.

> Enter a password when prompted, or set the `WALLET_PASSWORD` env var

```bash
pnpm hardhat task:accountImport --key-file key.json
```

### Check your wallet ETH balance on the testnet

```bash
pnpm hardhat task:getBalance --key-file key.json --config-file testnet_config.json 
2025-10-24T14:03:35.875Z :: Loading wallet
Set WALLET_PASSWORD env var to skip this prompt
Enter password for wallet: 
2025-10-24T14:03:39.070Z :: Loading testnet config
2025-10-24T14:03:39.072Z :: Connecting provider
2025-10-24T14:03:39.094Z :: Requesting balance
2025-10-24T14:03:39.316Z :: Balance for wallet 0x7Cc412E67f88ba0CBC6F5C28279E4e5c79c2aEd9: 0.999997600761205446 ETH
```

### Request funds and details on the testnet from Optalysys

Get the address from your private key

```bash
pnpm hardhat task:accountPrintAddress --key-file key.json
```

Send this to Optalysys requesting funds on the testnet.

**You will not be able to interact with contracts on the testnet without funds**


Send this to Optalysys requesting the testnet URLs, chain ID, and contract addresses, as well as funds to use it.

We will reply with confirmation of funds and a JSON file `testnet_config.json`containing (with actual values in the placeholders):

```json
{
    "json_rpc_url": "JSON_RPC_URL",
    "relayer_url": "RELAYER_URL",
    "gateway_chain_id": "GATEWAY_CHAIN_ID",
    "acl_contract_address": "ACL_CONTRACT_ADDRESS",
    "fhevm_executor_contract_address": "FHEVM_EXECUTOR_CONTRACT_ADDRESS",
    "kms_verifier_contract_address": "KMS_VERIFIER_CONTRACT_ADDRESS",
    "decryption_oracle_contract_address": "DECRYPTION_ORACLE_CONTRACT_ADDRESS",
    "input_verifier_contract_address": "INPUT_VERIFIER_CONTRACT_ADDRESS",
    "input_verification_contract_address": "INPUT_VERIFICATION_CONTRACT_ADDRESS",
    "decryption_contract_address": "DECRYPTION_CONTRACT_ADDRESS"
}
```


Save this file in the root directory of the container you are using as your execution environment.

> Once you have the above you can start deploying smart contracts to the testnet that use FHE and interacting with them. The rest of this guide walks through deploying a simple test contract and interacting with it.

## Admin

### Admin: Deploy Battleships contract

The hardhat tasks (prefixed by `task:`) are defined in the folder `tasks/`. The network config file are the config details to connect to the testnet, so there's no need to pass the `--network` param to hardhat (anyway, hardhat doesn't support custom network names).

This deploys a simple contract to the testnet using the account and config you created in the previous steps. The contract is in the file `contracts/Simple.sol`. It demonstrates encrypting a uint8, and two uint8s, and public decryption. The deployed contract address is written to the file `test_contract.address`.

```bash
pnpm hardhat task:adminDeployBattleships --config-file testnet_config.json --address-file battleships.address --key-file deployer.json
2025-11-03T11:30:25.843Z :: Deploying contract
2025-11-03T11:30:28.369Z :: Waiting for deployment...
2025-11-03T11:30:33.838Z :: Contract deployed at block: 181668
2025-11-03T11:30:33.838Z :: Contract address: 0x335803361FB6FdC13dF87B9eDC95B7dAB8CB075C
2025-11-03T11:30:33.839Z :: Contract address written to file: battleships.address
```

### Admin: Encrypt a ship position (two uint8s) and call placeShip with the encrypted values

As a first test we will encrypt an unsigned 8-bit integer, store it on the contract, then request its decryption.

#### Encrypt two Unsigned 8-bit Integers

This will fetch the URLs of the public keys from the relayer, then fetch the public keys from those URLs, use the public key to encrypt the input and then generate a zero-knowledge proof that we know the plaintext value for this ciphertext. The ciphertext and zkproof will be stored in a file `encrypted_input.json` so we can use them in following steps.

```bash
pnpm hardhat task:adminEncryptShipPosition --x 4 --y 4 --input-file eShipPosition.json --config-file testnet_config.json --address-file battleships.address --key-file deployer.json 
2025-11-03T11:45:02.933Z :: Encrypting...
2025-11-03T11:46:57.067Z :: Input encrypted
2025-11-03T11:46:57.068Z :: Encrypted input and ZK proof written to: eShipPosition.json
```

#### Call placeShip with the encrypted inputs

Now that the coprocessors know about the ciphertext (from the previous action) and have returned an attestation of the zkproof, we can store the ciphertext (actually a "handle" that the coprocessors know references that ciphertext) from `eShipPosition.json` on our contract on the blockchain.

```bash
pnpm hardhat task:adminCallPlaceShip --input-file eShipPosition.json --config-file testnet_config.json --address-file battleships.address --key-file deployer.json 
2025-11-03T11:48:16.566Z :: Calling placeShip on contract
2025-11-03T11:48:18.763Z :: Transaction hash: 0xb833ffaf216b9107e53dfd41c093330734780e867d60f8c16e1091d213f654dc
2025-11-03T11:48:18.763Z :: Waiting for transaction to be included in block...
2025-11-03T11:48:28.212Z :: Transaction receipt received. Block number: 181847
```

### Start game
Call start game after placing the ships

```bash
 pnpm hardhat task:adminStartGame --config-file testnet_config.json --address-file battleships.address --key-file deployer.json 
2025-11-03T11:48:53.244Z :: Calling startGame on contract
2025-11-03T11:48:55.820Z :: Transaction hash: 0xd22ab6c3caed18fc158bd274f51f480be14c3117aa6a5c89cf7a8d413a22cf4e
2025-11-03T11:48:55.821Z :: Waiting for transaction to be included in block...
2025-11-03T11:49:05.129Z :: Transaction receipt received. Block number: 181853
```


### Admin: End game
Call end game after all players have finished all their turns.

When the game ends, the contract owner makes the ship positions publicly decryptable and all players will be able decrypt the ship positions.

```bash
 pnpm hardhat task:adminEndGame --config-file testnet_config.json --address-file battleships.address --key-file deployer.json 
```

### Admin: Request Public Decryption of ship positions after the game has ended

Now that a reference to the ciphertext is stored on the blockchain, ACLs have been created that control who can interact with that ciphertext. If you [look at the contract code](./contracts/Battleships.sol) endGame you will see that we allow public decryption of the ship positions. See [Zama's docs](https://docs.zama.ai/protocol/relayer-sdk-guides/fhevm-relayer/decryption/public-decryption) for more details about public decryption. Lets use public decryption to get the plaintext of the values stored on the blockchain.


```bash
 pnpm hardhat task:adminGetShipPositions --config-file testnet_config.json --address-file battleships.address --key-file deployer.json 
```

## Player
You need to join the game by supplying your name. The player has a maximum of 5 guesses. When the game ends, the contract owner makes the ship positions publicly decryptable and all players will be able decrypt the ship positions.

### Player: Join game

```bash
pnpm hardhat task:joinGame --name Alice --config-file testnet_config.json --address-file battleships.address --key-file player1.json 
2025-11-03T11:49:54.419Z :: Calling joinGame on contract with name Alice
2025-11-03T11:49:56.845Z :: Transaction hash: 0xbbb44ab199c2498d714332392756177c07abd3bf03e0707c2ceb3e9852e34eea
2025-11-03T11:49:56.845Z :: Waiting for transaction to be included in block...
2025-11-03T11:50:06.258Z :: Transaction receipt received. Block number: 181863
```

### Player: Encrypt ship position guess (two uint8s)
The guess is encrypted into the file `p1_e.json`

```bash
pnpm hardhat task:encryptShipPosition --x 0 --y 0 --input-file p1_e.json --config-file testnet_config.json --address-file battleships.address --key-file player1.json 
2025-11-03T11:51:05.654Z :: Encrypting...
2025-11-03T11:53:03.009Z :: Input encrypted
2025-11-03T11:53:03.010Z :: Encrypted input and ZK proof written to: p1_e.json
```

### Player: Call addGuess with the encrypted inputs
The encrypted guess is read from the input file `p1_e.json`

```bash
pnpm hardhat task:callAddGuess --input-file p1_e.json --config-file testnet_config.json --address-file battleships.address --key-file player1.json 
2025-11-03T11:55:17.344Z :: Calling addGuess contract
2025-11-03T11:55:19.498Z :: Transaction hash: 0x0594ff0b69ba64826660ea5ba1055735cf95138aabd947f91a3656b071d59144
2025-11-03T11:55:19.498Z :: Waiting for transaction to be included in block...
2025-11-03T11:55:28.705Z :: Transaction receipt received. Block number: 181917
```

### Player: Get the number of correct guesses
By keeping track of the previous number of correct guesses and the latest number of correct guesses, the player can infer whether their guess is a hit.

First call:
```bash
pnpm hardhat task:getCorrectGuesses --config-file testnet_config.json --address-file battleships.address --key-file player1.json 
2025-11-03T11:56:08.111Z :: Calling getCorrectGuesses on contract
2025-11-03T11:56:08.333Z :: Requesting decryption...
2025-11-03T11:56:08.334Z :: Generating keypair...
2025-11-03T11:56:08.341Z :: Creating EIP712...
2025-11-03T11:56:08.342Z :: Signer 0x8D7c26ac47A0f3488D1a889B8B1BB6848d88b416 sign typed data...
2025-11-03T11:56:08.349Z :: User decrypt...
2025-11-03T11:56:56.584Z :: Decrypted number of correct guesses: 0
```

Calling it again:
```bash
pnpm hardhat task:getCorrectGuesses --config-file testnet_config.json --address-file battleships.address --key-file player1.json 
2025-11-03T12:02:14.819Z :: Calling getCorrectGuesses on contract
2025-11-03T12:02:15.035Z :: Requesting decryption...
2025-11-03T12:02:15.036Z :: Generating keypair...
2025-11-03T12:02:15.044Z :: Creating EIP712...
2025-11-03T12:02:15.045Z :: Signer 0x8D7c26ac47A0f3488D1a889B8B1BB6848d88b416 sign typed data...
2025-11-03T12:02:15.055Z :: User decrypt...
2025-11-03T12:02:26.683Z :: Decrypted number of correct guesses: 1
```