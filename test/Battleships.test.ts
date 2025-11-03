import { FHECounter, FHECounter__factory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm as mockFhevm } from "hardhat";
import { createInstance, loadTestnetConfig, loadWallet, timestampLog } from "../tasks/utils";
import { JsonRpcProvider, HDNodeWallet, Signer } from "ethers";
import { DecryptedResults, FhevmInstance } from "@zama-fhe/relayer-sdk/node";
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

async function setupUserDecrypt(instance: HardhatFhevmRuntimeEnvironment, signer: HDNodeWallet, ciphertextHandles: string[], contractAddress: string): Promise<DecryptedResults> {
  // instance: [`FhevmInstance`] from `zama-fhe/relayer-sdk`
  // signer: [`Signer`] from ethers (could a [`Wallet`])
  // ciphertextHandle: [`string`]
  // contractAddress: [`string`]

  timestampLog("Generating keypair...")

  const keypair = instance.generateKeypair();
  const handleContractPairs = ciphertextHandles.map((ciphertextHandle) => {
    return {
      handle: ciphertextHandle,
      contractAddress: contractAddress,
    };
  });
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

  timestampLog(`Signer ${signer.address} sign typed data...`)

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
  return result;
}

describe("Battleships", function () {
  let signers: Signers;
  let battleshipsContract: Battleships;
  let battleshipsContractAddress: string;
  let wallet: HDNodeWallet;
  let fhevm: HardhatFhevmRuntimeEnvironment;
  let walletAddress: string;
  let initShipPositions: Coord[];


  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
    console.log("Alice address: " + signers.alice.address);
  });

  beforeEach(async () => {
    ({ battleshipsContract, battleshipsContractAddress, wallet, walletAddress, fhevm } = await deployFixture());
    initShipPositions = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }];
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
      { x: 4, y: 4, expectedCorrectGuesses: 3 },
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

  it("Multi players and their winning guesses", async () => {
    type Turn = {
      x: number;
      y: number;
      expectedCorrectGuesses: number;
    }
    const aliceTurns: Turn[] = [
      { x: 10, y: 10, expectedCorrectGuesses: 0 },
      { x: 1, y: 1, expectedCorrectGuesses: 1 },
      { x: 20, y: 20, expectedCorrectGuesses: 1 },
      { x: 3, y: 3, expectedCorrectGuesses: 2 },
      { x: 4, y: 4, expectedCorrectGuesses: 3 },
    ]
    await battleshipsContract.connect(signers.alice).joinGame("Alice");

    for (let i = 0; i < aliceTurns.length; i++) {
      const turn = aliceTurns[i];
      const input = fhevm.createEncryptedInput(battleshipsContractAddress, signers.alice.address);
      input.add8(turn.x); // x: at index 0
      input.add8(turn.y); // y: at index 1
      const encryptedInput = await input.encrypt();
      await battleshipsContract.connect(signers.alice).addGuess(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof);
      const eCorrectGuesses = await battleshipsContract.connect(signers.alice).getCorrectGuesses();
      const correctGuesses = await fhevm.userDecryptEuint(FhevmType.euint8, eCorrectGuesses, battleshipsContractAddress, signers.alice);
      expect(correctGuesses).to.eq(turn.expectedCorrectGuesses);
    }

    const bobTurns: Turn[] = [
      { x: 6, y: 7, expectedCorrectGuesses: 0 },
      { x: 5, y: 6, expectedCorrectGuesses: 0 },
      { x: 4, y: 5, expectedCorrectGuesses: 0 },
      { x: 4, y: 4, expectedCorrectGuesses: 1 },
      { x: 3, y: 3, expectedCorrectGuesses: 2 },
    ]
    await battleshipsContract.connect(signers.bob).joinGame("Bob");

    for (let i = 0; i < bobTurns.length; i++) {
      const turn = bobTurns[i];
      const input = fhevm.createEncryptedInput(battleshipsContractAddress, signers.bob.address);
      input.add8(turn.x); // x: at index 0
      input.add8(turn.y); // y: at index 1
      const encryptedInput = await input.encrypt();
      await battleshipsContract.connect(signers.bob).addGuess(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof);
      const eCorrectGuesses = await battleshipsContract.connect(signers.bob).getCorrectGuesses();
      const correctGuesses = await fhevm.userDecryptEuint(FhevmType.euint8, eCorrectGuesses, battleshipsContractAddress, signers.bob);
      expect(correctGuesses).to.eq(turn.expectedCorrectGuesses);
    }

    await battleshipsContract.connect(signers.deployer).endGame();
    const [playersList, ePlayerCorrectGuessesList] = await battleshipsContract.connect(signers.deployer).getPlayersCorrectGuesses();
    const result = await setupUserDecrypt(fhevm, wallet, ePlayerCorrectGuessesList, battleshipsContractAddress);
    timestampLog("Result:");
    const playerNumCorrectGuesses: Record<string, bigint> = {};
    let handleIndex = 0;
    for (const key in result) {
      playerNumCorrectGuesses[playersList[handleIndex]] = result[key] as bigint;
      handleIndex++;
    }
    expect(Object.keys(playerNumCorrectGuesses).length).to.eq(playersList.length);
    console.log(playerNumCorrectGuesses);
    expect(playerNumCorrectGuesses[playersList[0]]).to.eq(3);
    expect(playerNumCorrectGuesses[playersList[1]]).to.eq(2);
  });

  it("Ship positions should not be publicly decryptable before the game ends", async () => {
    await expect(battleshipsContract.connect(signers.bob).getShipPositions()).to.be.revertedWith("The game has not ended yet.");
    await expect(battleshipsContract.connect(signers.deployer).endGame()).to.not.be.reverted;
    await expect(battleshipsContract.connect(signers.bob).getShipPositions()).to.not.be.reverted;
  });

  it("Ship positions should be publicly decryptable after the game ends", async () => {
    await expect(battleshipsContract.connect(signers.bob).getShipPositions()).to.be.revertedWith("The game has not ended yet.");
    await expect(battleshipsContract.connect(signers.deployer).endGame()).to.not.be.reverted;

    const eShipPositionsList = await battleshipsContract.connect(signers.bob).getShipPositions();
    const handles = eShipPositionsList.reduce((handles: string[], eShipPosition: Battleships.ECoordStructOutput) => {
      handles.push(eShipPosition.x);
      handles.push(eShipPosition.y);
      return handles;
    }, []);
    const decryptedHandles = await fhevm.publicDecrypt(handles);
    const dShipPositionsList: Coord[] = eShipPositionsList.map((eShipPosition: Battleships.ECoordStructOutput) => {
      return { x: BigInt(decryptedHandles[eShipPosition.x]) as unknown as number, y: BigInt(decryptedHandles[eShipPosition.y]) as unknown as number };
    });
    expect(dShipPositionsList).to.deep.eq(initShipPositions);

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