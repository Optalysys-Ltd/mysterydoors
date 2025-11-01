import { FHECounter, FHECounter__factory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm as mockFhevm } from "hardhat";
import { createInstance, loadTestnetConfig, loadWallet, timestampLog } from "../tasks/utils";
import { JsonRpcProvider, HDNodeWallet, Signer } from "ethers";
import { FhevmInstance } from "@zama-fhe/relayer-sdk/node";
import { HardhatFhevmRuntimeEnvironment, FhevmType } from "@fhevm/hardhat-plugin";
import {Battleships, Battleships__factory} from "../typechain-types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const initShipPositions: Battleships.CoordStruct[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }];
  const keyFile = "key.json";
  const networkName = process.env.NETWORK || "hardhat";
  let wallet: HDNodeWallet;
  let contractFactory: Battleships__factory;
  let walletAddress: string;
  let fhevm: FhevmInstance | HardhatFhevmRuntimeEnvironment;
  timestampLog("Network name: " + networkName);
  const configFile = networkName == "optalysys" ? "testnet_config.json" : "mocked_config.json";
  if (networkName == "optalysys") {
    timestampLog("Loading wallet")
    wallet = await loadWallet(keyFile) as HDNodeWallet;
    walletAddress = wallet.address;
  } else {
    timestampLog("Running on hardhat, using mocked config");
    const signers = await ethers.getSigners();
    wallet = signers[0];
    walletAddress = wallet.address;
  }

  timestampLog("Loading testnet config")
  const testnetConfig = await loadTestnetConfig(configFile);
  timestampLog("Connecting provider")

  const provider = ethers.getDefaultProvider(testnetConfig.jsonRpcUrl) as JsonRpcProvider;
  if (networkName == "optalysys") {
    timestampLog("Connecting wallet");
    wallet = wallet.connect(provider);
    contractFactory = new Battleships__factory(wallet);
    timestampLog("Creating fhevm instance");

    fhevm = await createInstance(
      testnetConfig.decryptionContractAddress,
      testnetConfig.inputVerificationContractAddress,
      testnetConfig.inputVerifierContractAddress,
      testnetConfig.kmsVerifierContractAddress,
      testnetConfig.aclContractAddress,
      testnetConfig.gatewayChainId,
      testnetConfig.relayerUrl,
      testnetConfig.jsonRpcUrl,
    )
  } else {
    contractFactory = await ethers.getContractFactory("Battleships") as unknown as Battleships__factory;
    timestampLog("Using mock fhevm");
    fhevm = mockFhevm;
  }

  timestampLog("Deploying contract")
  const battleshipsContract = await contractFactory.deploy(
    ethers.getAddress(testnetConfig.aclContractAddress),
    ethers.getAddress(testnetConfig.fhevmExecutorContractAddress),
    ethers.getAddress(testnetConfig.kmsVerifierContractAddress),
    ethers.getAddress(testnetConfig.decryptionOracleContractAddress),
    initShipPositions
  );
  timestampLog("Waiting for deployment...")
  const receipt = await (await battleshipsContract.waitForDeployment()).deploymentTransaction()?.wait()
  timestampLog("Contract deployed at block: " + receipt?.blockNumber);
  const battleshipsContractAddress = receipt?.contractAddress as string;
  timestampLog("Contract address: " + battleshipsContractAddress)


  return { battleshipsContract, battleshipsContractAddress, wallet, walletAddress, fhevm };
}

async function setupUserDecrypt(instance: FhevmInstance, signer: HDNodeWallet, ciphertextHandle: string, contractAddress: string): Promise<string | bigint | boolean> {
  // instance: [`FhevmInstance`] from `zama-fhe/relayer-sdk`
  // signer: [`Signer`] from ethers (could a [`Wallet`])
  // ciphertextHandle: [`string`]
  // contractAddress: [`string`]

  timestampLog("Generating keypair...")

  const keypair = instance.generateKeypair();
  const handleContractPairs = [
    {
      handle: ciphertextHandle,
      contractAddress: contractAddress,
    },
  ];
  const startTimeStamp = Math.floor(Date.now() / 1000).toString();
  const durationDays = '10'; // String for consistency
  const contractAddresses = [contractAddress];

  timestampLog("Creating EIP712...")
  const eip712 = instance.createEIP712(
    keypair.publicKey,
    contractAddresses,
    startTimeStamp,
    durationDays,
  );

  timestampLog("Sign typed data...")

  const signature = await signer.signTypedData(
    eip712.domain,
    {
      UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
    },
    eip712.message,
  );

  timestampLog("User decrypt...")

  const result = await instance.userDecrypt(
    handleContractPairs,
    keypair.privateKey,
    keypair.publicKey,
    signature.replace('0x', ''),
    contractAddresses,
    signer.address,
    startTimeStamp,
    durationDays,
  );
  console.log(result);

  const decryptedValue = result[ciphertextHandle];
  timestampLog("Result: " + decryptedValue);
  return decryptedValue;
}

describe("Battleships", function () {
  let signers: Signers;
  let battleshipsContract: Battleships;
  let battleshipsContractAddress: string;
  let wallet: HDNodeWallet;
  let fhevm: HardhatFhevmRuntimeEnvironment;
  let walletAddress: string;


  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
    console.log("Alice address: "+signers.alice.address);
  });

  beforeEach(async () => {
    ({ battleshipsContract, battleshipsContractAddress, wallet, walletAddress, fhevm } = await deployFixture());
  });

  it("Only deployer can end the game", async ()=> {
    await expect(battleshipsContract.connect(signers.alice).endGame()).to.be.reverted;
    await expect(battleshipsContract.connect(signers.bob).endGame()).to.be.reverted;
    await expect(battleshipsContract.connect(signers.deployer).endGame()).to.not.be.reverted;
  });
});