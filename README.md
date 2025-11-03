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

### Admin: Deploy MysteryDoors contract

The hardhat tasks (prefixed by `task:`) are defined in the folder `tasks/`. The network config file are the config details to connect to the testnet, so there's no need to pass the `--network` param to hardhat (anyway, hardhat doesn't support custom network names).

This deploys a simple contract to the testnet using the account and config you created in the previous steps. The contract is in the file `contracts/Simple.sol`. It demonstrates encrypting a uint8, and two uint8s, and public decryption. The deployed contract address is written to the file `test_contract.address`.

```bash
pnpm hardhat task:adminDeployMysteryDoors --config-file testnet_config.json  --address-file mysterydoors.address --key-file deployer.json 
2025-11-03T17:20:43.518Z :: Deploying contract
2025-11-03T17:20:46.119Z :: Waiting for deployment...
2025-11-03T17:20:51.437Z :: Contract deployed at block: 185171
2025-11-03T17:20:51.438Z :: Contract address: 0x883BC1E920b31e5a3f2dA3ABaDA7FA4dd409E189
2025-11-03T17:20:51.438Z :: Contract address written to file: mysterydoors.address
```

### Admin: Encrypt 5 occupied positions (uint8s) and call markOccupied with the encrypted values


#### Encrypt 5 Unsigned 8-bit Integers

This will fetch the URLs of the public keys from the relayer, then fetch the public keys from those URLs, use the public key to encrypt the input and then generate a zero-knowledge proof that we know the plaintext value for this ciphertext. The ciphertext and zkproof will be stored in a file `input.json` so we can use them in following steps.

```bash
pnpm hardhat task:adminEncryptOccupiedPositions --input-file inputs.json --config-file testnet_config.json  --address-file mysterydoors.address --key-file deployer.json --p1 24 --p2 23 --p3 22 --p4 17 --p5 12  
2025-11-03T17:28:46.885Z :: Encrypting...
2025-11-03T17:30:02.998Z :: Input encrypted
2025-11-03T17:30:02.999Z :: Encrypted input and ZK proof written to: inputs.json
```

#### Call markOccupied with the encrypted inputs

Now that the coprocessors know about the ciphertext (from the previous action) and have returned an attestation of the zkproof, we can store the ciphertext (actually a "handle" that the coprocessors know references that ciphertext) from `inputs.json` on our contract on the blockchain.

```bash
pnpm hardhat task:adminCallMarkOccupied --input-file inputs.json --config-file testnet_config.json --address-file mysterydoors.address --key-file deployer.json 
2025-11-03T17:33:24.721Z :: Calling markOccupied on contract
2025-11-03T17:33:27.398Z :: Transaction hash: 0x09888e0c5cdd1c368670372e0b99f4462cd505eeeb7e8724fdc165104d05eaf9
2025-11-03T17:33:27.398Z :: Waiting for transaction to be included in block...
2025-11-03T17:33:36.610Z :: Transaction receipt received. Block number: 185298
```

### Admin: Start game
Call start game after placing the ships

```bash
pnpm hardhat task:adminStartMysteryDoors --config-file testnet_config.json --address-file mysterydoors.address --key-file deployer.json 
2025-11-03T17:34:57.312Z :: Calling startGame on contract
2025-11-03T17:34:59.765Z :: Transaction hash: 0x18ecdee56076a62679c9ab7886e57e80b92a09fff9dbb314ec79381595f741af
2025-11-03T17:34:59.765Z :: Waiting for transaction to be included in block...
2025-11-03T17:35:04.985Z :: Transaction receipt received. Block number: 185313
```


### Admin: End game
Call end game after all players have finished all their turns.

When the game ends, the contract owner makes the ship positions publicly decryptable and all players will be able decrypt the ship positions.

```bash
pnpm hardhat task:adminEndMysteryDoors --config-file test
net_config.json --address-file mysterydoors.address --key-file deployer.json 
2025-11-03T18:49:31.742Z :: Calling endGame on contract
2025-11-03T18:49:33.927Z :: Transaction hash: 0xb0fde5fbefc80aeadba8e07b0f57309bb895bc4784f9eb07a33a7e56a15baa30
2025-11-03T18:49:33.927Z :: Waiting for transaction to be included in block...
2025-11-03T18:49:43.238Z :: Transaction receipt received. Block number: 186059
```

### Admin: Get occupied positions and decrypt them after the game has ended

Now that a reference to the ciphertext is stored on the blockchain, ACLs have been created that control who can interact with that ciphertext. If you [look at the contract code](./contracts/MysteryDoors.sol) endGame you will see that we allow public decryption of the occupied positions. See [Zama's docs](https://docs.zama.ai/protocol/relayer-sdk-guides/fhevm-relayer/decryption/public-decryption) for more details about public decryption. Lets use public decryption to get the plaintext of the values stored on the blockchain.


```bash
pnpm hardhat task:adminGetOccupiedPositions --config-file testnet_config.json --address-file mysterydoors.address --key-file deployer.json 
2025-11-03T18:51:07.454Z :: Calling getOccupiedPositions on contract to get ciphertext handles
2025-11-03T18:51:07.718Z :: Requesting decryption...
2025-11-03T18:51:20.436Z :: Decrypted occupied positions: 
[ 24n, 23n, 22n, 17n, 12n ]
```

## Player
You need to join the game by supplying your name. The player has a maximum of 5 guesses. When the game ends, the contract owner makes the ship positions publicly decryptable and all players will be able decrypt the ship positions.

### Player: Join game

```bash
pnpm hardhat task:joinMysteryDoors --name Alice --config-file testnet_config.json --address-file mysterydoors.address --key-file alice.json 
2025-11-03T17:36:07.628Z :: Calling joinGame on contract with name Alice
2025-11-03T17:36:10.123Z :: Transaction hash: 0xeea24c71f414cd728c258cddd99e846702557d11ac6c4fd3c4bba1fdb22ab710
2025-11-03T17:36:10.123Z :: Waiting for transaction to be included in block...
2025-11-03T17:36:15.338Z :: Transaction receipt received. Block number: 185325
```

### Player: Encrypt 5 position (uint8) guesses
The guesses are encrypted into the file `alice_inputs.json`

```bash
pnpm hardhat task:encryptOccupiedGuesses --input-file alice_inputs.json --config-file testnet_config.json --address-file mysterydoors.address --key-file alice.json --p1 17 --p2 4 --p3 2 --p4 21 --p5 6
2025-11-03T17:39:05.328Z :: Encrypting...
2025-11-03T17:41:51.137Z :: Input encrypted
2025-11-03T17:41:51.138Z :: Encrypted input and ZK proof written to: alice_inputs.json
```


### Player: Call makeGuesses with the encrypted inputs
The encrypted guess is read from the input file `alice_inputs.json`

```bash
pnpm hardhat task:callMakeGuesses --input-file alice_inputs.json --config-file testnet_config.json --address-file mysterydoors.address --key-file alice.json
2025-11-03T17:42:47.078Z :: Loading wallet
Set WALLET_PASSWORD env var to skip this prompt
Enter password for wallet: 
2025-11-03T17:42:51.077Z :: Loading contract address
2025-11-03T17:42:51.078Z :: Loading testnet config
2025-11-03T17:42:51.079Z :: Loading encrypted input and zkproof
2025-11-03T17:42:51.080Z :: Connecting wallet
2025-11-03T17:42:51.102Z :: Connecting to contract
2025-11-03T17:42:51.109Z :: Calling makeGuesses contract
2025-11-03T17:42:53.388Z :: Transaction hash: 0xd177b90e3532d27a3ad0ccc6ce2f47228cf98a3ed0fc004a865475d49d5cfd2f
2025-11-03T17:42:53.388Z :: Waiting for transaction to be included in block...
2025-11-03T17:42:58.503Z :: Transaction receipt received. Block number: 185392
```

### Player: Get the number of correct guesses
After they have made their guesses, the player can get the number of correct guesses.

```bash
pnpm hardhat task:getCorrectGuesses --config-file testnet_config.json --address-file mysterydoors.address --key-file alice.json
2025-11-03T18:39:39.417Z :: Calling getCorrectGuesses on contract
2025-11-03T18:39:39.695Z :: Requesting decryption...
2025-11-03T18:39:39.695Z :: Generating keypair...
2025-11-03T18:39:39.702Z :: Creating EIP712...
2025-11-03T18:39:39.703Z :: Signer 0x8D7c26ac47A0f3488D1a889B8B1BB6848d88b416 sign typed data...
2025-11-03T18:39:39.711Z :: User decrypt...
2025-11-03T18:39:56.613Z :: Decrypted number of correct guesses: 1
```


### Player: Decrypt your guesses
To see the guesses you have submitted:

```bash
 pnpm hardhat task:getGuesses --config-file testnet_config.json --address-file mysterydoors.address --key-file alice.json 
```

### Player: Get ship positions and decrypt them when the game ends
When the game ends, the contract owner makes the ship positions publicly decryptable and all players will be able decrypt the ship positions.

```bash
pnpm hardhat task:getOccupiedPositions --config-file testnet_config.json --address-file mysterydoors.address --key-file alice.json
2025-11-03T18:51:56.797Z :: Calling getOccupiedPositions on contract to get ciphertext handles
2025-11-03T18:51:56.988Z :: Requesting decryption...
2025-11-03T18:51:58.048Z :: Decrypted occupied positions: 
[ 24n, 23n, 22n, 17n, 12n ]
```