import { FHECounter, FHECounter__factory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm as mockFhevm } from "hardhat";
import { createInstance, loadTestnetConfig, loadWallet, timestampLog } from "../tasks/utils";
import { JsonRpcProvider, HDNodeWallet, Signer } from "ethers";
import { FhevmInstance } from "@zama-fhe/relayer-sdk/node";
import { HardhatFhevmRuntimeEnvironment, FhevmType } from "@fhevm/hardhat-plugin";
import { Battleships, Battleships__factory } from "../typechain-types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

type Coord = {
  x: number;
  y: number;
};

const MAX_GUESSES = 5;

async function deployFixture() {
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
    console.log("Alice address: " + signers.alice.address);
  });

  beforeEach(async () => {
    ({ battleshipsContract, battleshipsContractAddress, wallet, walletAddress, fhevm } = await deployFixture());
    const initShipPositions: Coord[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }];
    for (let i = 0; i < initShipPositions.length; i++) {
      const initShipPosition = initShipPositions[i];
      const input = fhevm.createEncryptedInput(battleshipsContractAddress, walletAddress);
      input.add8(initShipPosition.x); // x: at index 0
      input.add8(initShipPosition.y); // y: at index 1
      const encryptedInput = await input.encrypt();
      await battleshipsContract.placeShip(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof);
    }
    await battleshipsContract.startGame();
  });

  it("Player needs to have joined the game", async () => {
    const input = fhevm.createEncryptedInput(battleshipsContractAddress, signers.alice.address);
    input.add8(0); // x: at index 0
    input.add8(0); // y: at index 1
    const encryptedInput = await input.encrypt();
    await expect(battleshipsContract.connect(signers.alice).addGuess(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof)).to.be.revertedWith("You have not joined the game!");
    await battleshipsContract.connect(signers.alice).joinGame("Alice");
    await expect(battleshipsContract.connect(signers.alice).addGuess(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof)).not.to.be.reverted;
  });

  it("Only MAX_GUESSES guesses are allowed", async () => {
    await battleshipsContract.connect(signers.alice).joinGame("Alice");
    for (let i = 1; i <= MAX_GUESSES; i++) {
      const input = fhevm.createEncryptedInput(battleshipsContractAddress, signers.alice.address);
      input.add8(i); // x: at index 0
      input.add8(i); // y: at index 1
      const encryptedInput = await input.encrypt();
      await expect(battleshipsContract.connect(signers.alice).addGuess(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof)).to.not.be.reverted;
      if (i === MAX_GUESSES) {
        await expect(battleshipsContract.connect(signers.alice).addGuess(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof)).to.be.revertedWith("You are out of guesses!");
      }
    }
  });

  it("Player should be able to decrypt their guesses", async () => {
    await battleshipsContract.connect(signers.alice).joinGame("Alice");
    for (let i = 1; i <= 3; i++) {
      const input = fhevm.createEncryptedInput(battleshipsContractAddress, signers.alice.address);
      input.add8(i); // x: at index 0
      input.add8(i); // y: at index 1
      const encryptedInput = await input.encrypt();
      await battleshipsContract.connect(signers.alice).addGuess(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof);
    }
    const playerGuesses = await battleshipsContract.connect(signers.alice).getGuesses();
    for (let i = 0; i < playerGuesses.length; i++) {
      const decryptedX = await fhevm.userDecryptEuint(FhevmType.euint8, playerGuesses[i].x, battleshipsContractAddress, signers.alice);
      expect(decryptedX).to.eq(i + 1);
      const decryptedY = await fhevm.userDecryptEuint(FhevmType.euint8, playerGuesses[i].x, battleshipsContractAddress, signers.alice);
      expect(decryptedY).to.eq(i + 1);
    }
  });

  it("Player should be able to decrypt the number of correct guesses after every turn", async () => {
    type Turn = {
      x: number;
      y: number;
      expectedCorrectGuesses: number;
    }
    const turns: Turn[] = [
      { x: 10, y: 10, expectedCorrectGuesses: 0 },
      { x: 1, y: 1, expectedCorrectGuesses: 1 },
      { x: 20, y: 20, expectedCorrectGuesses: 1 },
      { x: 3, y: 3, expectedCorrectGuesses: 2 },
    ]
    await battleshipsContract.connect(signers.alice).joinGame("Alice");

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      const input = fhevm.createEncryptedInput(battleshipsContractAddress, signers.alice.address);
      input.add8(turn.x); // x: at index 0
      input.add8(turn.y); // y: at index 1
      const encryptedInput = await input.encrypt();
      await battleshipsContract.connect(signers.alice).addGuess(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof);
      const eCorrectGuesses = await battleshipsContract.connect(signers.alice).getCorrectGuesses();
      const correctGuesses = await fhevm.userDecryptEuint(FhevmType.euint8, eCorrectGuesses, battleshipsContractAddress, signers.alice);
      expect(correctGuesses).to.eq(turn.expectedCorrectGuesses);
    }

  });
});

describe("Battleships before game start", function () {
  let signers: Signers;
  let battleshipsContract: Battleships;
  let battleshipsContractAddress: string;
  let wallet: HDNodeWallet;
  let fhevm: HardhatFhevmRuntimeEnvironment;
  let walletAddress: string;


  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
    console.log("Alice address: " + signers.alice.address);
  });

  beforeEach(async () => {
    ({ battleshipsContract, battleshipsContractAddress, wallet, walletAddress, fhevm } = await deployFixture());
    const initShipPositions: Coord[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }];
    for (let i = 0; i < initShipPositions.length; i++) {
      const initShipPosition = initShipPositions[i];
      const input = fhevm.createEncryptedInput(battleshipsContractAddress, walletAddress);
      input.add8(initShipPosition.x); // x: at index 0
      input.add8(initShipPosition.y); // y: at index 1
      const encryptedInput = await input.encrypt();
      await battleshipsContract.placeShip(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof);
    }
  });

  it("Only deployer can end the game", async () => {
    await expect(battleshipsContract.connect(signers.alice).endGame()).to.be.reverted;
    await expect(battleshipsContract.connect(signers.bob).endGame()).to.be.reverted;
    await expect(battleshipsContract.connect(signers.deployer).endGame()).to.not.be.reverted;
  });

  it("Only deployer can start the game", async () => {
    await expect(battleshipsContract.connect(signers.alice).startGame()).to.be.reverted;
    await expect(battleshipsContract.connect(signers.bob).startGame()).to.be.reverted;
    await expect(battleshipsContract.connect(signers.deployer).startGame()).to.not.be.reverted;
  });

  it("The game can only be started once", async () => {
    await expect(battleshipsContract.connect(signers.deployer).startGame()).to.not.be.reverted;
    await expect(battleshipsContract.connect(signers.deployer).startGame()).to.be.revertedWith("The game has already started.");

  });



});